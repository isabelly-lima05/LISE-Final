"""Small shared guards for CRUD and optimistic concurrency."""
import hashlib
import json
import re
from functools import wraps
from datetime import timedelta
from flask import abort, g, jsonify, request
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from .models import OperacaoCrud, Usuario, utcnow


def revision(row, data):
    g.db.refresh(row, with_for_update=True)
    value=data.get('revision')
    if isinstance(value,bool) or not isinstance(value,int):
        abort(428,description='Recarregue este item antes de salvar. A revisão é obrigatória.')
    if value!=row.revisao:
        abort(409,description='Este item foi alterado em outro lugar. Recarregue e confira as mudanças antes de salvar.')
    row.revisao+=1


def ids(value, maximum=500):
    if not isinstance(value,list) or len(value)>maximum or any(isinstance(x,bool) or not isinstance(x,int) or x<1 for x in value):
        abort(400,description='Informe uma lista válida de identificadores.')
    if len(set(value))!=len(value):
        abort(400,description='A lista não pode repetir itens.')
    return value


def idempotent(fn):
    @wraps(fn)
    def wrapped(*args,**kwargs):
        key=request.headers.get('Idempotency-Key')
        if not key:return fn(*args,**kwargs)
        if not re.fullmatch(r'[A-Za-z0-9_-]{16,128}',key):
            abort(400,description='Identificador da operação inválido.')
        digest=hashlib.sha256(f'{g.user.id_usuario}:{key}'.encode()).hexdigest()
        signature=hashlib.sha256((request.path+json.dumps(request.get_json(silent=True),sort_keys=True,separators=(',',':'))).encode()).hexdigest()
        def cached(row):
            if row.assinatura!=signature:abort(409,description='Este identificador já foi utilizado para outra operação.')
            if row.resposta is None:abort(409,description='Esta operação está sendo concluída. Tente novamente com o mesmo identificador.')
            return jsonify(row.resposta),row.status_http
        old=g.db.get(OperacaoCrud,digest)
        if old:return cached(old)
        try:
            with g.db.begin_nested():
                g.db.add(OperacaoCrud(id=digest,fk_usuario=g.user.id_usuario,assinatura=signature))
                g.db.flush()
        except IntegrityError:
            return cached(g.db.get(OperacaoCrud,digest))
        g.crud_operation_id=digest
        return fn(*args,**kwargs)
    return wrapped


def configure_idempotency(app):
    @app.after_request
    def store_crud_response(response):
        ident=getattr(g,'crud_operation_id',None)
        if not ident:return response
        if response.status_code>=400:g.db.rollback()
        row=g.db.get(OperacaoCrud,ident)
        if row:
            if 200<=response.status_code<300:
                row.resposta=response.get_json();row.status_http=response.status_code
            elif response.status_code<500:g.db.delete(row)
            g.db.execute(delete(OperacaoCrud).where(OperacaoCrud.criada_em<utcnow()-timedelta(days=1),OperacaoCrud.resposta.is_not(None)).execution_options(synchronize_session=False))
            g.db.commit()
        return response
