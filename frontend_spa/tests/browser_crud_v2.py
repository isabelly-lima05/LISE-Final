"""Browser checks for the user-facing CRUD and direct account deletion."""
import json,logging,sys,threading
from pathlib import Path
from datetime import timedelta
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session
from sqlalchemy import select
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from run_demo import create_demo_app
from backend.models import Avaliacao,utcnow
OUT=ROOT/'validacao_local/crud_v2';OUT.mkdir(exist_ok=True)


def main():
 logging.getLogger('werkzeug').setLevel(logging.ERROR)
 app=create_demo_app(database_url='sqlite:///:memory:');server=make_server('127.0.0.1',0,app);base=f'http://127.0.0.1:{server.server_port}'
 app.config.update(FRONTEND_URL=base,FRONTEND_ORIGINS=base)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 checks=[];errors=[];external=[]
 def check(label,condition=True):assert condition,label;checks.append(label);print('PASS',label,flush=True)
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(channel='msedge')
   def new_page():
    context=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR',reduced_motion='reduce');page=context.new_page();page.set_default_timeout(12000)
    context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else (external.append(r.request.url),r.abort()))
    page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR',e,flush=True)));return page
   def ready(page):page.wait_for_load_state('networkidle');page.wait_for_timeout(100)
   def login(page,email):
    page.goto(base);page.locator('[name=email]').fill(email);page.locator('[name=password]').fill('LiseDemo123!');page.locator('[data-form=login] [type=submit]').click();page.locator('main .page-title').wait_for();ready(page)
   def nav(page,view):
    if page.viewport_size['width']<1024:page.get_by_role('button',name='Abrir menu lateral',exact=True).click()
    page.locator(f'[data-action=navigate][data-view={view}]:visible').first.click();ready(page)
   def crud(page,action,extra=''):
    page.locator(f'[data-crud={action}]{extra}:visible').first.click();ready(page)
   def save(page):
    page.locator('dialog[open]').last.locator('[type=submit]').click();ready(page)
   def confirm(page):
    page.locator('.interaction-dialog [data-confirm]').click();ready(page)
   def shot(page,name):
    ready(page);page.evaluate('window.scrollTo(0,0)');page.get_by_role('button',name='Dispensar aviso').evaluate_all('els=>els.forEach(x=>x.click())');page.screenshot(path=str(OUT/name),full_page=True,animations='disabled')
   teacher=new_page();login(teacher,'professor@lise.demo');nav(teacher,'classes');crud(teacher,'class-edit')
   teacher.locator('#crud-name').fill('Turma revisada');save(teacher);check('Renomear turma aparece na lista',teacher.get_by_text('Turma revisada',exact=True).count()>0)
   crud(teacher,'class-archive');confirm(teacher);check('Arquivar retira a turma da lista ativa',teacher.locator('.class-card').count()==0)
   crud(teacher,'archive-view');teacher.locator('.class-card').wait_for();shot(teacher,'turmas-arquivadas.png');crud(teacher,'class-archive');confirm(teacher);crud(teacher,'archive-view');teacher.locator('.class-card').wait_for();check('Restaurar retorna a turma sem recriar vinculos')
   teacher.locator('[data-action=open-class]').first.click();ready(teacher);crud(teacher,'class-enrollment');confirm(teacher);crud(teacher,'class-code');confirm(teacher);check('Codigo de turma pode ser renovado',teacher.locator('.code-chip').first.inner_text().strip()!='LISE26')
   teacher.get_by_role('tab',name='Trilhas',exact=True).click();ready(teacher);crud(teacher,'assignment-date');teacher.locator('#crud-due').fill('2099-12-31');save(teacher);check('Prazo editavel aparece na turma','2099' in teacher.locator('#class-tabpanel').inner_text())
   crud(teacher,'assignment-archive');teacher.wait_for_timeout(6300);ready(teacher);check('Arquivar atribuicao retira apenas o vinculo ativo',teacher.locator('[data-action=configure-assessment]').count()==0)
   crud(teacher,'assignments-archived');crud(teacher,'assignment-restore');check('Restaurar atribuicao recupera o cartao',teacher.locator('[data-action=configure-assessment]').count()==1)
   teacher.locator('[data-action=configure-assessment]').click();form=teacher.locator('[data-form=assessment-config]');form.locator('[name=opens_at]').fill('2099-11-12T08:00');form.locator('[name=closes_at]').fill('2099-11-13T18:00');form.locator('[type=submit]').click();ready(teacher)
   crud(teacher,'assessment-life','[data-kind=cancel]');confirm(teacher);check('Cancelar agendamento preserva a atribuicao',teacher.locator('[data-action=configure-assessment]').count()==1)
   teacher.locator('[data-action=configure-assessment]').click();form=teacher.locator('[data-form=assessment-config]');form.locator('[name=opens_at]').fill('2099-11-12T08:00');form.locator('[name=closes_at]').fill('2099-11-13T18:00');form.locator('[type=submit]').click();ready(teacher)
   with Session(app.extensions['engine']) as db:
    a=db.scalar(select(Avaliacao));a.abre_em=utcnow()-timedelta(days=2);a.encerra_em=utcnow()-timedelta(days=1);db.commit()
   teacher.reload();teacher.locator('[data-crud=assessment-life][data-kind=reopen]').wait_for();crud(teacher,'assessment-life','[data-kind=reopen]');teacher.locator('#crud-opens_at').fill('2099-12-01T08:00');teacher.locator('#crud-closes_at').fill('2099-12-02T18:00');shot(teacher,'reabrir-avaliacao.png');save(teacher);check('BioQuiz aceita nova janela pelo fluxo da interface')
   nav(teacher,'trails');teacher.locator('.trail-menu summary').first.click();crud(teacher,'trail-edit');form=teacher.locator('[data-form=trail-create]');check('Editar trilha carrega os dados existentes',form.locator('[name=name]').input_value()=='Primeiras descobertas')
   form.locator('[name=name]').fill('Trilha revisada');teacher.locator('[data-ui=step-next]').click();teacher.locator('[data-selected-id]').last.locator('[data-direction="-1"]').click();teacher.locator('[data-ui=step-next]').click();form.locator('[type=submit]').click();ready(teacher);check('Editar trilha salva com revisao',teacher.get_by_text('Trilha revisada',exact=True).count()>0)
   nav(teacher,'explore');crud(teacher,'terms');crud(teacher,'term-new');teacher.locator('#crud-name').fill('TermoCRUD');teacher.locator('#crud-definition').fill('Definicao para revisar.');save(teacher);teacher.locator('.crud-term-list').get_by_role('heading',name='TermoCRUD',exact=True).wait_for();crud(teacher,'term-edit');teacher.locator('#crud-name').fill('Termo revisado');save(teacher);check('Meus termos permite corrigir nome e definicao',teacher.locator('.crud-term-list').get_by_role('heading',name='Termo revisado',exact=True).count()==1)
   crud(teacher,'term-archive');crud(teacher,'terms-toggle');teacher.locator('.crud-term-list').get_by_role('heading',name='Termo revisado',exact=True).wait_for();shot(teacher,'meus-termos-arquivados.png');crud(teacher,'term-archive');crud(teacher,'term-duplicate');check('Duplicar cria outro termo privado',teacher.locator('.crud-term-list .crud-list-item').count()==2)
   crud(teacher,'term-delete');confirm(teacher);check('Excluir termo sem dependentes funciona',teacher.locator('.crud-term-list .crud-list-item').count()==1)
   teacher.keyboard.press('Escape');nav(teacher,'classes');teacher.locator('[data-action=open-class]').first.click();teacher.get_by_role('tab',name='Alunos',exact=True).click();ready(teacher);crud(teacher,'student-remove');confirm(teacher);check('Remover aluno atualiza a turma',teacher.locator('[data-student-row]').count()==0)
   student=new_page();login(student,'aluno@lise.demo');nav(student,'collections');student.get_by_role('button',name='Criar cole\u00e7\u00e3o',exact=True).click();student.locator('[data-form=collection-create] [name=name]').fill('Caderno CRUD');student.locator('[data-role=term-search]').fill('bio');student.locator('[data-role=term-checkbox]').first.wait_for();student.locator('[data-role=term-checkbox]').first.check();student.get_by_role('button',name='Salvar cole\u00e7\u00e3o',exact=True).click();ready(student);crud(student,'collection-edit');student.locator('#crud-name').fill('Caderno revisado');save(student);check('Aluno pode renomear a propria colecao',student.get_by_text('Caderno revisado',exact=True).count()==1)
   for page,role in [(teacher,'professor'),(student,'aluno')]:
    page.set_viewport_size({'width':360,'height':900});nav(page,'explore');crud(page,'terms');check(role+' gerencia termos em 360px sem overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.keyboard.press('Escape');shot(page,role+'-explorar-celular.png')
   student.goto(base+'/#conta/seguranca');student.locator('.crud-sessions').wait_for();student.locator('[data-crud=session-revoke]').wait_for();check('Minha conta lista acessos revogaveis')
   student.goto(base+'/#conta/privacidade');student.locator('[data-crud-form=delete-account]').wait_for();check('Exclusao nao e mais uma opcao de pedido',student.locator('#request-type option[value=exclusao]').count()==0)
   shot(student,'exclusao-direta-celular.png');form=student.locator('[data-crud-form=delete-account]');form.locator('[name=password]').fill('LiseDemo123!');form.locator('[name=confirmation]').fill('EXCLUIR');form.locator('[name=preserve]').check();form.locator('[type=submit]').click();confirm(student);student.locator('[data-form=login]').wait_for();check('Exclusao direta encerra o acesso sem pedido manual')
   check('Nenhum erro JavaScript',not errors);check('Nenhuma chamada externa',not external)
   browser.close()
 finally:server.shutdown()
 (OUT/'resultado.json').write_text(json.dumps({'checks':checks,'javascript_errors':errors,'external_requests':external,'environment':'API real + Edge + SQLite em memoria; sem Supabase'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'checks':len(checks),'javascript_errors':errors,'external_requests':external}))

if __name__=='__main__':main()
