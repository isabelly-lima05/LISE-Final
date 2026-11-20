"""Self-service account deletion and session management, with server reauthentication."""
import hashlib
from datetime import timedelta
from flask import Blueprint, abort, current_app, g, jsonify, request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash
from .models import *
from .privacy_api import require_account, body
from .rest_api import _auth_limit
from .services import aware

accounts=Blueprint('lise_accounts',__name__,url_prefix='/api/v1')
SYSTEM_ID='00000000-0000-4000-8000-000000000001'


def process_auth_deletions(app,limit=3):
    """Automatic retries. A pending provider operation never restores app access."""
    if app.config['DEMO_MODE']:return 0
    factory=app.extensions.get('lise_auth_admin_client')
    if not factory or not (app.config.get('AUTH_ADMIN_FACTORY') or app.config.get('SUPABASE_SECRET_KEY')):return 0
    completed=0
    with Session(app.extensions['engine']) as db:
        rows=db.scalars(select(ExclusaoAuthPendente).where(
            (ExclusaoAuthPendente.tentativa_em.is_(None)) | (ExclusaoAuthPendente.tentativa_em<utcnow()-timedelta(seconds=60)))
            .order_by(ExclusaoAuthPendente.criada_em).limit(limit).with_for_update(skip_locked=True)).all()
        for row in rows:
            row.tentativas+=1;row.tentativa_em=utcnow()
            try:
                factory().auth.admin.delete_user(row.id)
            except Exception as error:
                # Already absent at the provider is also a completed deletion.
                if getattr(error,'status',None)==404 or getattr(error,'code',None)=='user_not_found':
                    db.delete(row);completed+=1
                else:app.logger.warning('Exclusão Auth será repetida: %s',type(error).__name__)
            else:db.delete(row);completed+=1
        db.commit()
    return completed


@accounts.get('/account/sessions')
@require_account
def sessions_list():
    current=hashlib.sha256(request.headers.get('Authorization','')[7:].strip().encode()).hexdigest()
    rows=g.db.scalars(select(Sessao).where(Sessao.fk_usuario==g.user.id_usuario,Sessao.expira_em>utcnow()).order_by(Sessao.ultimo_uso_em.desc())).all()
    return jsonify(sessions=[dict(id=r.id,current=r.id==current,device=r.dispositivo or 'Navegador não identificado',
                                  last_used=aware(r.ultimo_uso_em).isoformat(),expires_at=aware(r.expira_em).isoformat()) for r in rows])


@accounts.delete('/account/sessions/<ident>')
@require_account
def revoke_session(ident):
    row=g.db.scalar(select(Sessao).where(Sessao.id==ident,Sessao.fk_usuario==g.user.id_usuario))
    if not row:abort(404,description='Sessão não encontrada.')
    current=hashlib.sha256(request.headers.get('Authorization','')[7:].strip().encode()).hexdigest()
    g.db.delete(row);g.db.commit();return jsonify(message='Acesso encerrado.',current=ident==current)


@accounts.post('/account/requests/<ident>/cancel')
@require_account
def cancel_privacy_request(ident):
    row=g.db.scalar(select(PedidoPrivacidade).where(PedidoPrivacidade.id==ident,PedidoPrivacidade.fk_usuario==g.user.id_usuario).with_for_update())
    if not row:abort(404,description='Pedido não encontrado.')
    if row.status!='pendente':abort(409,description='Somente um pedido ainda em análise pode ser cancelado.')
    row.status='cancelado';row.resolvido_em=utcnow();g.db.commit();return jsonify(message='Pedido cancelado.')


@accounts.delete('/account')
@require_account
def delete_account():
    _auth_limit();data=body()
    if data.get('confirmation')!='EXCLUIR' or data.get('preserve_shared_history') is not True:
        abort(400,description='Confirme EXCLUIR e a preservação do histórico compartilhado.')
    password=data.get('password')
    if not isinstance(password,str) or not 1<=len(password)<=128:abort(400,description='Informe sua senha atual.')
    uid=g.user.id_usuario
    if current_app.config['DEMO_MODE']:
        valid=check_password_hash(g.user.demo_password_hash,password) if g.user.demo_password_hash else password=='LiseDemo123!'
        if not valid:abort(400,description='A senha atual está incorreta.')
    else:
        try:response=current_app.extensions['lise_auth_client']().auth.sign_in_with_password({'email':g.user.email,'password':password})
        except Exception:abort(400,description='Não foi possível confirmar a senha atual.')
        if not response.user or str(response.user.id)!=str(uid):abort(400,description='Não foi possível confirmar sua identidade.')
    g.db.scalar(select(Usuario).where(Usuario.id_usuario==uid).with_for_update())
    shared_owner=g.db.get(Usuario,SYSTEM_ID)
    if shared_owner and (shared_owner.perfil!='Sistema' or shared_owner.email!='acervo@lise.invalid'):
        abort(503,description='Não foi possível preparar a preservação do histórico. Nenhum dado foi removido.')
    if not shared_owner:
        g.db.add(Usuario(id_usuario=SYSTEM_ID,nome='Acervo de conta excluída',email='acervo@lise.invalid',perfil='Sistema'))
        g.db.flush()
    # Transfer only shared educational structures. Their users' grades must not cascade away.
    for model,owner in ((Turma,Turma.fk_professor),(Trilha,Trilha.fk_professor),(Avaliacao,Avaliacao.fk_professor)):
        for row in g.db.scalars(select(model).where(owner==uid)):
            row.fk_professor=SYSTEM_ID
            if isinstance(row,Turma):row.arquivada_em=utcnow();row.matriculas_abertas=False
            elif isinstance(row,Trilha):row.arquivada_em=utcnow()
            row.revisao+=1
    # Remove personal records; foreign-key cascades remove their private question snapshots.
    for model in (Sessao,OperacaoCrud,GameSession,AvaliacaoSessao,Partida,Matricula,Progresso,Flashcard,
                  FavoritoTermo,FavoritoRadical,Colecao,Recompensa,Conquista,AceiteLegal,PedidoPrivacidade):
        g.db.execute(delete(model).where(model.fk_usuario==uid))
    g.db.flush()
    for term in g.db.scalars(select(Termo).where(Termo.criado_por==uid)):
        dependencies=[g.db.scalar(select(model.id if hasattr(model,'id') else model.id_flashcard).where(model.fk_termo==term.id_termo).limit(1))
                      for model in (TrilhaTermo,ColecaoTermo,Partida,AvaliacaoQuestao,TermoTurma,Flashcard,FavoritoTermo,Progresso,Recompensa)]
        if any(dependencies):term.criado_por=None;term.status_conteudo='ARQUIVADO';term.revisao+=1
        else:g.db.delete(term)
    g.db.delete(g.user)
    if not current_app.config['DEMO_MODE']:g.db.add(ExclusaoAuthPendente(id=str(uid)))
    # Outbox and removal commit together. Auth failure cannot resurrect local sessions/data.
    g.db.commit()
    if current_app.config['DEMO_MODE']:
        return jsonify(message='Conta excluída. O histórico educacional de outras pessoas foi preservado sem sua autoria.',auth_pending=False)
    process_auth_deletions(current_app._get_current_object())
    g.db.expire_all()
    pending=g.db.get(ExclusaoAuthPendente,str(uid)) is not None
    return jsonify(message=('Seus dados e acessos na LISE foram removidos. A exclusão no serviço de autenticação será repetida automaticamente.' if pending else 'Conta excluída da LISE e do serviço de autenticação.'),auth_pending=pending),202 if pending else 200


def configure_account_deletion(app):
    import time
    import click
    last_run=[0.0]
    @app.before_request
    def retry_deletions():
        if app.config['DEMO_MODE'] or time.monotonic()-last_run[0]<60:return
        last_run[0]=time.monotonic()
        try:process_auth_deletions(app)
        except Exception as error:app.logger.warning('Fila de exclusão Auth indisponível: %s',type(error).__name__)
    @app.cli.command('process-account-deletions')
    def process_pending():
        click.echo(f'Exclusões concluídas no provedor: {process_auth_deletions(app,100)}')
    app.register_blueprint(accounts)
