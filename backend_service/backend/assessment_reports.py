"""Assessment history remains queryable after a trail leaves the teaching catalogue."""
import statistics
from collections import Counter
from flask import g
from sqlalchemy import select
from .models import Avaliacao,AvaliacaoSessao,AvaliacaoQuestao,TurmaTrilha,Trilha,Usuario,Matricula
from .services import aware,utcnow


def close_session(session, reason='concluida'):
    if session.finalizada_em:
        return session
    questions=g.db.scalars(select(AvaliacaoQuestao).where(AvaliacaoQuestao.fk_sessao==session.id)).all()
    session.corretas=sum(bool(q.respondida and q.correta) for q in questions)
    session.pontuacao=round(100*session.corretas/session.total) if session.total else 0
    session.aprovada=session.pontuacao>=session.nota_minima
    session.finalizada_em=utcnow()
    session.encerramento_motivo=reason
    return session


def session_result(session):
    questions=g.db.scalars(select(AvaliacaoQuestao).where(AvaliacaoQuestao.fk_sessao==session.id).order_by(AvaliacaoQuestao.posicao)).all()
    assessment=g.db.get(Avaliacao,session.fk_avaliacao)
    link=g.db.get(TurmaTrilha,assessment.fk_turma_trilha)
    return dict(class_id=link.fk_turma,session_id=session.id,score=session.pontuacao,correct=session.corretas,total=session.total,
                pass_score=session.nota_minima,passed=session.aprovada,
                finished_at=aware(session.finalizada_em).isoformat() if session.finalizada_em else None,
                reason=session.encerramento_motivo or 'concluida',
                questions=[dict(id=q.id,prompt=q.prompt,answered=q.respondida,correct=bool(q.correta),
                    selected=q.resposta_dada,
                    selected_label=next((o['label'] for o in q.opcoes if o['id']==q.resposta_dada),None),
                    correct_answer=q.resposta_esperada,
                    correct_label=next((o['label'] for o in q.opcoes if o['id']==q.resposta_esperada),''),
                    options=q.opcoes) for q in questions])


def distribution(scores):
    if not scores:return dict(count=0,mean=None,median=None,modes=[],minimum=None,maximum=None,histogram=[])
    counts=Counter(scores);largest=max(counts.values())
    modes=sorted(score for score,n in counts.items() if n==largest) if largest>1 or len(scores)==1 else []
    return dict(count=len(scores),mean=round(statistics.mean(scores),2),median=statistics.median(scores),modes=modes,
                minimum=min(scores),maximum=max(scores),histogram=[dict(label=f'{lo}-{hi}',count=sum(lo<=x<=hi for x in scores)) for lo,hi in [(0,19),(20,39),(40,59),(60,79),(80,100)]])


def duration_summary(seconds):
    if not seconds:
        return dict(count=0, mean_seconds=None, median_seconds=None,
                    minimum_seconds=None, maximum_seconds=None)
    return dict(count=len(seconds), mean_seconds=round(statistics.mean(seconds)),
                median_seconds=round(statistics.median(seconds)),
                minimum_seconds=min(seconds), maximum_seconds=max(seconds))


def class_assessments(class_row,user):
    teacher=class_row.fk_professor==user.id_usuario
    pairs=g.db.execute(select(Avaliacao,TurmaTrilha,Trilha).join(TurmaTrilha,TurmaTrilha.id==Avaliacao.fk_turma_trilha).join(Trilha,Trilha.id_trilha==TurmaTrilha.fk_trilha).where(TurmaTrilha.fk_turma==class_row.id_turma).order_by(Avaliacao.criada_em.desc())).all()
    roster=g.db.scalars(select(Usuario).join(Matricula,Matricula.fk_usuario==Usuario.id_usuario).where(Matricula.fk_turma==class_row.id_turma)).all()
    ids=[a.id for a,_,_ in pairs]
    sessions=g.db.scalars(select(AvaliacaoSessao).where(AvaliacaoSessao.fk_avaliacao.in_(ids)).order_by(AvaliacaoSessao.criada_em)).all() if ids else []
    now=utcnow();changed=False
    deadlines={a.id:a for a,_,_ in pairs}
    for session in sessions:
        a=deadlines[session.fk_avaliacao]
        if not session.finalizada_em and a.encerra_em and now>=aware(a.encerra_em):
            g.db.refresh(session,with_for_update=True)
            close_session(session,'prazo');changed=True
    if changed:g.db.flush()
    questions=g.db.scalars(select(AvaliacaoQuestao).where(AvaliacaoQuestao.fk_sessao.in_([s.id for s in sessions]))).all() if sessions else []
    current_ids={p.id_usuario for p in roster}
    historical_ids={s.fk_usuario for s in sessions}-current_ids
    historical=g.db.scalars(select(Usuario).where(Usuario.id_usuario.in_(historical_ids))).all() if teacher and historical_ids else []
    by_session={}
    for q in questions:by_session.setdefault(q.fk_sessao,[]).append(q)
    output=[]
    for assessment,link,trail in pairs:
        own=[s for s in sessions if s.fk_avaliacao==assessment.id and s.fk_usuario==user.id_usuario]
        latest=max(own,key=lambda s:aware(s.criada_em)) if own else None
        window='nao_agendado' if not assessment.abre_em or not assessment.encerra_em else 'agendado' if now<aware(assessment.abre_em) else 'encerrado' if now>=aware(assessment.encerra_em) else 'aberto'
        closed=bool(latest and latest.finalizada_em)
        status='concluida' if closed else 'em_andamento' if latest else 'atrasada' if window=='encerrado' else 'agendada' if window=='agendado' else 'pendente'
        item=dict(id=assessment.id,assignment_id=link.id,revision=assessment.revisao,title=assessment.titulo,trail=trail.nome,trail_deleted=bool(trail.excluida_em),archived=bool(link.desvinculada_em or trail.arquivada_em),
                  opens_at=aware(assessment.abre_em).isoformat() if assessment.abre_em else None,closes_at=aware(assessment.encerra_em).isoformat() if assessment.encerra_em else None,
                  window_state=window,status=status,question_count=assessment.quantidade,pass_score=assessment.nota_minima,
                  content=assessment.conteudo,mode=assessment.formato,
                  can_start=window=='aberto' and not trail.arquivada_em and not link.desvinculada_em and not any(s.janela_versao==assessment.janela_versao for s in own),
                  session_id=latest.id if latest else None,score=latest.pontuacao if closed else None,
                  reason=latest.encerramento_motivo if closed else None)
        if teacher:
            relevant=[s for s in sessions if s.fk_avaliacao==assessment.id]
            # The latest completed attempt per pupil is the explicit statistics denominator.
            latest_by_user={}
            for s in relevant:
                if s.finalizada_em:
                    prev=latest_by_user.get(s.fk_usuario)
                    if not prev or aware(s.finalizada_em)>aware(prev.finalizada_em):latest_by_user[s.fk_usuario]=s
            scores=[s.pontuacao for s in latest_by_user.values()]
            durations=[max(0,round((aware(s.finalizada_em)-aware(s.criada_em)).total_seconds()))
                       for s in latest_by_user.values()]
            rows=[]
            relevant_ids={s.fk_usuario for s in relevant}
            for pupil in [*roster,*[p for p in historical if p.id_usuario in relevant_ids]]:
                attempt=latest_by_user.get(pupil.id_usuario)
                rows.append(dict(user_id=str(pupil.id_usuario),name=pupil.nome,current_enrollment=pupil.id_usuario in current_ids,score=attempt.pontuacao if attempt else None,
                    correct=attempt.corretas if attempt else None,total=attempt.total if attempt else assessment.quantidade,
                    session_id=attempt.id if attempt else None,reason=attempt.encerramento_motivo if attempt else None,
                    status='concluida' if attempt else 'atrasada' if window=='encerrado' else 'pendente'))
            grouped={}
            for attempt in latest_by_user.values():
                for q in by_session.get(attempt.id,[]):
                    correct_label=next((o['label'] for o in q.opcoes if o['id']==q.resposta_esperada),'');key=(q.prompt,correct_label)
                    bucket=grouped.setdefault(key,dict(prompt=q.prompt,total=0,unanswered=0,legacy_unknown=0,options={o['label']:dict(label=o['label'],count=0,correct=o['id']==q.resposta_esperada) for o in q.opcoes}))
                    for option in q.opcoes:
                        bucket['options'].setdefault(option['label'],dict(label=option['label'],count=0,correct=option['id']==q.resposta_esperada))
                    bucket['total']+=1
                    picked=next((o['label'] for o in q.opcoes if o['id']==q.resposta_dada),None)
                    if picked is not None:bucket['options'][picked]['count']+=1
                    elif q.respondida:bucket['legacy_unknown']+=1
                    else:bucket['unanswered']+=1
            question_charts=[{**bucket,'options':list(bucket['options'].values())} for bucket in grouped.values()]
            responded={s.fk_usuario for s in relevant if any(q.respondida for q in by_session.get(s.id,[]))}
            item.update(students=rows,enrolled=len(roster),responded=len(responded),completed=len(latest_by_user),statistics=distribution(scores),timing=duration_summary(durations),questions=question_charts,
                        attempts=[dict(session_id=s.id,user_id=str(s.fk_usuario),score=s.pontuacao if s.finalizada_em else None,
                                       started_at=aware(s.criada_em).isoformat(),
                                       finished_at=aware(s.finalizada_em).isoformat() if s.finalizada_em else None,
                                       duration_seconds=max(0,round((aware(s.finalizada_em)-aware(s.criada_em)).total_seconds())) if s.finalizada_em else None)
                                  for s in relevant])
        output.append(item)
    if changed:g.db.commit()
    return output
