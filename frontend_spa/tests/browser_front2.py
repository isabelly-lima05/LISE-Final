"""Real browser regressions for Front Lise 2, with isolated SQLite and no production calls."""
import json, logging, sys, threading
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from run_demo import create_demo_app
from backend.models import Partida, Trilha, TurmaTrilha

OUT=ROOT/'validacao_local'/'front2'
OUT.mkdir(exist_ok=True)

def main():
 logging.getLogger('werkzeug').setLevel(logging.ERROR)
 app=create_demo_app(database_url='sqlite:///:memory:')
 server=make_server('127.0.0.1',0,app)
 base=f'http://127.0.0.1:{server.server_port}'
 app.config.update(FRONTEND_URL=base,FRONTEND_ORIGINS=base)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 checks=[];errors=[];external=[];sessions=[]
 def check(label,condition=True):
  assert condition,label
  checks.append(label)
  print("PASS",label,flush=True)
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(channel='msedge')
   def new_page():
    context=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR')
    page=context.new_page();page.set_default_timeout(12000)
    page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR:',str(e),flush=True)))
    context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base+'/') or route.request.url.startswith('data:') else (external.append(route.request.url),route.abort()))
    def response(r):
     if r.url.endswith('/api/v1/games/sessions') and r.status==201:sessions.append(r.json())
    page.on('response',response)
    return page
   def ready(page):page.wait_for_load_state('networkidle')
   def login(page,email):
    page.goto(base);page.locator('[name=email]').fill(email);page.locator('[name=password]').fill('LiseDemo123!');page.locator('[data-form=login] [type=submit]').click();page.locator('main .page-title').wait_for();ready(page)
   def nav(page,view):
    if page.viewport_size['width']<1024:page.get_by_role('button',name='Abrir menu lateral',exact=True).click()
    page.locator(f'[data-action=navigate][data-view={view}]:visible').first.click();ready(page)
   def shot(page,name):
    ready(page);page.evaluate('document.fonts.ready');page.evaluate('window.scrollTo(0,0)');page.locator('main').evaluate('el=>el.focus({preventScroll:true})');
    page.get_by_role('button',name='Dispensar aviso').evaluate_all('els=>els.forEach(el=>el.click())')
    page.wait_for_timeout(650);page.mouse.move(page.viewport_size['width']-2,2);page.screenshot(path=str(OUT/name),full_page=True,animations='disabled')
   teacher=new_page();login(teacher,'professor@lise.demo')
   teacher.wait_for_timeout(4300);check('Login toast expira sem cobrir permanentemente o rodape',teacher.locator('#toast .notice').count()==0)
   teacher.get_by_role('button',name='Criar turma',exact=True).click();teacher.locator('#quick-class-name').wait_for()
   check('Criar turma abre dialogo com foco no nome',teacher.evaluate("document.activeElement.id==='quick-class-name'"))
   teacher.keyboard.press('Escape');teacher.locator('.interaction-dialog').wait_for(state='detached');check('Escape restaura foco do gatilho',teacher.evaluate("document.activeElement.dataset.action==='new-class'"))
   teacher.get_by_role('button',name='Criar turma',exact=True).click();teacher.locator('#quick-class-name').fill('Turma da rodada 2');teacher.locator('[data-ui-form=new-class] [type=submit]').click();teacher.locator('.created-class .code-chip').wait_for();check('Criacao mostra codigo real da API',len(teacher.locator('.created-class .code-chip').get_attribute('data-code'))==6)
   shot(teacher,'professor-turma-criada.png');teacher.get_by_role('button',name='Concluir',exact=True).click()
   teacher.get_by_role('button',name='Criar trilha',exact=True).click();form=teacher.locator('[data-form=trail-create]')
   teacher.locator('[data-ui=step-next]').click();check('Etapa de informacoes exige nome',form.get_attribute('data-current-step')=='0')
   form.locator('[name=name]').fill('Percurso da rodada 2');teacher.locator('[data-ui=step-next]').click();check('Etapa termos preserva o nome',form.locator('[name=name]').input_value()=='Percurso da rodada 2')
   teacher.locator('[data-ui=step-next]').click();check('Etapa termos exige selecao',form.get_attribute('data-current-step')=='1')
   teacher.locator('[data-role=term-search]').fill('bio');teacher.locator('[data-role=term-checkbox]').first.wait_for();teacher.locator('[data-role=term-checkbox]').first.check()
   teacher.locator('[data-role=term-search]').fill('cito');teacher.locator('[data-role=term-checkbox]').first.wait_for();teacher.locator('[data-role=term-checkbox]').first.check()
   before=teacher.locator('[data-selected-id]').evaluate_all('els=>els.map(e=>e.dataset.selectedId)')
   teacher.locator('[data-selected-id]').last.locator('[data-direction="-1"]').click()
   after=teacher.locator('[data-selected-id]').evaluate_all('els=>els.map(e=>e.dataset.selectedId)');check('Ordem altera por teclado/botoes',before==list(reversed(after)))
   shot(teacher,'professor-trilha-termos.png')
   teacher.locator('[data-action=navigate][data-view=trails]:visible').first.click();teacher.locator('.interaction-dialog').wait_for();teacher.get_by_role('button',name='Cancelar',exact=True).last.click();check('Cancelar saida preserva o rascunho',form.locator('[name=name]').input_value()=='Percurso da rodada 2')
   teacher.locator('.interaction-dialog').wait_for(state='detached');ready(teacher);teacher.go_back();teacher.locator('.interaction-dialog').wait_for();check('Voltar do navegador pede confirmacao sem salvar');teacher.get_by_role('button',name='Cancelar',exact=True).last.click();check('Cancelar historico preserva os campos',form.locator('[name=name]').input_value()=='Percurso da rodada 2')
   teacher.locator('[data-ui=step-next]').click();shot(teacher,'professor-trilha-atribuicao.png');form.locator('[type=submit]').click();teacher.locator('.teacher-welcome').wait_for();check('Stepper salva trilha na API')
   nav(teacher,'classes');teacher.locator('[data-action=open-class][data-id="1"]').first.click();teacher.get_by_role('tab',name='Alunos',exact=True).click();teacher.locator('[name=show-ranking]').check();check('Switch mostra posicao semanal',teacher.get_by_role('columnheader',name='Posição',exact=True).count()==1)
   check('Ordenacao sem select duplicado',teacher.locator('[name=student-sort]').count()==0)
   teacher.locator('[data-student-row]').first.focus();teacher.keyboard.press('Enter');teacher.locator('.student-overview').wait_for();check('Linha de aluno abre pelo teclado')
   teacher.locator('[data-action=back-to-class]').click();teacher.get_by_role('tab',name='Trilhas',exact=True).click();teacher.locator('[data-action=configure-assessment]').first.click();assessment=teacher.locator('[data-form=assessment-config]');assessment.wait_for()
   assessment.locator('[name=opens_at]').fill('2099-11-12T08:00');assessment.locator('[name=closes_at]').fill('2099-11-11T18:00');check('BioQuiz valida janela inline',not assessment.locator('[name=closes_at]').evaluate('el=>el.checkValidity()'))
   assessment.locator('[name=closes_at]').fill('2099-11-14T18:00');check('Resumo do BioQuiz informa Brasilia','Brasília' in assessment.locator('.schedule-summary').inner_text())
   shot(teacher,'professor-bioquiz.png')
   teacher.goto(base+'/#conta/perfil');teacher.locator('[data-ui=avatar]').wait_for();check('Perfil esconde grade de avatares',teacher.locator('.avatar-option').count()==0)
   teacher.locator('[data-ui=avatar]').click();teacher.locator('.interaction-dialog .avatar-option').first.wait_for();check('Modal oferece dez avatares',teacher.locator('.interaction-dialog .avatar-option').count()==10)
   shot(teacher,'avatar-modal-desktop.png')
   teacher.locator('[data-choice=fox]').click();teacher.get_by_role('button',name='Salvar avatar',exact=True).click();teacher.locator('.interaction-dialog').wait_for(state='detached');ready(teacher);check('Avatar salvo aparece no perfil',teacher.locator('.avatar-edit img').get_attribute('src')==teacher.evaluate("window.LISE_AVATARS.find(a=>a.id==='fox').image"))
   teacher.reload();teacher.locator('.avatar-edit').wait_for();check('Avatar persiste apos recarga',teacher.locator('.avatar-edit img').get_attribute('src')==teacher.evaluate("window.LISE_AVATARS.find(a=>a.id==='fox').image"))
   teacher.get_by_role('tab',name='Segurança',exact=True).click();teacher.locator('#current-password').fill('teste');teacher.locator('#current-password').locator('..').get_by_role('button',name='Mostrar senha').click();check('Mostrar senha conserva o valor',teacher.locator('#current-password').get_attribute('type')=='text' and teacher.locator('#current-password').input_value()=='teste')
   teacher.get_by_role('button',name='Encerrar todas as sessões',exact=True).click();teacher.locator('.interaction-dialog').wait_for();teacher.get_by_role('button',name='Cancelar',exact=True).last.click();check('Encerrar sessoes exige confirmacao e cancelar mantem acesso',teacher.locator('#current-password').count()==1)
   teacher.get_by_role('tab',name='Privacidade',exact=True).click();teacher.locator('.compact-section-nav').get_by_role('button',name='Excluir conta',exact=True).click();teacher.locator('[data-crud-form=delete-account]').wait_for();check('Exclusao direta pede senha e EXCLUIR',teacher.locator('[data-crud-form=delete-account] [name=password]').is_visible() and teacher.locator('[data-crud-form=delete-account] [name=confirmation]').is_visible() and teacher.locator('#request-type option[value=exclusao]').count()==0)
   # Undo cancels before any destructive request, including an unused assignment.
   with Session(app.extensions['engine']) as db:
    trail=db.scalar(select(Trilha).where(Trilha.nome=='Percurso da rodada 2'));trail_id=trail.id_trilha
   h=teacher.evaluate("localStorage.getItem('lise_access_token')")
   client=app.test_client();client.post('/api/v1/classes/1/trails',headers={'Authorization':'Bearer '+h},json={'trail_id':trail_id})
   nav(teacher,'classes');teacher.locator('[data-action=open-class][data-id="1"]').first.click();teacher.get_by_role('tab',name='Trilhas',exact=True).click();teacher.locator(f'[data-crud=assignment-archive][data-id="{trail_id}"]').click();teacher.get_by_role('button',name='Desfazer',exact=True).click();teacher.wait_for_timeout(6200)
   with Session(app.extensions['engine']) as db:check('Desfazer impede a remocao no servidor',db.scalar(select(TurmaTrilha).where(TurmaTrilha.fk_trilha==trail_id)).desvinculada_em is None)
   student=new_page();login(student,'aluno@lise.demo');nav(student,'explore');student.locator('.specimen-card').first.wait_for();student.get_by_role('button',name='Estudar',exact=True).click();student.locator('[data-action=reveal-study]').first.click();check('Revelacao de estudo mostra definicao',student.locator('.study-revealed .specimen-definition').count()==1)
   nav(student,'games');student.locator('[data-action=select-game][data-game=memoria]').click();student.locator('[data-action=choose-source][data-type=area][data-name="Biologia Geral"]').click();student.wait_for_function("!document.querySelector('[data-form=game-config] [type=submit]').disabled");student.locator('[data-form=game-config] [type=submit]').click();student.locator('.memory-grid').wait_for();ready(student)
   game=sessions[-1];q=game['questions'][0]
   with Session(app.extensions['engine']) as db:pairs=db.get(Partida,q['id']).resposta_esperada
   check('Memoria mostra pares, sem Questao 1 de 1','Questão 1 de 1' not in student.locator('main').inner_text())
   student.locator(f'[data-card="{pairs[0][0]}"]').click();shot(student,'aluno-memoria-cartas.png');student.locator(f'[data-card="{pairs[1][0]}"]').click();student.locator('.mismatch').first.wait_for();student.wait_for_timeout(1100);check('Par errado desvira e libera cartas',student.locator('.memory-card.selected').count()==0)
   for pair in pairs:
    for card in pair:student.locator(f'[data-card="{card}"]').click()
    student.wait_for_function('(n)=>document.querySelectorAll(".memory-card.matched").length>=n',arg=(pairs.index(pair)+1)*2)
   student.locator('.feedback').wait_for();check('Pares completos recebem feedback real do servidor',student.locator('.feedback.good').count()==1)
   student.locator('[data-action=next-question]').click();student.locator('.memory-progress').wait_for();check('Resumo informa pares tentativas e tempo',all(x in student.locator('.memory-progress').inner_text() for x in ['Pares','Tentativas','Tempo']))
   shot(student,'aluno-memoria-resultado.png')
   for page,role in [(teacher,'professor'),(student,'aluno')]:
    for width in (360,768,1440):
     page.set_viewport_size({'width':width,'height':900})
     for view in ('dashboard','explore','classes','trails' if role=='professor' else 'games'):
      nav(page,view);check(f'{role} {view} sem overflow em {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
     page.goto(base+'/#conta/perfil');page.locator('.avatar-edit').wait_for();overflow=page.locator('body *').evaluate_all("els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left<-1}).map(el=>({tag:el.tagName,class:el.className,right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left),width:Math.round(el.getBoundingClientRect().width)})).slice(0,12)");check(f'{role} conta sem overflow em {width}: {overflow}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
     if width==360:shot(page,role+'-conta-celular.png')
   teacher.set_viewport_size({'width':1440,'height':1000});teacher.goto(base+'/#cookies');teacher.locator('.legal-toc').wait_for();check('Cookies tem sumario e ativo',teacher.locator('.legal-page [aria-current=page]').count()==1)
   shot(teacher,'cookies-desktop.png');teacher.set_viewport_size({'width':360,'height':900});check('Cookies sem cortar a pagina em 360',teacher.evaluate('document.documentElement.scrollWidth<=innerWidth'));shot(teacher,'cookies-celular.png')
   teacher.emulate_media(reduced_motion='reduce');teacher.goto(base+'/#conta/perfil');teacher.locator('.avatar-edit').wait_for();teacher.locator('[data-ui=avatar]').click();check('Movimento reduzido desativa animacao do modal',teacher.locator('.interaction-dialog').evaluate("el=>getComputedStyle(el).animationName==='none'"));teacher.keyboard.press('Escape')
   check('Sem erros JavaScript',not errors);check('Sem chamadas externas',not external)
   browser.close()
 finally:server.shutdown()
 (OUT/'resultado.json').write_text(json.dumps({'checks':checks,'erros_javascript':errors,'chamadas_externas':external,'ambiente':'Edge local, API real e SQLite em memoria; sem producao'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'checks':len(checks),'erros_javascript':errors,'chamadas_externas':external},ensure_ascii=True))

if __name__=='__main__':main()
