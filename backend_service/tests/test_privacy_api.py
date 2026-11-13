import json
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from test_api import app, login
from backend.demo import ALUNO_ID
from backend.models import AceiteLegal, PedidoPrivacidade, Usuario
from backend.privacy_api import LEGAL_VERSION


def publish(app):
    app.config.update(PRIVACY_PUBLICATION_READY=True, PRIVACY_CONTROLLER='Equipe teste',
                      PRIVACY_EMAIL='privacidade@example.test')


def test_public_documents_routes_storage_and_escaping(app):
    c = app.test_client()
    for slug in ('privacidade', 'termos-de-uso', 'cookies'):
        r = c.get('/api/v1/legal/' + slug)
        assert r.status_code == 200 and r.json['version'] == LEGAL_VERSION
        assert r.json['ready'] is False and r.json['html']
        assert c.get('/' + slug).location == 'https://lise.example/#' + slug
    cookies = c.get('/api/v1/legal/cookies').json['html']
    assert 'lise_access_token' in cookies and 'lise_sidebar_collapsed' in cookies
    assert '<th scope="row">session</th>' not in cookies
    assert 'fonts.googleapis.com' not in cookies
    app.config['PRIVACY_CONTROLLER'] = '<script>bad()</script>'
    content = c.get('/api/v1/legal/privacidade').json['html']
    assert '&lt;script&gt;' in content and '<script>bad()' not in content
    assert c.get('/api/v1/legal/desconhecido').status_code == 404


def test_account_routes_require_bearer_and_ignore_cookies(app):
    c = app.test_client()
    for method, path in [('get','/account'), ('patch','/account/name'), ('post','/account/data'),
                         ('post','/account/terms'), ('post','/account/requests'),
                         ('post','/account/sessions/revoke')]:
        assert getattr(c, method)('/api/v1'+path).status_code == 401
    h = login(c)
    assert c.get('/api/v1/account', headers=h).status_code == 200
    # A sessão autenticada é exclusivamente o token explícito, sem cookie implícito.
    assert c.post('/api/v1/account/requests', json={'type':'acesso'}).status_code == 401
    assert c.get('/api/v1/account/data', headers=h).status_code == 405
    assert c.options('/api/v1/account/requests', headers={'Origin':'https://lise.example'}).headers['Access-Control-Allow-Origin'] == 'https://lise.example'


def test_name_only_changes_own_account_and_keeps_avatar(app):
    c = app.test_client(); h = login(c)
    c.patch('/api/v1/auth/profile', headers=h, json={'avatar':'fox'})
    for value in ('a', ' ', 'a'*151, None, [], {}):
        assert c.patch('/api/v1/account/name', headers=h, json={'name':value}).status_code == 400
    r = c.patch('/api/v1/account/name', headers=h, json={'name':' Nome corrigido '})
    assert r.json['name'] == 'Nome corrigido'
    user = c.get('/api/v1/auth/me', headers=h).json['user']
    assert user['name'] == 'Nome corrigido' and user['avatar'] == 'fox'
    teacher = c.get('/api/v1/auth/me', headers=login(c,'professor@lise.demo')).json['user']
    assert teacher['name'] != 'Nome corrigido'


def test_export_includes_new_data_but_no_hashes_tokens_answers_or_peers(app):
    c = app.test_client(); h = login(c)
    collection = c.post('/api/v1/collections', headers=h, json={'name':'Pessoal','term_ids':[1,2]}).json['collection']
    c.post('/api/v1/games/sessions', headers=h, json={'game':'bioquiz','source_type':'collection','source_id':collection['id']})
    c.post('/api/v1/account/requests', headers=h, json={'type':'acesso','details':'Meus dados'})
    teacher_h = login(c,'professor@lise.demo')
    c.post('/api/v1/account/requests', headers=teacher_h, json={'type':'outro','details':'PRIVADO_DO_PROFESSOR'})
    r = c.post('/api/v1/account/data', headers=h, json={})
    assert r.status_code == 200 and r.headers['Cache-Control'] == 'no-store'
    assert 'attachment' in r.headers['Content-Disposition']
    data = r.json; text = r.get_data(as_text=True)
    assert data['conta']['id_usuario'] == ALUNO_ID
    for private in ('demo_password_hash','resposta_esperada','lise_sessoes','PRIVADO_DO_PROFESSOR','professor@lise.demo',h['Authorization'][7:]):
        assert private not in text
    assert data['lise_colecoes'] and data['lise_colecao_termos'] and data['lise_game_sessions']
    assert data['lise_game_session_questions'] and all('payload' not in row for row in data['lise_game_session_questions'])
    for table in ('lise_colecoes','lise_game_sessions','lise_pedidos_privacidade'):
        assert all(row['fk_usuario'] == ALUNO_ID for row in data[table])


def test_requests_deduplication_validation_deletion_and_isolation(app):
    c = app.test_client(); h = login(c)
    for data in ({'type':[]}, {'type':'bad'}, {'type':'acesso','details':{}},
                 {'type':'acesso','details':'x'*2001}, {'type':'exclusao'}):
        assert c.post('/api/v1/account/requests', headers=h, json=data).status_code == 400
    first = c.post('/api/v1/account/requests', headers=h, json={'type':'acesso','details':'Dados pessoais'})
    repeat = c.post('/api/v1/account/requests', headers=h, json={'type':'acesso'})
    assert repeat.json['request']['id'] == first.json['request']['id']
    deletion = c.post('/api/v1/account/requests', headers=h, json={'type':'exclusao','confirm_delete':'EXCLUIR'})
    assert deletion.status_code == 400
    with Session(app.extensions['engine']) as db:
        assert db.get(Usuario,ALUNO_ID) is not None
        assert db.scalar(select(func.count()).select_from(PedidoPrivacidade)) == 1
    teacher = c.get('/api/v1/account', headers=login(c,'professor@lise.demo'))
    assert teacher.json['requests'] == []


def test_request_rate_limit(app):
    c = app.test_client(); h = login(c)
    with Session(app.extensions['engine']) as db:
        for i in range(5):
            db.add(PedidoPrivacidade(id=f'old-{i}',fk_usuario=ALUNO_ID,tipo='outro',status='concluido'))
        db.commit()
    assert c.post('/api/v1/account/requests',headers=h,json={'type':'acesso'}).status_code == 429


def test_revoke_all_sessions_preserves_other_users(app):
    c = app.test_client(); one = login(c); two = login(c); teacher = login(c,'professor@lise.demo')
    assert c.post('/api/v1/account/sessions/revoke',headers=one).status_code == 200
    for h in (one,two):
        assert c.get('/api/v1/auth/me',headers=h).status_code == 401
    assert c.get('/api/v1/auth/me',headers=teacher).status_code == 200


def test_version_gate_keeps_rights_and_profile_available_and_accepts_once(app):
    c = app.test_client(); h = login(c); publish(app)
    response = c.get('/api/v1/dashboard',headers=h)
    assert response.status_code == 403 and response.json['code'] == 'terms_required'
    for path in ('/auth/me','/account','/legal/privacidade'):
        assert c.get('/api/v1'+path,headers=h).status_code == 200
    assert c.patch('/api/v1/auth/profile',headers=h,json={'avatar':'owl'}).status_code == 200
    assert c.post('/api/v1/account/data',headers=h).status_code == 200
    assert c.post('/api/v1/account/requests',headers=h,json={'type':'acesso'}).status_code == 201
    for data in ({'accept_terms':'true','legal_version':LEGAL_VERSION}, {'accept_terms':True,'legal_version':'old'}):
        assert c.post('/api/v1/account/terms',headers=h,json=data).status_code == 400
    for _ in range(2):
        assert c.post('/api/v1/account/terms',headers=h,json={'accept_terms':True,'legal_version':LEGAL_VERSION}).status_code == 200
    with Session(app.extensions['engine']) as db:
        assert db.scalar(select(func.count()).select_from(AceiteLegal)) == 1
    assert c.get('/api/v1/dashboard',headers=h).status_code == 200


def test_unpublished_terms_do_not_block_activities_or_allow_acceptance(app):
    c = app.test_client(); h = login(c)
    assert c.get('/api/v1/dashboard',headers=h).status_code == 200
    assert c.post('/api/v1/account/terms',headers=h,json={'accept_terms':True,'legal_version':LEGAL_VERSION}).status_code == 503


def test_registration_requires_current_terms_before_contacting_supabase(app):
    calls=[]
    fake = SimpleNamespace(auth=SimpleNamespace(sign_up=lambda payload:calls.append(payload)))
    app.config.update(DEMO_MODE=False,AUTH_FACTORY=lambda:fake)
    c = app.test_client()
    data={'name':'Pessoa teste','email':'pessoa@example.test','password':'SenhaSegura123','role':'ALUNO',
          'accept_terms':True,'legal_version':LEGAL_VERSION}
    for patch in ({'accept_terms':False},{'accept_terms':'on'},{'legal_version':'old'}):
        assert c.post('/api/v1/auth/register',json={**data,**patch}).status_code == 400
        assert not calls
    # Mantém a decisão anterior: cadastro sem bloqueio por publicação ou campo etário.
    assert c.post('/api/v1/auth/register',json=data).status_code == 201
    meta=calls[0]['options']['data']
    assert meta['termos_versao'] == meta['privacidade_versao'] == LEGAL_VERSION


def test_cli_response_is_visible_only_to_request_owner(app,tmp_path):
    c=app.test_client(); h=login(c)
    c.post('/api/v1/account/requests',headers=h,json={'type':'acesso','details':'Detalhe privado'})
    runner=app.test_cli_runner(); result=runner.invoke(args=['privacy-requests'])
    assert result.exit_code == 0 and 'Detalhe privado' not in result.output
    ident=json.loads(result.output)['protocolo']
    answer=tmp_path/'resposta.txt'; answer.write_text('Resposta ao titular.',encoding='utf-8')
    result=runner.invoke(args=['privacy-resolve',ident,'--status','concluido','--response-file',str(answer)])
    assert result.exit_code == 0
    assert c.get('/api/v1/account',headers=h).json['requests'][0]['response'] == 'Resposta ao titular.'
    assert runner.invoke(args=['privacy-requests']).output == ''
