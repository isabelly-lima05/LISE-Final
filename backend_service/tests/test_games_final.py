"""Regression coverage for session creation and all memory modes."""
import pytest
from sqlalchemy.orm import Session
from test_api import app, login
from backend.models import Partida
from backend.rest_api import _make_questions

@pytest.mark.parametrize('game,mode', [
    ('bioquiz','misto'), ('bioquiz','termo_definicao'), ('bioquiz','definicao_termo'),
    ('bioquiz','radical_significado'), ('bioquiz','significado_radical'),
    ('memoria','termo_definicao'), ('memoria','radical_significado'),
    ('familia_palavras','termo_definicao'), ('decifrador','termo_definicao'),
])
def test_every_game_and_mode_completes_idempotently(app, game, mode):
    c=app.test_client(); h=login(c)
    source={'source_type':'area','area':'Biologia Geral'}
    available=c.post('/api/v1/games/availability',headers=h,json=source)
    assert available.status_code==200
    status=next(x for x in available.json['games'] if x['game']==game and x['mode']==mode)
    assert status['available'], status
    start=c.post('/api/v1/games/sessions',headers=h,json={**source,'game':game,'mode':mode})
    assert start.status_code==201, start.json
    data=start.json; base=f"/api/v1/games/sessions/{data['session_id']}"
    for q in data['questions']:
        with Session(app.extensions['engine']) as db:
            expected=db.get(Partida,q['id']).resposta_esperada
        if game=='memoria':
            for i,pair in enumerate(expected):
                matched=c.post(base+'/match',headers=h,json={'question_id':q['id'],'pair':pair,'attempt_id':f'pair-{i}'})
                assert matched.status_code==200 and matched.json['match'], matched.json
        answer=c.post(base+'/answer',headers=h,json={'question_id':q['id'],'answer':expected})
        assert answer.status_code==200 and answer.json['correct'], answer.json
        duplicate=c.post(base+'/answer',headers=h,json={'question_id':q['id'],'answer':expected})
        assert duplicate.json['xp']==answer.json['xp']
    finished=c.post(base+'/finish',headers=h,json={})
    assert finished.status_code==200 and finished.json['score']==100
    assert c.post(base+'/finish',headers=h,json={}).json==finished.json


def test_family_feedback_reports_wrong_selection(app):
    c=app.test_client();h=login(c)
    data=c.post('/api/v1/games/sessions',headers=h,json={'game':'familia_palavras','source_type':'area','area':'Biologia Geral'}).json
    q=data['questions'][0]
    with Session(app.extensions['engine']) as db: expected=set(db.get(Partida,q['id']).resposta_esperada)
    wrong=next((o for o in q['options'] if o['id'] not in expected),None)
    assert wrong is not None
    answer=c.post(f"/api/v1/games/sessions/{data['session_id']}/answer",headers=h,json={'question_id':q['id'],'answer':[wrong['id']]}).json
    assert wrong['name'] in answer['feedback']['incorrect_terms']
    assert answer['feedback']['definition']


def test_radical_memory_avoids_ambiguous_labels():
    views=[{'id':i,'name':f'Termo {i}','definition':f'Definição {i}',
            'radical_list':[{'radical_id':i,'text':f'r{i}','meaning':'igual' if i<3 else f'm{i}'}]}
           for i in range(1,5)]
    questions=_make_questions('memoria',views,mode='radical_significado',priority_ids={i:(0,0) for i in range(1,5)})
    assert len(questions[0][2]['cards'])==4
