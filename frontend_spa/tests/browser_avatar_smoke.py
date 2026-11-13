"""Smoke test do placeholder e dos assets de avatar, sem chamadas de produção."""
import logging
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from run_demo import create_demo_app
from backend.demo import ALUNO_ID
from backend.models import Usuario


def main():
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    app = create_demo_app(database_url='sqlite:///:memory:')
    with Session(app.extensions['engine']) as db:
        db.get(Usuario, ALUNO_ID).avatar = 'placeholder'
        db.commit()

    server = make_server('127.0.0.1', 0, app)
    base = f'http://127.0.0.1:{server.server_port}'
    app.config.update(FRONTEND_URL=base, FRONTEND_ORIGINS=base)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    errors = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge')
            page = browser.new_page(viewport={'width': 1280, 'height': 900}, locale='pt-BR')
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base)
            page.locator('[name=email]').fill('aluno@lise.demo')
            page.locator('[name=password]').fill('LiseDemo123!')
            page.locator('[data-form=login] [type=submit]').click()
            page.locator('main .page-title').wait_for()
            page.goto(base + '/#conta/perfil')
            page.locator('.avatar-edit').wait_for()

            assert page.locator('.avatar-edit img').get_attribute('src').endswith('avatar-placeholder.svg')
            assert page.locator('.avatar-selection-hint').is_visible()
            page.locator('[data-ui=avatar]').click()
            assert page.locator('.interaction-dialog .avatar-option').count() == 10
            assert page.get_by_role('button', name='Salvar avatar', exact=True).is_disabled()

            catalog = page.evaluate('window.LISE_AVATARS.map(({id,image})=>({id,image}))')
            assert sum(item['image'].endswith('.png') for item in catalog) == 9
            assert next(item for item in catalog if item['id'] == 'leaf')['image'].endswith('tardigrado.svg')

            page.locator('[data-choice=butterfly]').click()
            page.get_by_role('button', name='Salvar avatar', exact=True).click()
            page.locator('.interaction-dialog').wait_for(state='detached')
            assert page.locator('.avatar-edit img').get_attribute('src').endswith('suricato.png')
            page.reload()
            page.locator('.avatar-edit').wait_for()
            assert page.locator('.avatar-edit img').get_attribute('src').endswith('suricato.png')
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()
    print('PASS: placeholder neutro, 9 PNGs, tardígrado preservado e suricato persistente.')


if __name__ == '__main__':
    main()
