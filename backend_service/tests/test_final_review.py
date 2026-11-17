"""Acceptance tests for the final classroom review, using an isolated SQLite DB."""
from datetime import timedelta
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import app, login
from backend.demo import ALUNO_ID
from backend.models import Usuario,Matricula,Partida,TrilhaTermo,Progresso,Avaliacao,AvaliacaoQuestao,utcnow
from backend.assessment_reports import distribution


def prepare_exam(app):
    c=app.test_client();teacher=login(c,'professor@lise.demo');student=login(c);now=utcnow()
    r=c.post('/api/v1/classes/1/trails/1/assessment',headers=teacher,json=dict(title='Avaliação final',question_count=3,pass_score=70,content='termos',mode='termo_definicao',opens_at=(now-timedelta(minutes=1)).isoformat(),closes_at=(now+timedelta(hours=1)).isoformat()))
    assert r.status_code==200,r.json
    with Session(app.extensions['engine']) as db:
        ids=db.scalars(select(TrilhaTermo.fk_termo).where(TrilhaTermo.fk_trilha==1)).all()
        for ident in ids:
            old=db.scalar(select(Progresso).where(Progresso.fk_usuario==ALUNO_ID,Progresso.fk_turma_trilha==1,Progresso.fk_termo==ident))
            if old:old.jogado=True
            else:db.add(Progresso(fk_usuario=ALUNO_ID,fk_turma_trilha=1,fk_termo=ident,jogado=True))
        db.commit()
    started=c.post('/api/v1/classes/1/trails/1/assessment/sessions',headers=student,json={})
    assert started.status_code==201,started.json
    return c,teacher,student,started.json


def test_weekly_ranking_counts_free_practice_and_keeps_zero_xp_pupils(app):
    c=app.test_client();student=login(c);other=str(uuid.uuid4())
    with Session(app.extensions['engine']) as db:
        db.add(Usuario(id_usuario=other,nome='Aluno sem XP',email='semxp@lise.demo',perfil='Aluno'));db.flush();db.add(Matricula(fk_usuario=other,fk_turma=1))
        db.add(Partida(id=str(uuid.uuid4()),fk_usuario=ALUNO_ID,fk_termo=1,jogo='bioquiz',resposta_esperada='a',respondida=True,correto=True,xp=17,respondida_em=utcnow()))
        db.commit()
    rows=c.get('/api/v1/classes/1',headers=student).json['weekly_leaderboard']
    assert len(rows)==2
    assert next(r for r in rows if r['user_id']==ALUNO_ID)['xp']==17
    assert next(r for r in rows if r['user_id']==other)['xp']==0


def test_abandon_finalizes_unanswered_review_and_blocks_restart(app):
    c,t,s,started=prepare_exam(app);sid=started['session_id'];q=started['questions'][0]
    with Session(app.extensions['engine']) as db:answer=db.get(AvaliacaoQuestao,q['id']).resposta_esperada
    assert c.post(f'/api/v1/assessment/sessions/{sid}/answer',headers=s,json=dict(question_id=q['id'],answer=answer)).status_code==200
    closed=c.post(f'/api/v1/assessment/sessions/{sid}/abandon',headers=s,json={'reason':'saida'})
    assert closed.status_code==200
    data=closed.json;assert data['reason']=='saida';assert data['correct']==1;assert len(data['questions'])==data['total']
    assert data['questions'][0]['selected']==answer
    assert all(item['correct_label'] for item in data['questions'])
    assert any(not item['answered'] for item in data['questions'])
    assert c.post(f'/api/v1/assessment/sessions/{sid}/answer',headers=s,json=dict(question_id=q['id'],answer=answer)).status_code==409
    assert c.post('/api/v1/classes/1/trails/1/assessment/sessions',headers=s,json={}).status_code==409
    assert c.post(f'/api/v1/assessment/sessions/{sid}/abandon',headers=s,json={}).json['score']==data['score']
    assert c.get(f'/api/v1/assessment/sessions/{sid}',headers=s).json['class_id']==1


def test_deleted_trail_disappears_but_assessments_and_question_charts_remain(app):
    c,t,s,started=prepare_exam(app);sid=started['session_id'];q=started['questions'][0]
    with Session(app.extensions['engine']) as db:answer=db.get(AvaliacaoQuestao,q['id']).resposta_esperada
    c.post(f'/api/v1/assessment/sessions/{sid}/answer',headers=s,json=dict(question_id=q['id'],answer=answer))
    assert c.delete('/api/v1/trails/1',headers=t).status_code==200
    for headers in [s,t]:
        detail=c.get('/api/v1/classes/1',headers=headers).json
        assert detail['trails']==[];assert len(detail['assessments'])==1
        assert detail['assessments'][0]['trail_deleted'] is True
    teacher=c.get('/api/v1/classes/1',headers=t).json['assessments'][0]
    assert teacher['responded']==1;assert teacher['completed']==1;assert teacher['students'][0]['score'] is not None
    assert teacher['statistics']['count']==1
    assert sum(option['count'] for bucket in teacher['questions'] for option in bucket['options'])==1
    assert c.get('/api/v1/dashboard',headers=t).json['trails']==[]
    assert c.get('/api/v1/trails/1?assignment_id=1',headers=s).status_code==404
    assert c.get('/api/v1/classes/1/students/'+ALUNO_ID,headers=t).json['trails']==[]
    assert c.get(f'/api/v1/assessment/sessions/{sid}',headers=s).json['reason']=='trilha_excluida'
    assert c.post('/api/v1/trails/1/restore',headers=t,json={'revision':2}).status_code==404


def test_expired_exam_is_kept_and_closed_in_history(app):
    c,t,s,started=prepare_exam(app)
    with Session(app.extensions['engine']) as db:
        a=db.scalar(select(Avaliacao));a.encerra_em=utcnow()-timedelta(seconds=1);db.commit()
    detail=c.get('/api/v1/classes/1',headers=s).json
    a=detail['assessments'][0];assert a['status']=='concluida';assert a['reason']=='prazo';assert a['score']==0
    assert c.get('/api/v1/classes/1',headers=t).json['assessments'][0]['statistics']['minimum']==0


def test_exam_review_ownership_and_statistics_math(app):
    c,t,s,started=prepare_exam(app);sid=started['session_id']
    assert c.get(f'/api/v1/assessment/sessions/{sid}',headers=s).status_code==409
    c.post(f'/api/v1/assessment/sessions/{sid}/abandon',headers=s,json={})
    with Session(app.extensions['engine']) as db:
        db.add(Usuario(id_usuario=str(uuid.uuid4()),nome='Outro professor',email='outro@lise.demo',perfil='Professor'));db.commit()
    other=login(c,'outro@lise.demo')
    assert c.get(f'/api/v1/assessment/sessions/{sid}',headers=other).status_code==404
    assert c.get(f'/api/v1/assessment/sessions/{sid}').status_code==401
    result=distribution([20,80,80,100]);assert result['mean']==70;assert result['median']==80;assert result['modes']==[80];assert result['minimum']==20;assert result['maximum']==100
    assert distribution([])['mean'] is None


def test_catalog_is_loaded_without_a_query_and_area_filter_is_exact(app):
    c=app.test_client();s=login(c)
    all_rows=c.get('/api/v1/catalog/terms',headers=s).json['terms'];assert all_rows
    area=all_rows[0]['area']
    rows=c.get('/api/v1/catalog/terms',headers=s,query_string={'area':area}).json['terms'];assert rows
    assert all(t['area']==area for t in rows)


def test_teacher_keeps_grades_after_pupil_leaves_class(app):
    from sqlalchemy import delete
    c,t,s,started=prepare_exam(app);sid=started['session_id']
    c.post(f'/api/v1/assessment/sessions/{sid}/abandon',headers=s,json={})
    with Session(app.extensions['engine']) as db:
        db.execute(delete(Matricula).where(Matricula.fk_usuario==ALUNO_ID,Matricula.fk_turma==1));db.commit()
    report=c.get('/api/v1/classes/1',headers=t).json['assessments'][0]
    assert report['completed']==1
    assert report['students'][0]['current_enrollment'] is False
    assert report['students'][0]['score']==0
    assert c.get(f'/api/v1/assessment/sessions/{sid}',headers=t).status_code==200
