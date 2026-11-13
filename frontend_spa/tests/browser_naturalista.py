"""QA do frontend real com API Flask e SQLite isolados, sem rede de produção.

Executar: python frontend_spa/tests/browser_naturalista.py
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from run_demo import create_demo_app
from playwright.sync_api import sync_playwright
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.models import AvaliacaoQuestao, Partida, Termo, TurmaTrilha, Usuario
from backend.services import normalize

BASE='http://127.0.0.1:5001'
OUT=ROOT/'validacao_local'


def main():
    app=create_demo_app(database_url='sqlite:///:memory:')
    client=app.test_client();checks=[];errors=[];external=[];sessions=[];assessments=[];traffic=[]
    offline={'explore':False}
    def api(path,method='GET',body=None,headers=None):
        return client.open('/api/v1'+path,method=method,json=body,headers=headers or {})
    def login_api(email):
        r=api('/auth/login','POST',{'email':email,'password':'LiseDemo123!'})
        assert r.status_code==200,r.json
        return {'Authorization':'Bearer '+r.json['access_token']}
    student_h=login_api('aluno@lise.demo');teacher_h=login_api('professor@lise.demo')
    collection=api('/collections','POST',{'name':'Caderno de campo','term_ids':[1,2,3]},student_h).json['collection']
    with Session(app.extensions['engine']) as db:
        db.add(Usuario(id_usuario='33333333-3333-4333-8333-333333333333',nome='Professor Sem Turmas',email='vazio.professor@lise.demo',perfil='Professor'))
        db.add(Usuario(id_usuario='44444444-4444-4444-8444-444444444444',nome='Aluno Sem Turmas',email='vazio.aluno@lise.demo',perfil='Aluno'))
        for i in range(20):
            db.add(Termo(palavra_completa=f'Palavra de campo {i:02}',definicao_biologica=f'Definição fictícia da palavra de campo {i}.',fk_area=2))
        db.add(Termo(palavra_completa='Uma palavra com nome muito extenso para observar a quebra em telas pequenas',definicao_biologica='Texto fictício para testar responsividade. '*12,fk_area=2))
        db.commit()
    trail=api('/trails','POST',{'name':'Trilha para avaliação','term_ids':[1,2,3],'class_ids':[1]},teacher_h).json['trail']
    with Session(app.extensions['engine']) as db:
        assignment=db.scalar(select(TurmaTrilha.id).where(TurmaTrilha.fk_trilha==trail['id']))
    now=datetime.now(timezone.utc)
    r=api(f'/classes/1/trails/{assignment}/assessment','POST',{'title':'Avaliação local','question_count':3,
         'content':'termos','mode':'termo_definicao','pass_score':70,
         'opens_at':(now-timedelta(minutes=5)).isoformat(),'closes_at':(now+timedelta(days=1)).isoformat()},teacher_h)
    assert r.status_code==200,r.json
    practice=api('/games/sessions','POST',{'game':'decifrador','source_type':'trail','source_id':assignment},student_h).json
    for q in practice['questions']:
        api(f"/games/sessions/{practice['session_id']}/answer",'POST',{'question_id':q['id'],'answer':'errada'},student_h)
    api(f"/games/sessions/{practice['session_id']}/finish",'POST',{},student_h)

    def route_request(route):
        req=route.request;url=urlsplit(req.url)
        if url.hostname!='127.0.0.1':external.append(req.url);route.abort();return
        if offline['explore'] and url.path=='/api/v1/explore':route.abort();return
        headers={k:v for k,v in req.headers.items() if k in ('authorization','content-type','origin','idempotency-key')}
        target='/' if url.path in ('/privacidade','/termos-de-uso','/cookies') else url.path
        response=client.open(target+('?' +url.query if url.query else ''),method=req.method,data=req.post_data,headers=headers)
        traffic.append((req.method,url.path,response.status_code))
        if req.method=='POST' and url.path=='/api/v1/games/sessions' and response.status_code==201:sessions.append(response.json)
        if req.method=='POST' and url.path.endswith('/assessment/sessions') and response.status_code==201:assessments.append(response.json)
        route.fulfill(status=response.status_code,headers=dict(response.headers),body=response.data)

    def check(label,condition=True):
        assert condition,label
        checks.append(label)

    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        def new_page():
            context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
            context.route('**/*',route_request)
            page=context.new_page();page.set_default_timeout(12000)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('dialog',lambda d:d.accept())
            return page
        page=new_page()
        def login(page,email):
            page.goto(BASE+'/');page.locator('[name=email]').fill(email);page.locator('[name=password]').fill('LiseDemo123!');page.locator('[type=submit]').click();page.locator('main .page-title').wait_for()
        def nav(page,view):
            if page.viewport_size['width']<1024:
                page.get_by_role('button',name='Abrir menu lateral',exact=True).click()
            page.locator(f'[data-action=navigate][data-view={view}]:visible').first.click()
            page.locator('main .page-title').wait_for()
        def no_overflow(page):
            return page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        def screenshot(page,name):
            page.mouse.move(1000,20);page.screenshot(path=str(OUT/name),full_page=True)

        page.goto(BASE+'/privacidade');page.get_by_role('heading',name='Política de Privacidade',exact=True).wait_for()
        page.get_by_role('link',name='Cookies',exact=True).click();page.get_by_role('rowheader',name='lise_access_token').wait_for()
        check('Documentos públicos e navegação entre documentos')
        page.goto(BASE+'/');page.get_by_role('button',name='Criar conta',exact=True).click()
        page.locator('[name=name]').fill('Cadastro Local');page.locator('[name=email]').fill('cadastro@example.test');page.locator('[name=password]').fill('SenhaCadastro123!')
        page.locator('[name=role][value=PROFESSOR]').check();page.locator('[name=accept_terms]').check()
        calls=[];app.config.update(DEMO_MODE=False,AUTH_FACTORY=lambda:SimpleNamespace(auth=SimpleNamespace(sign_up=lambda data:calls.append(data))))
        page.locator('[data-form=register] [type=submit]').click();page.locator('[data-form=login]').wait_for()
        check('Cadastro com seleção de perfil e aceite versionado',calls and calls[0]['options']['data']['perfil']=='Professor' and calls[0]['options']['data']['termos_versao'])
        app.config['DEMO_MODE']=True
        page.get_by_role('button',name='Esqueci minha senha',exact=True).click();page.locator('[name=email]').fill('aluno@lise.demo');page.locator('[type=submit]').click();page.locator('[data-form=login]').wait_for()
        check('Recuperação de acesso preservada')
        login(page,'aluno@lise.demo');page.locator('.discovery-body .word-name').wait_for()
        check('Descoberta do dia usa palavra real do catálogo',page.locator('.discovery-body .word-name').inner_text()!='')
        check('Coleções usam a contagem real', '3 termos' in page.locator('.collection-notes').inner_text())
        screenshot(page,'naturalista-inicio.png')
        page.get_by_role('button',name='Expandir menu lateral',exact=True).click()
        check('Lateral expandida reserva 240 px',page.locator('.sidebar').bounding_box()['width']==240)
        page.get_by_role('button',name='Recolher menu lateral',exact=True).click()
        check('Lateral recolhida reserva 72 px',page.locator('.sidebar').bounding_box()['width']==72)
        page.locator('.sidebar [data-view=explore]').hover()
        check('Tooltip visível ao passar o mouse',page.locator('.sidebar [data-view=explore] .side-label').evaluate("el=>getComputedStyle(el).visibility==='visible'"))
        nav(page,'explore');page.locator('.specimen-card').first.wait_for()
        check('Catálogo começa com 12 fichas',page.locator('.specimen-card').count()==12)
        page.get_by_role('button',name='Mostrar mais 12 palavras').click()
        check('Catálogo expande em lotes de 12',page.locator('.specimen-card').count()==24)
        page.locator('#explore-search').fill('fotossintese')
        page.wait_for_function("document.querySelectorAll('.specimen-card').length===1")
        check('Pesquisa ignora acentos e preserva a consulta na URL','search=fotossintese' in page.url)
        page.reload();page.locator('.specimen-card').first.wait_for()
        check('Filtros sobrevivem ao reload',page.locator('.specimen-card').count()==1 and page.locator('#explore-search').input_value()=='fotossintese')
        page.get_by_role('button',name='Limpar filtros').click()
        page.get_by_role('button',name='Estudar',exact=True).click()
        check('Estudo oculta definição antes da revelação',page.locator('.specimen-definition').count()==0)
        page.locator('[data-action=reveal-study]').first.click();page.locator('.specimen-definition').first.wait_for()
        check('Estudo revela ficha sem perder os demais cartões',page.locator('.specimen-definition').count()==1)
        page.get_by_role('button',name='Consultar',exact=True).click()
        page.locator('#explore-search').fill('palavra de campo 00');page.wait_for_function("document.querySelectorAll('.specimen-card').length===1")
        check('Termo sem curadoria não recebe anatomia inventada','ainda não disponível' in page.locator('.specimen-card').inner_text())
        page.get_by_role('button',name='Limpar filtros').click();screenshot(page,'naturalista-explorar.png')
        page.locator('[data-action=open-term]').first.click();page.locator('.word-sheet').wait_for()
        page.go_back();page.locator('#explore-results').wait_for()
        check('Voltar restaura o Explorador')
        nav(page,'collections');page.locator('[data-action=open-collection]').first.click();page.locator('.word-path').wait_for()
        check('Coleção exibe percurso de palavras',page.locator('.path-node').count()==3)
        page.reload();page.locator('.word-path').wait_for();check('Detalhe da coleção funciona após reload')
        # Criar uma palavra inline preserva o rascunho e a seleção da coleção.
        nav(page,'collections');page.get_by_role('button',name='Criar coleção',exact=True).click()
        page.locator('[data-form=collection-create] [name=name]').fill('Coleção criada no navegador')
        page.get_by_role('button',name='Criar novo termo',exact=True).click()
        page.locator('#inline-name').fill('Termo privado do navegador');page.locator('#inline-definition').fill('Definição local, sem decomposição automática.')
        page.get_by_role('button',name='Criar e selecionar',exact=True).click()
        page.wait_for_function("document.querySelector('[data-role=selected-count]').textContent==='1'")
        check('Criação inline preserva o nome da coleção',page.locator('[data-form=collection-create] [name=name]').input_value()=='Coleção criada no navegador')
        page.get_by_role('button',name='Salvar coleção',exact=True).click();page.locator('.collection-cover').first.wait_for()
        check('Coleção e termo personalizado são gravados')

        # Os quatro jogos exercitam as rotas reais com respostas do banco de teste.
        for game in ('bioquiz','familia_palavras','memoria','decifrador'):
            nav(page,'games');page.locator(f'[data-action=select-game][data-game={game}]').click()
            page.locator('[data-action=choose-source][data-type=area][data-name="Biologia Geral"]').click()
            page.locator('[data-form=game-config] [type=submit]').wait_for(state='visible')
            page.wait_for_function("!document.querySelector('[data-form=game-config] [type=submit]').disabled")
            page.locator('[data-form=game-config] [type=submit]').click()
            page.locator('.question-title').wait_for()
            page.set_viewport_size({'width':360,'height':900})
            check(f'{game}: exercício sem rolagem horizontal em 360px',no_overflow(page))
            page.set_viewport_size({'width':1440,'height':1000})
            session=sessions[-1];q=session['questions'][0]
            with Session(app.extensions['engine']) as db:expected=db.get(Partida,q['id']).resposta_esperada
            if game=='memoria':
                for i,pair in enumerate(expected):
                    for ident in pair:page.locator(f'[data-action=memory-card][data-card="{ident}"]').click()
                    if i<len(expected)-1:page.wait_for_function('(count)=>document.querySelectorAll(".memory-card.matched").length===count',arg=(i+1)*2)
            elif game=='decifrador':
                check('Decifrador não revela elementos da resposta antes da resolução',page.locator('.question .anatomy-parts').count()==0 and 'Radicais:' not in page.locator('.question').inner_text())
                used=set()
                for slot,char in enumerate(expected):
                    index=next(i for i,letter in enumerate(q['letters']) if i not in used and normalize(letter)==char);used.add(index)
                    page.locator(f'[data-action=decipher-letter][data-letter-index="{index}"]').click()
                    page.locator(f'[data-action=decipher-slot][data-slot-index="{slot}"]').click()
                page.locator('[data-form=game-answer] [type=submit]').click()
            elif game=='familia_palavras':
                for ident in expected:page.locator(f'[name=answer][value="{ident}"]').check()
                page.locator('[data-form=game-answer] [type=submit]').click()
            else:
                page.locator(f'[name=answer][value="{expected}"]').check();page.locator('[data-form=game-answer] [type=submit]').click()
            page.locator('.feedback.good').wait_for();check(f'{game}: resposta validada pela API e feedback correto')

        # Avaliação formal após prática completa, com janela configurada no servidor.
        nav(page,'classes');page.locator('[data-action=open-class]').first.click();page.locator(f'[data-action=start-assessment][data-assignment="{assignment}"]').click()
        page.locator('[data-form=assessment-answer]').wait_for()
        assessment=assessments[-1]
        for i,q in enumerate(assessment['questions']):
            with Session(app.extensions['engine']) as db:expected=db.get(AvaliacaoQuestao,q['id']).resposta_esperada
            page.locator(f'[name=answer][value="{expected}"]').check();page.locator('[data-form=assessment-answer] [type=submit]').click()
            page.locator('[data-action=assessment-next]').wait_for();page.locator('[data-action=assessment-next]').click()
            if i<len(assessment['questions'])-1:page.locator('[data-form=assessment-answer]').wait_for()
        page.get_by_text('Avaliação concluída',exact=True).wait_for();check('Avaliação formal mantém respostas, conclusão e resultado',page.get_by_role('heading',name='100%',exact=True).count()==1)

        page.goto(BASE+'/#profile');page.locator('.avatar-edit').wait_for();page.locator('[data-ui=avatar]').click();page.locator('.avatar-option').first.wait_for()
        check('Link antigo do perfil abre a aba Perfil',page.locator('.avatar-option').count()==10 and '#conta/perfil' in page.url)
        page.locator('[data-choice=fox]').click();page.get_by_role('button',name='Salvar avatar',exact=True).click();page.locator('.interaction-dialog').wait_for(state='detached')
        page.reload();page.locator('.avatar-edit img[src*=polvo]').wait_for();check('Avatar persiste após recarregar')
        page.locator('#account-name').fill('Aluno Naturalista');page.get_by_role('button',name='Salvar nome',exact=True).click()
        page.get_by_role('heading',name='Aluno Naturalista',exact=True).wait_for();check('Nome da conta e sidebar são atualizados')
        page.get_by_role('tab',name='Segurança',exact=True).click()
        page.locator('#current-password').fill('LiseDemo123!');page.locator('#new-password').fill('SenhaLocal456!');page.locator('#confirm-password').fill('SenhaLocal456!')
        page.get_by_role('button',name='Salvar nova senha',exact=True).click();page.wait_for_function("document.querySelector('#toast').textContent==='Senha atualizada.'")
        check('Alteração de senha mantém o contrato do backend')
        page.get_by_role('tab',name='Privacidade',exact=True).click()
        page.locator('#request-type').select_option('correcao');page.locator('#request-details').fill('<script>texto do titular</script>')
        page.get_by_role('button',name='Registrar pedido',exact=True).click();page.locator('.privacy-request code').wait_for()
        check('Pedido de correção tem protocolo e conteúdo escapado',page.locator('.privacy-request script').count()==0 and '<script>texto do titular</script>' in page.locator('.privacy-request').inner_text())
        with page.expect_download() as download:page.get_by_role('button',name='Baixar meus dados',exact=True).click()
        data=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        check('Download contém dados próprios e exclui credenciais',data['conta']['nome']=='Aluno Naturalista' and 'demo_password_hash' not in data['conta'])

        teacher=new_page();login(teacher,'professor@lise.demo');teacher.locator('.teacher-columns').wait_for();screenshot(teacher,'naturalista-professor.png')
        nav(teacher,'classes');teacher.locator('[data-action=open-class]').first.click();teacher.get_by_role('tab',name='Alunos',exact=True).click();teacher.locator('.student-table').wait_for()
        teacher.locator('[name=show-ranking]').check();check('Professor alterna posição no mesmo quadro de alunos',teacher.get_by_role('columnheader',name='Posição',exact=True).count()==1)
        teacher.locator('[data-action=sort-students][data-sort=name]').click();check('Tabela de alunos ordenável')
        teacher.get_by_role('tab',name='Trilhas',exact=True).click();teacher.get_by_role('button',name='Atribuir trilha',exact=True).click();teacher.locator('dialog[open]').wait_for()
        teacher.keyboard.press('Escape');check('Diálogo de atribuição fecha por Escape e devolve foco',teacher.evaluate("document.activeElement.dataset.action==='open-assign'"))
        teacher.get_by_role('tab',name='Avaliações',exact=True).click();check('Resultado do aluno aparece ao professor','100' in teacher.locator('#class-tabpanel').inner_text())
        teacher.get_by_role('tab',name='Alunos',exact=True).click();teacher.get_by_role('button',name='Ver detalhes',exact=True).first.click();teacher.locator('.page-title').wait_for();check('Detalhe de aluno permanece acessível')
        nav(teacher,'trails');teacher.get_by_role('button',name='Criar trilha',exact=True).click();teacher.locator('[data-form=trail-create]').wait_for()
        teacher.locator('[data-form=trail-create] [name=name]').fill('Trilha criada no navegador');teacher.locator('[data-ui=step-next]').click()
        teacher.locator('[data-role=term-search]').fill('Biologia');teacher.locator('[data-role=term-checkbox]').first.wait_for();teacher.locator('[data-role=term-checkbox]').first.check()
        teacher.locator('[data-ui=step-next]').click();teacher.get_by_role('button',name='Salvar trilha',exact=True).click();teacher.locator('.teacher-columns').wait_for();check('Criação de trilha mantém seleção e gravação')
        teacher.get_by_role('button',name='Criar turma',exact=True).click();teacher.locator('#quick-class-name').fill('Turma criada no navegador');teacher.locator('[data-ui-form=new-class] [type=submit]').click();teacher.get_by_role('button',name='Concluir',exact=True).click();teacher.locator('.teacher-columns').wait_for()
        check('Criação de turma mantém gravação e painel de atenção',teacher.locator('.attention-panel').count()==1)
        teacher.locator('.code-chip').first.click();check('Código possui ação de cópia sem abrir a turma',teacher.locator('.teacher-columns').count()==1)

        # Dois papéis, quatro larguras, sem a navegação inferior ou barra superior.
        for tested,role in ((page,'aluno'),(teacher,'professor')):
            for width in (360,768,1024,1440):
                tested.set_viewport_size({'width':width,'height':900})
                for view in ('dashboard','explore','classes','games' if role=='aluno' else 'trails'):
                    nav(tested,view);tested.locator('main .page-title').wait_for()
                    check(f'{role}: {view} sem rolagem horizontal em {width}px',no_overflow(tested))
                if width==360:
                    tested.get_by_role('button',name='Abrir menu lateral',exact=True).click();tested.locator('#mobile-navigation[open]').wait_for()
                    check(f'{role}: nomes visíveis na gaveta',tested.locator('#mobile-navigation .side-label').first.evaluate("el=>getComputedStyle(el).visibility==='visible'"))
                    tested.keyboard.press('Tab');check(f'{role}: foco permanece na gaveta',tested.evaluate("!!document.activeElement.closest('#mobile-navigation')"))
                    tested.keyboard.press('Escape');check(f'{role}: Escape devolve foco à alça',tested.evaluate("document.activeElement.dataset.action==='open-menu'"))
                    screenshot(tested,f'naturalista-{role}-celular.png')

        page.set_viewport_size({'width':360,'height':900});page.goto(BASE+'/#conta/perfil');page.locator('.avatar-edit').wait_for()
        check('Conta e dez avatares em celular sem rolagem horizontal',no_overflow(page));screenshot(page,'naturalista-conta-celular.png')
        for email in ('vazio.professor@lise.demo','vazio.aluno@lise.demo'):
            blank=new_page();login(blank,email);blank.locator('.empty').first.wait_for()
            check(f'{email}: estado vazio com orientação real',blank.locator('.empty').count()>0)
            if 'professor' in email:check('Professor novo recebe checklist de primeiros passos',blank.locator('.onboarding').count()==1)
            blank.context.close()
        page.set_viewport_size({'width':1440,'height':1000});page.goto(BASE+'/#dashboard');page.locator('.discovery-body').wait_for()
        page.reload();page.locator('.discovery-body').wait_for();page.keyboard.press('Tab')
        check('Primeiro TAB alcança Pular para o conteúdo',page.evaluate("document.activeElement.classList.contains('skip-link')"))
        page.keyboard.press('Enter');check('Atalho de conteúdo preserva a tela',page.evaluate("document.activeElement.id==='main-content'") and '#dashboard' in page.url)
        offline['explore']=True;page.reload();page.locator('.discovery-sheet').wait_for()
        check('Falha no catálogo preserva os demais dados e oferece nova tentativa',page.locator('[data-action=retry-discovery]').count()==1)
        offline['explore']=False;page.get_by_role('button',name='Tentar novamente',exact=True).click();page.locator('.discovery-body').wait_for()
        app.config.update(PRIVACY_PUBLICATION_READY=True,PRIVACY_CONTROLLER='Equipe de teste',PRIVACY_EMAIL='privacidade@example.test')
        nav(page,'dashboard');page.locator('[data-form=account-terms]').wait_for()
        check('Exigência de aceite abre a aba Privacidade','#conta/privacidade' in page.url)
        page.locator('[data-form=account-terms] [name=accept_terms]').check();page.get_by_role('button',name='Registrar aceite',exact=True).click();page.get_by_text('Aceite registrado em',exact=False).wait_for()
        page.get_by_role('tab',name='Segurança',exact=True).click();page.get_by_role('button',name='Encerrar todas as sessões',exact=True).click();page.locator('.interaction-dialog [data-confirm]').click();page.locator('[data-form=login]').wait_for()
        check('Revogação remove o token local',page.evaluate("localStorage.getItem('lise_access_token')") is None)
        # Resultado final e evidências do ambiente isolado.
        check('Nenhum erro JavaScript',not errors);check('Nenhuma requisição externa',not external)
        result={'checks':checks,'javascript_errors':errors,'external_requests':external,'requests':len(traffic),
                'environment':'Chrome local + frontend real + Flask real com SQLite em memória; sem produção'}
        (OUT/'naturalista-resultado.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'checks':len(checks),'javascript_errors':errors,'external_requests':external},ensure_ascii=True))
        browser.close()


if __name__=='__main__':main()
