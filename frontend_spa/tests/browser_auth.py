"""Verifica acesso, cadastro e recuperação nas quatro larguras de referência."""
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from run_demo import create_demo_app
from playwright.sync_api import sync_playwright

app=create_demo_app(database_url='sqlite:///:memory:')
client=app.test_client()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(reduced_motion='reduce')
    errors=[];checks=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route(r):
        u=urlsplit(r.request.url)
        assert u.hostname=='127.0.0.1',r.request.url
        response=client.open(u.path,method=r.request.method,data=r.request.post_data,
                             headers={k:v for k,v in r.request.headers.items() if k in ('authorization','content-type')})
        r.fulfill(status=response.status_code,headers=dict(response.headers),body=response.data)
    page.route('**/*',route)
    for width in (360,768,1024,1440):
        page.set_viewport_size({'width':width,'height':568 if width==360 else 900})
        page.goto('http://127.0.0.1:5001/')
        for mode in ('login','register','recovery'):
            if mode=='register':page.get_by_role('button',name='Criar conta',exact=True).click()
            if mode=='recovery':
                page.get_by_role('button',name='Entrar',exact=True).click()
                page.get_by_role('button',name='Esqueci minha senha',exact=True).click()
            page.locator(f'[data-form={mode}]').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,mode)
            assert page.locator('form').count()==1
            assert page.locator('.access-google').count()==0
            assert page.get_by_text('Conectar com Google',exact=True).count()==0
            page.locator('[type=submit]').scroll_into_view_if_needed()
            assert page.locator('[type=submit]').is_visible()
            if mode=='register':assert page.locator('[name=role]').count()==2
            if width==1440:page.screenshot(path=str(ROOT/f'validacao_local/naturalista-{mode}.png'),full_page=True)
            checks.append(f'{mode} em {width}px: formulário único, ação visível e sem rolagem horizontal')
    assert not errors,errors
    (ROOT/'validacao_local/naturalista-auth.json').write_text(json.dumps({'checks':checks,'javascript_errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'PASS: {len(checks)} cenários de acesso, cadastro e recuperação.')
    browser.close()
