"""Porta a área de privacidade da versão Jinja para a API Bearer.

Pedidos de exclusão são protocolos para atendimento manual, nunca um DELETE.
"""
import json
import os
import uuid
from datetime import timedelta
from functools import wraps

import click
from flask import Blueprint, Response, abort, current_app, g, jsonify, render_template, request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import (AceiteLegal, AvaliacaoQuestao, AvaliacaoSessao, Colecao, ColecaoTermo,
                     Conquista, FavoritoRadical, FavoritoTermo, Flashcard, GameQuestion,
                     GameSession, Matricula, Partida, PedidoPrivacidade, Progresso,
                     Recompensa, Sessao, Termo, Trilha, Turma, Usuario, utcnow)

LEGAL_VERSION = '2026-11-11-r2'
REQUEST_TYPES = {'acesso': 'Acesso ou esclarecimento', 'correcao': 'Correção de dados',
                 'exclusao': 'Exclusão da conta e dos dados', 'outro': 'Outro direito sobre meus dados'}
DOCUMENTS = {'privacidade': 'Política de Privacidade', 'termos-de-uso': 'Termos de Uso',
             'cookies': 'Cookies e armazenamento'}
privacy_api = Blueprint('lise_privacy', __name__, url_prefix='/api/v1')


def legal_ready():
    config = current_app.config
    return bool(config['PRIVACY_PUBLICATION_READY'] and config['PRIVACY_CONTROLLER']
                and config['PRIVACY_EMAIL'])


def current_acceptance():
    return g.db.scalar(select(AceiteLegal).where(
        AceiteLegal.fk_usuario == g.user.id_usuario,
        AceiteLegal.termos_versao == LEGAL_VERSION,
        AceiteLegal.privacidade_versao == LEGAL_VERSION))


def require_account(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not getattr(g, 'user', None):
            abort(401, description='Entre novamente para continuar.')
        return fn(*args, **kwargs)
    return wrapped


def body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description='Envie um objeto JSON válido.')
    return data


def lock_user():
    g.db.scalar(select(Usuario).where(Usuario.id_usuario == g.user.id_usuario).with_for_update())


def request_json(item):
    return dict(id=item.id, type=item.tipo, details=item.detalhes, status=item.status,
                created_at=item.criado_em.isoformat(), response=item.resposta,
                resolved_at=item.resolvido_em.isoformat() if item.resolvido_em else None)


@privacy_api.get('/legal/<document>')
def legal_document(document):
    if document not in DOCUMENTS:
        abort(404)
    content = render_template('legal_content.html', document=document,
                              privacy_controller=current_app.config['PRIVACY_CONTROLLER'],
                              privacy_email=current_app.config['PRIVACY_EMAIL'])
    return jsonify(document=document, title=DOCUMENTS[document], version=LEGAL_VERSION,
                   ready=legal_ready(), html=content)


@privacy_api.get('/account')
@require_account
def account():
    accepted = current_acceptance()
    requests = g.db.scalars(select(PedidoPrivacidade).where(
        PedidoPrivacidade.fk_usuario == g.user.id_usuario).order_by(PedidoPrivacidade.criado_em.desc()))
    return jsonify(legal_version=LEGAL_VERSION, legal_ready=legal_ready(),
                   accepted=bool(accepted), accepted_at=accepted.aceito_em.isoformat() if accepted else None,
                   requests=[request_json(item) for item in requests], request_types=REQUEST_TYPES,
                   direct_deletion_available=bool(current_app.config['DEMO_MODE'] or current_app.config.get('AUTH_ADMIN_FACTORY') or current_app.config.get('SUPABASE_SECRET_KEY')))


@privacy_api.post('/account/terms')
@require_account
def accept_terms():
    if not legal_ready():
        abort(503, description='Os documentos estão em revisão. Tente novamente mais tarde.')
    data = body()
    if data.get('accept_terms') is not True or data.get('legal_version') != LEGAL_VERSION:
        abort(400, description='Leia e aceite a versão atual dos Termos de Uso.')
    lock_user()
    if not current_acceptance():
        g.db.add(AceiteLegal(fk_usuario=g.user.id_usuario, termos_versao=LEGAL_VERSION,
                            privacidade_versao=LEGAL_VERSION))
        g.db.commit()
    return jsonify(message='Termos aceitos. A versão e a data foram registradas.')


@privacy_api.patch('/account/name')
@require_account
def update_name():
    name = body().get('name')
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 150:
        abort(400, description='Informe um nome entre 2 e 150 caracteres.')
    g.user.nome = name.strip()
    g.db.commit()
    return jsonify(message='Nome atualizado.', name=g.user.nome)


@privacy_api.post('/account/data')
@require_account
def export_data():
    uid = g.user.id_usuario

    def rows(model, condition, exclude=()):
        return [{column.name: getattr(row, column.name) for column in model.__table__.columns
                 if column.name not in exclude} for row in g.db.scalars(select(model).where(condition))]

    data = {'gerado_em': utcnow(), 'conta': rows(Usuario, Usuario.id_usuario == uid,
                                               ('demo_password_hash',))[0],
            'observacao': 'Dados da aplicação LISE. Não inclui credenciais, tokens ou dados de colegas.'}
    for model in (Matricula, Progresso, Flashcard, Recompensa, Conquista, AceiteLegal,
                  PedidoPrivacidade, FavoritoTermo, FavoritoRadical, Colecao, GameSession,
                  AvaliacaoSessao):
        data[model.__tablename__] = rows(model, model.fk_usuario == uid)
    data['lise_partidas'] = rows(Partida, Partida.fk_usuario == uid, ('resposta_esperada',))
    collections = select(Colecao.id).where(Colecao.fk_usuario == uid)
    data['lise_colecao_termos'] = rows(ColecaoTermo, ColecaoTermo.fk_colecao.in_(collections))
    games = select(GameSession.id).where(GameSession.fk_usuario == uid)
    # Payloads de questões podem conter gabaritos/mapas internos: exporta só os vínculos.
    data['lise_game_session_questions'] = rows(GameQuestion, GameQuestion.fk_sessao.in_(games), ('payload',))
    assessments = select(AvaliacaoSessao.id).where(AvaliacaoSessao.fk_usuario == uid)
    data['lise_avaliacao_questoes'] = rows(AvaliacaoQuestao, AvaliacaoQuestao.fk_sessao.in_(assessments),
                                          ('resposta_esperada',))
    for model in (Turma, Trilha):
        data[model.__tablename__] = rows(model, model.fk_professor == uid)
    data['termos_criados'] = rows(Termo, Termo.criado_por == uid)
    return Response(json.dumps(data, ensure_ascii=False, default=str, indent=2),
                    content_type='application/json; charset=utf-8',
                    headers={'Content-Disposition': 'attachment; filename="meus-dados-lise.json"',
                             'Cache-Control': 'no-store'})


@privacy_api.post('/account/sessions/revoke')
@require_account
def revoke_sessions():
    lock_user()
    g.db.execute(delete(Sessao).where(Sessao.fk_usuario == g.user.id_usuario))
    g.db.commit()
    return jsonify(message='Todas as suas sessões na LISE foram encerradas. Entre novamente.')


@privacy_api.post('/account/requests')
@require_account
def create_privacy_request():
    data = body()
    kind, details = data.get('type'), data.get('details', '')
    if not isinstance(kind, str) or kind not in REQUEST_TYPES or not isinstance(details, str) or len(details.strip()) > 2000:
        abort(400, description='Confira o tipo do pedido e o limite de 2.000 caracteres.')
    if kind=='exclusao':abort(400,description='A exclusão agora é feita diretamente na área Excluir conta, com confirmação da senha.')
    lock_user()
    pending = g.db.scalar(select(PedidoPrivacidade).where(
        PedidoPrivacidade.fk_usuario == g.user.id_usuario, PedidoPrivacidade.tipo == kind,
        PedidoPrivacidade.status == 'pendente'))
    if pending:
        return jsonify(message='Você já tem um pedido desse tipo em análise.', request=request_json(pending))
    recent = g.db.scalars(select(PedidoPrivacidade.id).where(
        PedidoPrivacidade.fk_usuario == g.user.id_usuario,
        PedidoPrivacidade.criado_em > utcnow() - timedelta(days=1))).all()
    if len(recent) >= 5:
        abort(429, description='Você já registrou cinco pedidos nas últimas 24 horas.')
    item = PedidoPrivacidade(id=str(uuid.uuid4()), fk_usuario=g.user.id_usuario,
                             tipo=kind, detalhes=details.strip())
    g.db.add(item)
    g.db.commit()
    return jsonify(message='Pedido registrado. A equipe fará a análise; os dados ainda não foram excluídos.',
                   request=request_json(item)), 201


def configure_privacy(app):
    for key in ('PRIVACY_CONTROLLER', 'PRIVACY_EMAIL'):
        app.config.setdefault(key,os.getenv(key,'john.cristopher.senai@gmail.com' if key=='PRIVACY_EMAIL' else '').strip())
    app.config.setdefault('PRIVACY_PUBLICATION_READY', os.getenv('PRIVACY_PUBLICATION_READY', 'false').lower() == 'true')
    app.register_blueprint(privacy_api)

    @app.cli.command('privacy-requests')
    @click.option('--id', 'request_id')
    def privacy_requests(request_id):
        """Fila interna de atendimento. Não publicar a saída."""
        with Session(app.extensions['engine']) as db:
            query = select(PedidoPrivacidade).order_by(PedidoPrivacidade.criado_em)
            query = query.where(PedidoPrivacidade.id == request_id) if request_id else query.where(PedidoPrivacidade.status == 'pendente')
            for item in db.scalars(query):
                payload = dict(protocolo=item.id, usuario=item.fk_usuario, tipo=item.tipo,
                               status=item.status, criado_em=str(item.criado_em))
                if request_id:
                    payload.update(email=db.get(Usuario, item.fk_usuario).email,
                                   detalhes=item.detalhes, resposta=item.resposta)
                click.echo(json.dumps(payload, ensure_ascii=False))

    @app.cli.command('privacy-resolve')
    @click.argument('request_id')
    @click.option('--status', required=True, type=click.Choice(['concluido', 'indeferido']))
    @click.option('--response-file', required=True, type=click.Path(exists=True, dir_okay=False))
    def privacy_resolve(request_id, status, response_file):
        """Registra atendimento manual. Não envia e-mail nem apaga dados."""
        with open(response_file, encoding='utf-8') as file:
            answer = file.read().strip()
        if not answer or len(answer) > 4000:
            raise click.ClickException('A resposta deve ter entre 1 e 4.000 caracteres.')
        with Session(app.extensions['engine']) as db:
            item = db.get(PedidoPrivacidade, request_id)
            if not item or item.status != 'pendente':
                raise click.ClickException('Pedido pendente não encontrado.')
            item.status, item.resposta, item.resolvido_em = status, answer, utcnow()
            db.commit()
        click.echo('Resposta registrada. Este comando não envia e-mail nem apaga dados.')
