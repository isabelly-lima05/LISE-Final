"""Regressions for server authorization, payload boundaries and history preservation."""
from datetime import timedelta
import hashlib
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_api import app, login
from backend.demo import PROFESSOR_ID
from backend.models import (Avaliacao, GameQuestion, GameSession, Matricula, Partida,
                            Progresso, Sessao, TurmaTrilha, Usuario, utcnow)


def other_teacher(app, client):
    with Session(app.extensions['engine']) as db:
        db.add(Usuario(id_usuario='33333333-3333-4333-8333-333333333333',nome='Outro professor',email='outro@lise.demo',perfil='Professor'))
        db.commit()
    return login(client,'outro@lise.demo')


def test_teacher_routes_reject_anonymous_and_student_requests(app):
    c=app.test_client();student=login(c)
    requests=[('POST','/classes',{'name':'x'}),('POST','/trails',{'name':'x','term_ids':[1]}),
              ('POST','/classes/1/trails',{'trail_id':1}),('DELETE','/trails/1',{}),
              ('POST','/classes/1/trails/1/assessment',{}),('POST','/terms',{'context':'trail','name':'x','definition':'x'})]
    for method,path,body in requests:
        assert c.open('/api/v1'+path,method=method,json=body).status_code==401
        assert c.open('/api/v1'+path,method=method,json=body,headers=student).status_code==403
    c.patch('/api/v1/auth/profile',json={'role':'Professor','xp':999999},headers=student)
    assert c.get('/api/v1/auth/me',headers=student).json['user']['role']=='Aluno'


def test_cross_teacher_ids_cannot_read_change_or_delete_owned_objects(app):
    c=app.test_client();headers=other_teacher(app,c)
    for method,path,body in [('GET','/classes/1',None),('GET','/trails/1',None),
                            ('GET','/classes/1/students/22222222-2222-4222-8222-222222222222',None),
                            ('DELETE','/trails/1',{}),('DELETE','/classes/1/trails/1',{}),
                            ('POST','/classes/1/trails',{'trail_id':1}),
                            ('POST','/classes/1/trails/1/assessment',{}),
                            ('POST','/trails/1/terms',{'term_ids':[1]})]:
        assert c.open('/api/v1'+path,method=method,json=body,headers=headers).status_code==404,(method,path)


def test_assigned_trail_deletion_and_history_unassignment_are_blocked(app):
    c=app.test_client();h=login(c,'professor@lise.demo')
    assert c.delete('/api/v1/trails/1',headers=h).status_code==409
    student=login(c)
    started=c.post('/api/v1/games/sessions',headers=student,json={'game':'decifrador','source_type':'trail','source_id':1})
    assert started.status_code==201
    assert c.delete('/api/v1/classes/1/trails/1',headers=h).status_code==409
    with Session(app.extensions['engine']) as db:
        assert db.get(TurmaTrilha,1)
        assert db.get(GameSession,started.json['session_id']).fk_turma_trilha==1


def test_unused_assignment_can_be_removed_and_unassigned_trail_deleted(app):
    c=app.test_client();h=login(c,'professor@lise.demo')
    trail=c.post('/api/v1/trails',headers=h,json={'name':'Temporaria','term_ids':[1]}).json['trail']
    c.post('/api/v1/classes/1/trails',headers=h,json={'trail_id':trail['id']})
    assert c.delete(f"/api/v1/classes/1/trails/{trail['id']}",headers=h).status_code==200
    assert c.delete(f"/api/v1/trails/{trail['id']}",headers=h).status_code==200


def test_assessment_validation_is_server_side_and_open_rules_are_immutable(app):
    c=app.test_client();h=login(c,'professor@lise.demo');now=utcnow()
    data={'title':'Prova','question_count':3,'pass_score':70,'content':'termos','mode':'termo_definicao',
          'opens_at':(now+timedelta(hours=1)).isoformat(),'closes_at':(now+timedelta(hours=3)).isoformat()}
    for patch in ({'pass_score':101},{'question_count':0},{'closes_at':data['opens_at']},{'title':'x'*151}):
        assert c.post('/api/v1/classes/1/trails/1/assessment',headers=h,json={**data,**patch}).status_code==400
    assert c.post('/api/v1/classes/1/trails/1/assessment',headers=h,json=data).status_code==200
    with Session(app.extensions['engine']) as db:
        assessment=db.scalar(select(Avaliacao));assessment.abre_em=now-timedelta(minutes=1);db.commit()
    assert c.post('/api/v1/classes/1/trails/1/assessment',headers=h,json={**data,'pass_score':1}).status_code==409
    with Session(app.extensions['engine']) as db:assert db.scalar(select(Avaliacao)).nota_minima==70


def test_past_deadlines_rejected_even_without_html_validation(app):
    c=app.test_client();h=login(c,'professor@lise.demo')
    assert c.post('/api/v1/classes/1/trails',headers=h,json={'trail_id':1,'due_date':'2000-01-01'}).status_code==400
    assert c.post('/api/v1/trails',headers=h,json={'name':'x','term_ids':[1],'class_ids':[1],'due_date':'2000-01-01'}).status_code==400


def test_private_content_and_exports_do_not_expose_other_users_or_credentials(app):
    c=app.test_client();other=other_teacher(app,c)
    private=c.post('/api/v1/terms',headers=other,json={'context':'trail','name':'Segredo do outro professor','definition':'Privado'}).json['term']
    student=login(c)
    assert c.get(f"/api/v1/explore/terms/{private['id']}",headers=student).status_code==404
    assert all(t['id']!=private['id'] for t in c.get('/api/v1/explore',headers=student).json['terms'])
    data=c.post('/api/v1/account/data',headers=student,json={})
    assert data.status_code==200
    text=data.get_data(as_text=True)
    for sensitive in ('demo_password_hash','resposta_esperada','access_token','SUPABASE_PUBLISHABLE_KEY','SECRET_KEY','outro@lise.demo'):
        assert sensitive not in text
    assert data.headers['Cache-Control']=='no-store'
    assert 'Access-Control-Allow-Origin' not in c.get('/api/v1/account',headers={**student,'Origin':'https://evil.example'}).headers


def test_game_score_cannot_be_supplied_and_internal_answers_are_not_sent(app):
    c=app.test_client();h=login(c)
    game=c.post('/api/v1/games/sessions',headers=h,json={'game':'bioquiz','source_type':'area','area':'Biologia Geral'}).json
    def keys(value):
        if isinstance(value,dict):
            for key,item in value.items():
                assert not key.startswith('_') and key not in ('resposta_esperada','correct_answer')
                keys(item)
        elif isinstance(value,list):
            for item in value:keys(item)
    keys(game)
    question=game['questions'][0]
    with Session(app.extensions['engine']) as db:expected=db.get(Partida,question['id']).resposta_esperada
    wrong=next(o['id'] for o in question['options'] if o['id']!=expected)
    result=c.post(f"/api/v1/games/sessions/{game['session_id']}/answer",headers=h,json={'question_id':question['id'],'answer':wrong,'correct':True,'xp':999999,'score':100})
    assert result.status_code==200 and result.json['correct'] is False and result.json['xp']==0
    assert c.get('/api/v1/classes/1',headers=h).json.get('students') is None


def test_student_class_lists_only_send_counts_and_trail_order_is_preserved(app):
    c=app.test_client();student=login(c)
    for path in ('/dashboard','/classes'):
        data=c.get('/api/v1'+path,headers=student).json['classes'][0]
        assert 'code' not in data and 'alunos' not in data
        assert data['student_count']==1
    teacher=login(c,'professor@lise.demo')
    made=c.post('/api/v1/trails',headers=teacher,json={'name':'Ordem escolhida','term_ids':[3,1,2]}).json['trail']
    assert [t['id'] for t in made['term_items']]==[3,1,2]


def test_password_change_revokes_other_sessions_and_wrong_password_keeps_current_session(app):
    c=app.test_client();previous=login(c);current=login(c)
    wrong=c.post('/api/v1/auth/change-password',headers=current,json={'current_password':'errada','password':'NovaSenhaSegura123!'})
    assert wrong.status_code==400
    assert c.get('/api/v1/auth/me',headers=current).status_code==200
    changed=c.post('/api/v1/auth/change-password',headers=current,json={'current_password':'LiseDemo123!','password':'NovaSenhaSegura123!'})
    assert changed.status_code==200
    assert c.get('/api/v1/auth/me',headers=previous).status_code==401
    assert c.get('/api/v1/auth/me',headers=current).status_code==200


def test_class_invitation_lookup_is_rate_limited_on_the_server(app):
    c=app.test_client();h=login(c)
    for _ in range(15):
        assert c.post('/api/v1/classes/join',headers=h,json={'code':'XXXXXX'}).status_code==404
    assert c.post('/api/v1/classes/join',headers=h,json={'code':'XXXXXX'}).status_code==429
