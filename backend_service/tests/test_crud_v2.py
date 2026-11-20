"""Ownership, lifecycle, concurrency and self-service deletion regressions."""
import uuid
from datetime import timedelta
from types import SimpleNamespace
from sqlalchemy import func,select
from sqlalchemy.orm import Session
from test_api import app,login
from backend.demo import ALUNO_ID,PROFESSOR_ID
from backend.models import *
from backend.account_api import SYSTEM_ID


def teacher(c):return login(c,'professor@lise.demo')
def change(c,h,path,data,method='PATCH'):return c.open('/api/v1'+path,method=method,json=data,headers=h)
def delete_body(**extra):return {'confirmation':'EXCLUIR','password':'LiseDemo123!','preserve_shared_history':True,**extra}


def test_class_edit_conflict_archive_restore_codes_and_closed_enrollment(app):
    c=app.test_client();h=teacher(c);student=login(c)
    assert change(c,h,'/classes/1',{'name':'Nome'}).status_code==428
    changed=change(c,h,'/classes/1',{'name':'Nova turma','revision':1});assert changed.status_code==200
    assert change(c,h,'/classes/1',{'name':'Perda','revision':1}).status_code==409
    code=changed.json['item']['code']
    archived=change(c,h,'/classes/1/archive',{'revision':2},'POST');assert archived.status_code==200
    assert c.get('/api/v1/classes',headers=h).json['classes']==[]
    assert c.get('/api/v1/classes?archived=1',headers=h).json['classes'][0]['name']=='Nova turma'
    assert change(c,student,'/classes/join',{'code':code},'POST').status_code==404
    assert change(c,h,'/classes/1/restore',{'revision':3},'POST').status_code==200
    assert change(c,h,'/classes/1',{'revision':4,'enrollment_open':True}).status_code==200
    new=change(c,h,'/classes/1/code',{'revision':5,'confirm':True},'POST');assert new.status_code==200 and new.json['item']['code']!=code
    assert change(c,student,'/classes/join',{'code':code},'POST').status_code==404
    assert change(c,student,'/classes/join',{'code':new.json['item']['code']},'POST').status_code==200


def test_creation_idempotency_returns_same_object_and_rejects_changed_body(app):
    c=app.test_client();h={**teacher(c),'Idempotency-Key':'test-key-1234567890'}
    first=change(c,h,'/classes',{'name':'Unica'},'POST');second=change(c,h,'/classes',{'name':'Unica'},'POST')
    assert first.status_code==201 and second.status_code==201 and first.json==second.json
    assert change(c,h,'/classes',{'name':'Outra'},'POST').status_code==409
    with Session(app.extensions['engine']) as db:assert db.scalar(select(func.count()).select_from(Turma).where(Turma.nome=='Unica'))==1


def test_new_crud_routes_reject_other_owners_and_student_roles(app):
    c=app.test_client();student=login(c)
    with Session(app.extensions['engine']) as db:
        db.add(Usuario(id_usuario='33333333-3333-4333-8333-333333333333',nome='Outro',email='outro@lise.demo',perfil='Professor'));db.commit()
    other=login(c,'outro@lise.demo')
    for method,path in [('PATCH','/classes/1'),('POST','/classes/1/archive'),('POST','/classes/1/restore'),('POST','/classes/1/code'),('DELETE','/classes/1'),('PATCH','/trails/1'),('POST','/trails/1/archive'),('PATCH','/classes/1/assignments/1'),('POST','/classes/1/assignments/1/archive')]:
        assert change(c,student,path,{'revision':1},method).status_code==403,path
        assert change(c,other,path,{'revision':1},method).status_code==404,path


def test_unused_archived_class_can_be_deleted_but_dependents_cannot(app):
    c=app.test_client();h=teacher(c)
    row=change(c,h,'/classes',{'name':'Descartavel'},'POST').json
    assert change(c,h,f"/classes/{row['id']}",{'revision':1,'confirmation':'Descartavel'},'DELETE').status_code==400
    change(c,h,f"/classes/{row['id']}/archive",{'revision':1},'POST')
    assert change(c,h,f"/classes/{row['id']}",{'revision':2,'confirmation':'Descartavel'},'DELETE').status_code==200
    change(c,h,'/classes/1/archive',{'revision':1},'POST')
    assert change(c,h,'/classes/1',{'revision':2,'confirmation':'Biologia — demonstração'},'DELETE').status_code==409


def test_personal_term_crud_impact_archive_and_used_content_preserved(app):
    c=app.test_client();h=teacher(c);student=login(c)
    made=change(c,h,'/terms',{'context':'trail','name':'Termoalfa','definition':'Definição inicial','class_ids':[1]},'POST').json['term'];ident=made['id']
    trail=change(c,h,'/trails',{'name':'Pessoal','term_ids':[ident],'class_ids':[1]},'POST').json['trail']
    assert change(c,h,f'/my-terms/{ident}',{'revision':1,'name':'Termobeta','definition':'Mudou'}).status_code==409
    assert change(c,h,f'/my-terms/{ident}',{'revision':1,'name':'Termobeta','definition':'Mudou','confirm_impact':True}).status_code==200
    assert change(c,h,f'/my-terms/{ident}/archive',{'revision':2},'POST').status_code==200
    assert all(t['id']!=ident for t in c.get('/api/v1/explore',headers=student).json['terms'])
    d=c.get(f"/api/v1/trails/{trail['id']}",headers=h).json['trail'];assert d['term_items'][0]['id']==ident
    assert change(c,h,f'/my-terms/{ident}',{'revision':3},'DELETE').status_code==409
    assert change(c,student,f'/my-terms/{ident}',{'revision':3},'DELETE').status_code==404
    assert change(c,h,f'/my-terms/{ident}/restore',{'revision':3},'POST').status_code==200
    assert change(c,h,f'/my-terms/{ident}/duplicate',{},'POST').status_code==201


def test_trail_update_order_and_practiced_term_cannot_be_removed(app):
    c=app.test_client();h=teacher(c);student=login(c)
    made=change(c,h,'/trails/1',{'revision':1,'name':'Ordenada','description':'d','area':'a','term_ids':[3,2,1]})
    assert made.status_code==200 and [t['id'] for t in made.json['trail']['term_items']]==[3,2,1]
    assert change(c,h,'/trails/1',{'revision':1,'name':'Perda'}).status_code==409
    with Session(app.extensions['engine']) as db:db.add(Progresso(fk_usuario=ALUNO_ID,fk_turma_trilha=1,fk_termo=3,jogado=True));db.commit()
    assert change(c,h,'/trails/1',{'revision':2,'name':'x','term_ids':[1,2]}).status_code==409
    assert change(c,h,'/trails/1/archive',{'revision':2},'POST').status_code==200
    assert c.get('/api/v1/dashboard',headers=h).json['trails']==[]
    assert change(c,student,'/games/sessions',{'game':'decifrador','source_type':'trail','source_id':1},'POST').status_code==409
    assert change(c,h,'/trails/1/restore',{'revision':3},'POST').status_code==200


def test_assignment_archive_keeps_attempts_and_restore_reuses_same_id(app):
    c=app.test_client();h=teacher(c);student=login(c)
    game=change(c,student,'/games/sessions',{'game':'decifrador','source_type':'trail','source_id':1},'POST').json
    assert change(c,h,'/classes/1/assignments/1/archive',{'revision':1},'POST').status_code==200
    assert c.get('/api/v1/classes/1',headers=h).json['trails']==[]
    answer=change(c,student,f"/games/sessions/{game['session_id']}/answer",{'question_id':game['questions'][0]['id'],'answer':'errada'},'POST');assert answer.status_code==409
    assert c.get('/api/v1/classes/1/assignments/archived',headers=h).json['assignments'][0]['id']==1
    assert change(c,h,'/classes/1/assignments/1/restore',{'revision':2},'POST').status_code==200
    with Session(app.extensions['engine']) as db:assert db.get(GameSession,game['session_id']).fk_turma_trilha==1


def test_deadline_edit_and_membership_removal_dont_delete_history(app):
    c=app.test_client();h=teacher(c);student=login(c)
    assert change(c,h,'/classes/1/assignments/1',{'revision':1,'due_date':'2099-12-31'}).status_code==200
    assert change(c,h,'/classes/1/assignments/1',{'revision':1,'due_date':None}).status_code==409
    with Session(app.extensions['engine']) as db:db.add(Progresso(fk_usuario=ALUNO_ID,fk_turma_trilha=1,fk_termo=1,jogado=True));db.commit()
    assert change(c,h,f'/classes/1/students/{ALUNO_ID}',{'confirm':True},'DELETE').status_code==200
    assert c.get('/api/v1/classes/1',headers=student).status_code==404
    with Session(app.extensions['engine']) as db:assert db.scalar(select(Progresso.id).where(Progresso.fk_usuario==ALUNO_ID))
    assert change(c,student,'/classes/join',{'code':'LISE26'},'POST').status_code==200
    assert change(c,student,'/classes/1/leave',{'confirm':True},'POST').status_code==200


def test_assessment_cancel_close_reopen_preserve_old_grades(app):
    c=app.test_client();h=teacher(c);now=utcnow()
    config={'title':'Final','question_count':3,'pass_score':70,'content':'termos','mode':'termo_definicao','opens_at':(now+timedelta(hours=1)).isoformat(),'closes_at':(now+timedelta(hours=2)).isoformat()}
    first=change(c,h,'/classes/1/trails/1/assessment',config,'POST');assert first.status_code==200
    assert change(c,h,'/classes/1/assignments/1/assessment/cancel',{'revision':1},'POST').status_code==200
    assert change(c,h,'/classes/1/trails/1/assessment',{**config,'revision':2},'POST').status_code==200
    with Session(app.extensions['engine']) as db:
        a=db.scalar(select(Avaliacao));a.abre_em=now-timedelta(minutes=1)
        db.add(AvaliacaoSessao(id='historico',fk_avaliacao=a.id,fk_usuario=ALUNO_ID,total=3,corretas=3,pontuacao=100,nota_minima=70,aprovada=True,finalizada_em=now));db.commit()
    assert change(c,h,'/classes/1/assignments/1/assessment/close',{'revision':3},'POST').status_code==200
    reopened=change(c,h,'/classes/1/assignments/1/assessment/reopen',{'revision':4,'opens_at':(now+timedelta(minutes=1)).isoformat(),'closes_at':(now+timedelta(days=1)).isoformat()},'POST')
    assert reopened.status_code==200 and reopened.json['assessment']['window_version']==2
    with Session(app.extensions['engine']) as db:
        assert db.get(AvaliacaoSessao,'historico').pontuacao==100
        assert db.get(AvaliacaoSessao,'historico').janela_versao==1
        assert len(db.scalar(select(Avaliacao)).historico_janelas)==1


def test_collection_revision_and_request_cancellation_and_sessions(app):
    c=app.test_client();one=login(c);two=login(c);h=teacher(c)
    made=change(c,one,'/collections',{'name':'Minha','term_ids':[1]},'POST').json['collection']
    assert change(c,one,f"/collections/{made['id']}",{'revision':1,'name':'Renomeada'}).status_code==200
    assert change(c,h,f"/collections/{made['id']}",{'revision':2,'name':'Invasao'}).status_code==404
    req=change(c,one,'/account/requests',{'type':'acesso'},'POST').json['request']
    assert change(c,h,f"/account/requests/{req['id']}/cancel",{},'POST').status_code==404
    assert change(c,one,f"/account/requests/{req['id']}/cancel",{},'POST').status_code==200
    sessions=c.get('/api/v1/account/sessions',headers=two).json['sessions'];assert len(sessions)==2
    old=next(s for s in sessions if not s['current'])
    assert change(c,h,'/account/sessions/'+old['id'],{},'DELETE').status_code==404
    assert change(c,two,'/account/sessions/'+old['id'],{},'DELETE').status_code==200
    assert c.get('/api/v1/auth/me',headers=one).status_code==401
    assert c.get('/api/v1/auth/me',headers=two).status_code==200


def test_direct_account_deletion_requires_password_and_removes_app_data(app):
    c=app.test_client();h=login(c)
    assert change(c,h,'/account',delete_body(password='wrong'),'DELETE').status_code==400
    assert change(c,h,'/account',delete_body(confirmation='sim'),'DELETE').status_code==400
    assert c.get('/api/v1/auth/me',headers=h).status_code==200
    result=change(c,h,'/account',delete_body(),'DELETE');assert result.status_code==200 and result.json['auth_pending'] is False
    assert c.get('/api/v1/auth/me',headers=h).status_code==401
    assert change(c,{},'/auth/login',{'email':'aluno@lise.demo','password':'LiseDemo123!'},'POST').status_code==401
    with Session(app.extensions['engine']) as db:assert db.get(Usuario,ALUNO_ID) is None


def test_teacher_account_deletion_preserves_other_students_grades(app):
    c=app.test_client();h=teacher(c);student=login(c)
    with Session(app.extensions['engine']) as db:
        a=Avaliacao(fk_turma_trilha=1,fk_professor=PROFESSOR_ID,titulo='Final');db.add(a);db.flush()
        db.add(AvaliacaoSessao(id='nota-preservada',fk_avaliacao=a.id,fk_usuario=ALUNO_ID,total=3,pontuacao=100,finalizada_em=utcnow()));db.commit()
    result=change(c,h,'/account',delete_body(),'DELETE');assert result.status_code==200,result.json
    with Session(app.extensions['engine']) as db:
        assert db.get(Usuario,PROFESSOR_ID) is None
        assert db.get(AvaliacaoSessao,'nota-preservada').pontuacao==100
        assert db.get(Turma,1).fk_professor==SYSTEM_ID and db.get(Turma,1).arquivada_em
    assert c.get('/api/v1/classes/1',headers=student).status_code==200


def test_missing_auth_admin_configuration_removes_app_access_and_queues_provider(app):
    c=app.test_client();h=login(c)
    app.config.update(DEMO_MODE=False,SUPABASE_SECRET_KEY=None,
                      AUTH_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(
                          sign_in_with_password=lambda _:SimpleNamespace(user=SimpleNamespace(id=ALUNO_ID)))))
    result=change(c,h,'/account',delete_body(),'DELETE')
    assert result.status_code==202 and result.json['auth_pending'] is True
    assert c.get('/api/v1/auth/me',headers=h).status_code==401
    with Session(app.extensions['engine']) as db:
        assert db.get(Usuario,ALUNO_ID) is None
        assert db.get(ExclusaoAuthPendente,ALUNO_ID)


def test_provider_outbox_retries_without_restoring_access(app):
    c=app.test_client();h=login(c);calls=[];fail=[True]
    def provider_delete(ident):
        calls.append(ident)
        if fail[0]:raise RuntimeError('temporary')
    app.config.update(DEMO_MODE=False,AUTH_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=lambda _:SimpleNamespace(user=SimpleNamespace(id=ALUNO_ID)))),AUTH_ADMIN_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(admin=SimpleNamespace(delete_user=provider_delete))))
    deleted=change(c,h,'/account',delete_body(),'DELETE');assert deleted.status_code==202,deleted.json
    assert c.get('/api/v1/auth/me',headers=h).status_code==401
    with Session(app.extensions['engine']) as db:
        assert db.get(Usuario,ALUNO_ID) is None
        row=db.get(ExclusaoAuthPendente,ALUNO_ID);assert row;row.tentativa_em=utcnow()-timedelta(minutes=2);db.commit()
    fail[0]=False
    result=app.test_cli_runner().invoke(args=['process-account-deletions']);assert result.exit_code==0,result.output
    with Session(app.extensions['engine']) as db:assert db.get(ExclusaoAuthPendente,ALUNO_ID) is None
    assert calls==[ALUNO_ID,ALUNO_ID]


def test_archived_class_blocks_forged_area_practice_and_existing_answers(app):
    c=app.test_client();h=teacher(c);student=login(c)
    body={'game':'decifrador','source_type':'area','area':'Biologia Geral','class_id':1}
    started=change(c,student,'/games/sessions',body,'POST');assert started.status_code==201
    game=started.json
    assert change(c,h,'/classes/1/archive',{'revision':1},'POST').status_code==200
    assert change(c,student,'/games/sessions',body,'POST').status_code==409
    assert change(c,student,f"/games/sessions/{game['session_id']}/answer",{'question_id':game['questions'][0]['id'],'answer':'errada'},'POST').status_code==409
    with Session(app.extensions['engine']) as db:assert db.get(Partida,game['questions'][0]['id']).respondida is False


def test_open_assessment_content_protection_applies_to_old_add_routes(app):
    c=app.test_client();h=teacher(c)
    with Session(app.extensions['engine']) as db:
        db.add(Avaliacao(fk_turma_trilha=1,fk_professor=PROFESSOR_ID,titulo='Aberta',abre_em=utcnow()-timedelta(minutes=1),encerra_em=utcnow()+timedelta(days=1)))
        original=list(db.scalars(select(TrilhaTermo.fk_termo).where(TrilhaTermo.fk_trilha==1)));db.commit()
    assert change(c,h,'/trails/1',{'revision':1,'name':'Alterada','term_ids':[1,2,3,4]}).status_code==409
    assert change(c,h,'/trails/1/terms',{'term_ids':[4]},'POST').status_code==409
    assert change(c,h,'/terms',{'context':'trail','name':'Bypass','definition':'Teste','trail_ids':[1]},'POST').status_code==409
    with Session(app.extensions['engine']) as db:
        assert list(db.scalars(select(TrilhaTermo.fk_termo).where(TrilhaTermo.fk_trilha==1)))==original
        assert db.get(Trilha,1).revisao==1
        assert db.scalar(select(Termo).where(Termo.palavra_completa=='Bypass')) is None


def test_archiving_and_editing_term_preserve_existing_question_snapshot(app):
    c=app.test_client();h=teacher(c);student=login(c)
    made=change(c,h,'/terms',{'context':'personal','name':'Alfatermo','definition':'Definição original'},'POST').json['term']
    trail=change(c,h,'/trails',{'name':'Snapshot','term_ids':[made['id']],'class_ids':[1]},'POST').json['trail']
    with Session(app.extensions['engine']) as db:assignment=db.scalar(select(TurmaTrilha.id).where(TurmaTrilha.fk_trilha==trail['id']))
    game=change(c,student,'/games/sessions',{'game':'decifrador','source_type':'trail','source_id':assignment},'POST').json
    assert change(c,h,f"/my-terms/{made['id']}",{'revision':1,'name':'Betatermo','definition':'Nova definição','confirm_impact':True}).status_code==200
    assert change(c,h,f"/my-terms/{made['id']}/archive",{'revision':2},'POST').status_code==200
    answer=change(c,student,f"/games/sessions/{game['session_id']}/answer",{'question_id':game['questions'][0]['id'],'answer':'Alfatermo'},'POST')
    assert answer.status_code==200 and answer.json['correct'] is True
    assert answer.json['feedback']['correct_answer']=='Alfatermo'
    assert change(c,student,f"/games/sessions/{game['session_id']}/finish",{},'POST').status_code==200


def test_provider_reauthentication_must_match_account_being_deleted(app):
    c=app.test_client();h=login(c);calls=[]
    app.config.update(DEMO_MODE=False,AUTH_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=lambda _:SimpleNamespace(user=SimpleNamespace(id=PROFESSOR_ID)))),AUTH_ADMIN_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(admin=SimpleNamespace(delete_user=lambda ident:calls.append(ident)))))
    assert change(c,h,'/account',delete_body(user_id=PROFESSOR_ID),'DELETE').status_code==400
    with Session(app.extensions['engine']) as db:
        assert db.get(Usuario,ALUNO_ID) and db.get(Usuario,PROFESSOR_ID)
        assert db.scalar(select(ExclusaoAuthPendente.id)) is None
    assert calls==[]
