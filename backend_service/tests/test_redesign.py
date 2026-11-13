from test_api import app, login
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.models import Partida, GameQuestion, Usuario


def test_new_profile_starts_with_neutral_avatar_placeholder(app):
    with Session(app.extensions['engine']) as db:
        user=Usuario(id_usuario='44444444-4444-4444-8444-444444444444',nome='Conta nova',email='nova@lise.demo',perfil='Aluno')
        db.add(user);db.flush()
        assert user.avatar=='placeholder'


def test_all_ten_avatars_persist_and_invalid_values_are_rejected(app):
    client=app.test_client(); headers=login(client)
    for avatar in ('leaf','cell','owl','turtle','monkey','mantis','butterfly','fox','frog','whale'):
        saved=client.patch('/api/v1/auth/profile',headers=headers,json={'avatar':avatar})
        assert saved.status_code==200
        assert client.get('/api/v1/auth/me',headers=headers).json['user']['avatar']==avatar
    assert client.patch('/api/v1/auth/profile',headers=headers,json={'avatar':'../../bad'}).status_code==400
    client.post('/api/v1/auth/logout',headers=headers,json={})
    assert client.get('/api/v1/auth/me',headers=headers).status_code==401
    assert client.get('/api/v1/auth/me',headers=login(client)).json['user']['avatar']=='whale'


def test_context_role_and_combined_mine_filter(app):
    client=app.test_client(); headers=login(client)
    assert client.post('/api/v1/terms',headers=headers,json={'context':'trail','name':'x','definition':'y'}).status_code==403
    assert client.post('/api/v1/me/terms',headers=headers,json={'name':'x','definition':'y'}).status_code==400
    made=client.post('/api/v1/me/terms',headers=headers,json={'context':'collection','name':'Minha célula','definition':'Definição pessoal'})
    assert made.status_code==201
    data=client.get('/api/v1/explore?kind=terms&mine=1&search=célula',headers=headers).json
    assert [t['id'] for t in data['terms']]==[made.json['term']['id']]
    assert data['radicals']==[]
    assert made.json['term']['radical_list']==[]


def test_fixed_round_counts_availability_and_unique_targets(app):
    client=app.test_client(); h=login(client)
    source={'source_type':'area','area':'Biologia Geral'}
    available=client.post('/api/v1/games/availability',headers=h,json=source)
    assert available.status_code==200
    for count in (1,30):
        response=client.post('/api/v1/games/sessions',headers=h,json={**source,'game':'bioquiz','mode':'misto','question_count':count})
        assert response.status_code==201
        with Session(app.extensions['engine']) as db:
            terms=[db.get(Partida,q['id']).fk_termo for q in response.json['questions']]
        assert len(terms)==len(set(terms))
        assert len(terms)<=10
    memory=client.post('/api/v1/games/sessions',headers=h,json={**source,'game':'memoria','question_count':30})
    assert len(memory.json['questions'][0]['cards'])==10 # Reduced: five active terms in this area.


def test_collection_history_shared_between_games_and_idempotent(app):
    client=app.test_client(); h=login(client)
    collection=client.post('/api/v1/collections',headers=h,json={'name':'Revisão','term_ids':[1,2,3]}).json['collection']
    source={'source_type':'collection','source_id':collection['id']}
    game=client.post('/api/v1/games/sessions',headers=h,json={**source,'game':'decifrador'}).json
    q=game['questions'][0]
    with Session(app.extensions['engine']) as db: expected=db.get(Partida,q['id']).resposta_esperada
    for _ in range(2):
        r=client.post(f"/api/v1/games/sessions/{game['session_id']}/answer",headers=h,json={'question_id':q['id'],'answer':expected})
        assert r.status_code==200
    detail=client.get(f"/api/v1/collections/{collection['id']}",headers=h).json['collection']['learning']
    assert detail['attempts']==1 and detail['practiced']==1 and detail['correct']==1
    assert detail['consistent']==0
    quiz=client.post('/api/v1/games/sessions',headers=h,json={**source,'game':'bioquiz','mode':'termo_definicao'}).json
    with Session(app.extensions['engine']) as db:
        practiced=db.get(Partida,q['id']).fk_termo
        ordered=[db.get(Partida,item['id']).fk_termo for item in quiz['questions']]
    assert ordered[-1]==practiced


def test_memory_attempt_retry_does_not_duplicate_learning(app):
    client=app.test_client(); h=login(client)
    game=client.post('/api/v1/games/sessions',headers=h,json={'source_type':'area','area':'Biologia Geral','game':'memoria'}).json
    q=game['questions'][0]
    with Session(app.extensions['engine']) as db: pairs=db.get(Partida,q['id']).resposta_esperada
    pair=[pairs[0][0],pairs[1][0]]
    body={'question_id':q['id'],'pair':pair,'attempt_id':'retry-id'}
    first=client.post(f"/api/v1/games/sessions/{game['session_id']}/match",headers=h,json=body)
    again=client.post(f"/api/v1/games/sessions/{game['session_id']}/match",headers=h,json=body)
    assert not first.json['match'] and again.json['duplicate']
    assert first.json['attempts']==again.json['attempts']==1
