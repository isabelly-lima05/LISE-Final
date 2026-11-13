"""CRUD with ownership checks, revisions and archive operations preserving history."""
import secrets
from datetime import timedelta
from flask import Blueprint, abort, g, jsonify, request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from .models import *
from .services import TZ, aware, owned_class, owned_trail, term_views, trail_views, visible_term
from .rest_api import (_body, _class_for_user, _collection_or_404, _collection_data,
                       _field, _parse_date, _parse_local_datetime, _require_user,
                       _student, _teacher, _trail_data, _assessment_config, _require_trail_content_editable)
from .crud_guards import ids, idempotent, revision

crud=Blueprint('lise_crud',__name__,url_prefix='/api/v1')


def serial_class(row):
    return dict(id=row.id_turma,name=row.nome,code=row.codigo,revision=row.revisao,
                archived_at=aware(row.arquivada_em).isoformat() if row.arquivada_em else None,
                enrollment_open=row.matriculas_abertas)


def active(row):
    if row.arquivada_em:abort(409,description='Restaure este item antes de alterá-lo ou atribuí-lo.')


def term_usage(ident):
    return dict(trails=g.db.scalar(select(func.count()).select_from(TrilhaTermo).where(TrilhaTermo.fk_termo==ident)) or 0,
                classes=g.db.scalar(select(func.count()).select_from(TermoTurma).where(TermoTurma.fk_termo==ident)) or 0,
                collections=g.db.scalar(select(func.count()).select_from(ColecaoTermo).where(ColecaoTermo.fk_termo==ident)) or 0,
                attempts=g.db.scalar(select(func.count()).select_from(Partida).where(Partida.fk_termo==ident)) or 0,
                assessments=g.db.scalar(select(func.count()).select_from(AvaliacaoQuestao).where(AvaliacaoQuestao.fk_termo==ident)) or 0,
                progress=g.db.scalar(select(func.count()).select_from(Progresso).where(Progresso.fk_termo==ident)) or 0,
                rewards=g.db.scalar(select(func.count()).select_from(Recompensa).where(Recompensa.fk_termo==ident)) or 0)


def own_term(ident):
    row=g.db.scalar(select(Termo).where(Termo.id_termo==ident,Termo.criado_por==g.user.id_usuario,Termo.origem_conteudo=='PERSONALIZADO'))
    if not row:abort(404,description='Termo não encontrado.')
    return row


@crud.patch('/classes/<int:ident>')
@_teacher
def class_update(ident):
    row=owned_class(g.db,g.user.id_usuario,ident);data=_body();revision(row,data)
    if 'name' in data:
        name=_field(data['name'],'nome da turma',150)
        if g.db.scalar(select(Turma.id_turma).where(Turma.fk_professor==g.user.id_usuario,Turma.id_turma!=ident,func.lower(Turma.nome)==name.lower(),Turma.arquivada_em.is_(None))):
            abort(409,description='Você já possui uma turma ativa com esse nome.')
        row.nome=name
    if 'enrollment_open' in data:
        if not isinstance(data['enrollment_open'],bool):abort(400,description='Configuração de matrícula inválida.')
        if data['enrollment_open'] and row.arquivada_em:abort(409,description='Restaure a turma antes de abrir matrículas.')
        row.matriculas_abertas=data['enrollment_open']
    g.db.commit();return jsonify(item=serial_class(row))


@crud.post('/classes/<int:ident>/archive')
@crud.post('/classes/<int:ident>/restore')
@_teacher
def class_archive(ident):
    row=owned_class(g.db,g.user.id_usuario,ident);revision(row,_body())
    row.arquivada_em=None if request.path.endswith('/restore') else utcnow()
    if row.arquivada_em:row.matriculas_abertas=False
    g.db.commit();return jsonify(item=serial_class(row))


@crud.post('/classes/<int:ident>/code')
@_teacher
def class_code(ident):
    row=owned_class(g.db,g.user.id_usuario,ident);data=_body();revision(row,data);active(row)
    if data.get('confirm') is not True:abort(400,description='Confirme que o código anterior deixará de funcionar.')
    for _ in range(10):
        code=''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
        if not g.db.scalar(select(Turma.id_turma).where(Turma.codigo==code)):
            row.codigo=code;g.db.commit();return jsonify(item=serial_class(row))
    abort(503,description='Não foi possível gerar o código.')


@crud.delete('/classes/<int:ident>')
@_teacher
def class_delete(ident):
    row=owned_class(g.db,g.user.id_usuario,ident);data=_body();revision(row,data)
    if not row.arquivada_em or data.get('confirmation')!=row.nome:
        abort(400,description='Arquive a turma e confirme seu nome exato antes da exclusão definitiva.')
    deps=[g.db.scalar(select(Matricula.id).where(Matricula.fk_turma==ident).limit(1)),
          g.db.scalar(select(TurmaTrilha.id).where(TurmaTrilha.fk_turma==ident).limit(1)),
          g.db.scalar(select(GameSession.id).where(GameSession.fk_turma==ident).limit(1)),
          g.db.scalar(select(TermoTurma.id).where(TermoTurma.fk_turma==ident).limit(1))]
    if any(deps):abort(409,description='A turma possui vínculos ou histórico e deve permanecer arquivada.')
    g.db.delete(row);g.db.commit();return jsonify(message='Turma excluída.')


@crud.delete('/classes/<int:ident>/students/<student_id>')
@_teacher
def remove_student(ident,student_id):
    owned_class(g.db,g.user.id_usuario,ident)
    if _body().get('confirm') is not True:abort(400,description='Confirme a retirada do aluno. O histórico será preservado.')
    row=g.db.scalar(select(Matricula).where(Matricula.fk_turma==ident,Matricula.fk_usuario==student_id))
    if not row:abort(404,description='Matrícula não encontrada.')
    g.db.delete(row);g.db.commit();return jsonify(message='Aluno removido da turma. O histórico não foi apagado.')


@crud.post('/classes/<int:ident>/leave')
@_student
def leave_class(ident):
    _class_for_user(ident)
    if _body().get('confirm') is not True:abort(400,description='Confirme a saída da turma.')
    g.db.execute(delete(Matricula).where(Matricula.fk_turma==ident,Matricula.fk_usuario==g.user.id_usuario));g.db.commit()
    return jsonify(message='Você saiu da turma. Suas atividades anteriores foram preservadas.')


@crud.get('/my-terms')
@_require_user
def own_terms():
    status='ARQUIVADO' if request.args.get('archived')=='1' else 'ATIVO'
    rows=g.db.scalars(select(Termo).where(Termo.criado_por==g.user.id_usuario,Termo.origem_conteudo=='PERSONALIZADO',Termo.status_conteudo==status).order_by(Termo.palavra_completa)).all()
    return jsonify(terms=[{**view,'revision':row.revisao,'archived':row.status_conteudo=='ARQUIVADO','usage':term_usage(row.id_termo)} for row,view in zip(rows,term_views(g.db,rows))])


@crud.get('/my-terms/<int:ident>')
@_require_user
def own_term_detail(ident):
    row=own_term(ident);return jsonify(item={**term_views(g.db,[row])[0],'revision':row.revisao,'archived':row.status_conteudo=='ARQUIVADO','usage':term_usage(ident)})


@crud.patch('/my-terms/<int:ident>')
@_require_user
def term_update(ident):
    row=own_term(ident);data=_body();revision(row,data)
    if any(term_usage(ident).values()) and data.get('confirm_impact') is not True:
        abort(409,description='Confirme que a edição será exibida nas trilhas e coleções que já utilizam o termo.')
    row.palavra_completa=_field(data.get('name'),'nome do termo',200)
    row.definicao_biologica=_field(data.get('definition'),'definição',5000)
    g.db.commit();return jsonify(item={**term_views(g.db,[row])[0],'revision':row.revisao})


@crud.post('/my-terms/<int:ident>/archive')
@crud.post('/my-terms/<int:ident>/restore')
@_require_user
def term_archive(ident):
    row=own_term(ident);revision(row,_body());row.status_conteudo='ATIVO' if request.path.endswith('/restore') else 'ARQUIVADO'
    g.db.commit();return jsonify(message='Termo restaurado.' if row.status_conteudo=='ATIVO' else 'Termo arquivado. Os vínculos existentes foram mantidos.',revision=row.revisao)


@crud.delete('/my-terms/<int:ident>')
@_require_user
def term_delete(ident):
    row=own_term(ident);revision(row,_body())
    deps=term_usage(ident)
    if any(deps.values()) or g.db.scalar(select(Flashcard.id_flashcard).where(Flashcard.fk_termo==ident).limit(1)) or g.db.scalar(select(FavoritoTermo.id).where(FavoritoTermo.fk_termo==ident).limit(1)):
        abort(409,description='Este termo possui vínculos ou histórico. Use Arquivar para preservar esses dados.')
    g.db.delete(row);g.db.commit();return jsonify(message='Termo excluído.')


@crud.post('/my-terms/<int:ident>/duplicate')
@_require_user
@idempotent
def term_duplicate(ident):
    source=own_term(ident)
    row=Termo(palavra_completa=(source.palavra_completa+' — cópia')[:200],definicao_biologica=source.definicao_biologica,
              fk_area=source.fk_area,criado_por=g.user.id_usuario,criado_pelo_professor=g.user.perfil=='Professor',origem_conteudo='PERSONALIZADO',status_conteudo='ATIVO')
    g.db.add(row);g.db.flush()
    for link in g.db.scalars(select(TermoRadical).where(TermoRadical.fk_termo==ident)):
        g.db.add(TermoRadical(fk_termo=row.id_termo,fk_radical=link.fk_radical,ordem=link.ordem,
                             forma_no_termo=link.forma_no_termo,funcao=link.funcao,significado_contextual=link.significado_contextual,
                             status_validacao=link.status_validacao,referencia_url=link.referencia_url,justificativa=link.justificativa))
    g.db.commit();return jsonify(item={**term_views(g.db,[row])[0],'revision':row.revisao}),201


@crud.patch('/trails/<int:ident>')
@_teacher
def trail_update(ident):
    row=owned_trail(g.db,g.user.id_usuario,ident);data=_body();revision(row,data);active(row)
    row.nome=_field(data.get('name'),'nome da trilha',150)
    row.descricao=_field(data.get('description',''),'descrição',3000,False)
    row.area=_field(data.get('area',''),'área',100,False)
    if 'term_ids' in data:
        wanted=ids(data['term_ids'])
        if not wanted:abort(400,description='Escolha ao menos um termo.')
        existing=g.db.scalars(select(TrilhaTermo).where(TrilhaTermo.fk_trilha==ident)).all();by_id={x.fk_termo:x for x in existing}
        for term_id in wanted:
            if term_id not in by_id:visible_term(g.db,g.user.id_usuario,term_id)
        removed=set(by_id)-set(wanted)
        link_ids=select(TurmaTrilha.id).where(TurmaTrilha.fk_trilha==ident)
        if set(by_id)!=set(wanted):
            _require_trail_content_editable(ident)
        if removed:
            practiced=g.db.scalar(select(Progresso.id).where(Progresso.fk_turma_trilha.in_(link_ids),Progresso.fk_termo.in_(removed)).limit(1))
            attempted=g.db.scalar(select(Partida.id).where(Partida.fk_turma_trilha.in_(link_ids),Partida.fk_termo.in_(removed)).limit(1))
            assessed=g.db.scalar(select(Avaliacao.id).where(Avaliacao.fk_turma_trilha.in_(link_ids)).limit(1))
            if practiced or attempted or assessed:abort(409,description='Não é possível remover palavras com prática ou avaliação vinculada. Crie uma nova trilha para alterar esse conteúdo.')
        for term_id,link in by_id.items():
            if term_id not in wanted:g.db.delete(link)
        for position,term_id in enumerate(wanted,1):
            if term_id in by_id:by_id[term_id].ordem=position
            else:g.db.add(TrilhaTermo(fk_trilha=ident,fk_termo=term_id,ordem=position))
        # Existing teacher-owned private content must remain shared with assigned classes.
        g.db.flush()
        from .rest_api import _bind_trail
        for klass in g.db.scalars(select(Turma).join(TurmaTrilha).where(TurmaTrilha.fk_trilha==ident,TurmaTrilha.desvinculada_em.is_(None))):_bind_trail(klass,row)
    g.db.commit();return jsonify(trail=_trail_data(row,g.user.id_usuario))


@crud.post('/trails/<int:ident>/archive')
@crud.post('/trails/<int:ident>/restore')
@_teacher
def trail_archive(ident):
    row=owned_trail(g.db,g.user.id_usuario,ident);revision(row,_body());row.arquivada_em=None if request.path.endswith('/restore') else utcnow()
    g.db.commit();return jsonify(trail=_trail_data(row,g.user.id_usuario))


def owned_assignment(class_id,ident):
    owned_class(g.db,g.user.id_usuario,class_id)
    row=g.db.scalar(select(TurmaTrilha).where(TurmaTrilha.id==ident,TurmaTrilha.fk_turma==class_id))
    if not row:abort(404,description='Atribuição não encontrada.')
    return row


@crud.patch('/classes/<int:class_id>/assignments/<int:ident>')
@_teacher
def assignment_update(class_id,ident):
    row=owned_assignment(class_id,ident);data=_body();revision(row,data)
    assessment=g.db.scalar(select(Avaliacao).where(Avaliacao.fk_turma_trilha==ident))
    if assessment and assessment.encerra_em:abort(409,description='O prazo segue o encerramento do BioQuiz. Altere o agendamento da avaliação quando permitido.')
    date=_parse_date(data.get('due_date'),'prazo')
    if date and date<utcnow().astimezone(TZ).date():abort(400,description='O prazo não pode estar no passado.')
    row.data_limite=date;g.db.commit();return jsonify(revision=row.revisao,message='Prazo atualizado.')


@crud.post('/classes/<int:class_id>/assignments/<int:ident>/archive')
@crud.post('/classes/<int:class_id>/assignments/<int:ident>/restore')
@_teacher
def assignment_archive(class_id,ident):
    row=owned_assignment(class_id,ident);revision(row,_body());row.desvinculada_em=None if request.path.endswith('/restore') else utcnow()
    if row.desvinculada_em is None:active(g.db.get(Turma,class_id));active(g.db.get(Trilha,row.fk_trilha))
    g.db.commit();return jsonify(message='Atribuição restaurada.' if row.desvinculada_em is None else 'Atribuição arquivada. Práticas e notas foram preservadas.',revision=row.revisao)


@crud.get('/classes/<int:class_id>/assignments/archived')
@_teacher
def assignments_archived(class_id):
    owned_class(g.db,g.user.id_usuario,class_id)
    rows=g.db.execute(select(TurmaTrilha,Trilha).join(Trilha).where(TurmaTrilha.fk_turma==class_id,TurmaTrilha.desvinculada_em.is_not(None))).all()
    return jsonify(assignments=[dict(id=l.id,name=t.nome,revision=l.revisao) for l,t in rows])


@crud.patch('/collections/<int:ident>')
@_require_user
def collection_update(ident):
    row=_collection_or_404(ident);data=_body();revision(row,data);row.nome=_field(data.get('name'),'nome da coleção',100)
    g.db.commit();return jsonify(collection=_collection_data(row,include_learning=True))


@crud.post('/classes/<int:class_id>/assignments/<int:ident>/assessment/<action>')
@_teacher
def assessment_lifecycle(class_id,ident,action):
    link=owned_assignment(class_id,ident);data=_body()
    row=g.db.scalar(select(Avaliacao).where(Avaliacao.fk_turma_trilha==ident))
    if not row:abort(404,description='Avaliação não encontrada.')
    revision(row,data);now=utcnow()
    attempts=g.db.scalar(select(AvaliacaoSessao.id).where(AvaliacaoSessao.fk_avaliacao==row.id).limit(1))
    if action=='cancel':
        if attempts or (row.abre_em and aware(row.abre_em)<=now):abort(409,description='Avaliação aberta ou com tentativas não pode ser cancelada.')
        row.abre_em=row.encerra_em=None;link.data_limite=None
    elif action=='close':
        if not row.abre_em or aware(row.abre_em)>now or not row.encerra_em or aware(row.encerra_em)<=now:abort(409,description='Somente uma avaliação aberta pode ser encerrada agora.')
        row.encerra_em=now;link.data_limite=now.astimezone(TZ).date()
    elif action=='reopen':
        if not row.encerra_em or aware(row.encerra_em)>now:abort(409,description='Encerre a janela atual antes de reabrir.')
        start=_parse_local_datetime(data.get('opens_at'),'abertura');end=_parse_local_datetime(data.get('closes_at'),'encerramento')
        if end<=start or end<=now:abort(400,description='Defina uma janela futura com fim posterior à abertura.')
        row.historico_janelas=[*(row.historico_janelas or []),dict(version=row.janela_versao,opens_at=aware(row.abre_em).isoformat() if row.abre_em else None,closes_at=aware(row.encerra_em).isoformat())]
        row.janela_versao+=1;row.abre_em=start;row.encerra_em=end;link.data_limite=end.astimezone(TZ).date()
    else:abort(404)
    g.db.commit();return jsonify(assessment=_assessment_config(link),message='Janela da avaliação atualizada. As notas anteriores foram preservadas.')
