"""Demonstração local da versão integrada: python run_demo.py.

Serve a API e o frontend juntos apenas nesta demonstração, sem alterar config.js.
"""
import argparse
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'backend_service'))

from flask import abort, send_from_directory
from sqlalchemy.orm import Session
from app import create_app
from backend.demo import seed
from backend.models import Base


def create_demo_app(port=5001, database_url=None):
    origin = f'http://127.0.0.1:{port}'
    app = create_app({
        'DEMO_MODE': True,
        'DATABASE_URL': database_url or 'sqlite:///' + (ROOT / 'demo_privacidade.db').as_posix(),
        'SECRET_KEY': secrets.token_hex(32),
        'FRONTEND_URL': origin, 'FRONTEND_ORIGINS': origin,
        'PROXY_HOPS': 0,
        'PRIVACY_PUBLICATION_READY': False, 'PRIVACY_CONTROLLER': '', 'PRIVACY_EMAIL': 'john.cristopher.senai@gmail.com',
    })
    Base.metadata.create_all(app.extensions['engine'])
    from backend.demo_schema import upgrade_demo_schema
    upgrade_demo_schema(app.extensions['engine'])
    with Session(app.extensions['engine']) as db:
        seed(db)
        db.commit()

    def index():
        return send_from_directory(ROOT / 'frontend_spa', 'index.html')

    app.view_functions['root'] = index

    @app.get('/config.js')
    def local_config():
        return app.response_class('window.LISE_CONFIG = {API_BASE_URL: window.location.origin};',
                                  mimetype='application/javascript')

    @app.get('/<path:filename>')
    def frontend_file(filename):
        # Não transformar uma rota de API inexistente em resposta HTML.
        if filename.startswith('api/'):
            abort(404)
        return send_from_directory(ROOT / 'frontend_spa', filename)

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5001)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('A porta deve estar entre 1 e 65535.')
    app = create_demo_app(args.port)
    print(f'Versão integrada: http://127.0.0.1:{args.port}')
    print('Aluno: aluno@lise.demo | Professor: professor@lise.demo')
    print('Senha das duas contas: LiseDemo123!')
    print('Dados fictícios locais. O cadastro real não está disponível na demonstração.')
    app.run(host='127.0.0.1', port=args.port, debug=False)
