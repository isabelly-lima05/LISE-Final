/* Telas de atividade e formulários; contratos preservados. */
(() => {
  'use strict';
  window.LiseActivities = ctx => {
    const {state,GAMES,fmtDate,fmtBrazilDate,dateTimeInputValue,sourceLink,gameTitle,loadingCard}=ctx;
    const {esc,button,empty,morphLabel,icon:iconMarkup}=window.LiseComponents;
  function renderNewCollection() {
    return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Coleções',action:'navigate',attrs:'data-view="collections"'}])}<div class="eyebrow" style="margin-top:1rem">Nova lista privada</div><h1 class="page-title">Criar coleção</h1><p>Pesquise no catálogo e marque somente os termos que deseja incluir.</p></div></div>
      <form class="card term-selection-form" data-form="collection-create"><div class="field"><label>Nome da coleção</label><input name="name" maxlength="100" required placeholder="Ex.: Revisão de citologia"></div>
      ${renderTermSelection()}<div class="card-actions"><button class="btn btn-primary" type="submit">Salvar coleção</button><button class="btn btn-plain" type="button" data-action="navigate" data-view="collections">Cancelar</button></div></form>`;
  }

  function renderCreateTrail() {
    const d=state.dashboard||{classes:[]};
    return `${window.LiseComponents.breadcrumb([{label:'Trilhas',action:'navigate',attrs:'data-view="trails"'},{label:'Criar trilha'}])}<div class="section-heading"><div><p class="eyebrow">Caminhos de aprendizagem</p><h1 class="page-title">Criar trilha</h1><p>Organize as informações, escolha as palavras e atribua às turmas.</p></div></div>
      <form class="card term-selection-form" data-form="trail-create">
      <ol class="trail-stepper" aria-label="Etapas da criação">${['Informações','Termos','Atribuição'].map((name,i)=>`<li><button type="button" data-step="${i}"><b>${i+1}</b>${name}</button></li>`).join('')}</ol>
      <section data-step-panel="0" aria-label="Informações"><div class="form-row"><div class="field"><label>Nome da trilha</label><input name="name" maxlength="150" required placeholder="Ex.: Sistema circulatório"></div><div class="field"><label>Área principal</label><select name="area"><option value="">Todas as áreas</option>${state.trailAreas.map(a=>`<option>${esc(a.name)}</option>`).join('')}</select></div></div><div class="field"><label>Descrição</label><textarea name="description" maxlength="3000" placeholder="Objetivo ou observação para os alunos"></textarea></div></section>
      <section data-step-panel="1" aria-label="Termos"><h2>Termos da trilha</h2>${renderTermSelection()}</section>
      <section data-step-panel="2" aria-label="Atribuição"><h2>Atribuir às turmas</h2><p>Esta etapa é opcional. Você também pode atribuir depois.</p>${d.classes.length?`<div class="field"><label>Prazo (opcional)</label><input type="date" name="due_date"></div><div class="checklist">${d.classes.map(c=>`<label class="check-row"><input type="checkbox" name="class_ids" value="${c.id}"><span><strong>${esc(c.name)}</strong> · código ${esc(c.code)}</span></label>`).join('')}</div>`:'<p>Crie uma turma depois para compartilhar esta trilha.</p>'}</section>
      <div class="trail-actions"><button class="btn btn-text" type="button" data-action="navigate" data-view="trails">Cancelar</button><button type="button" class="btn btn-outline" data-ui="step-prev">Voltar</button><button type="button" class="btn btn-primary" data-ui="step-next">Continuar</button><button class="btn btn-primary" type="submit">Salvar trilha</button></div></form>`;
  }

  function renderTermSelection() {
    const areas = state.trailAreas || [];
    state.termTab='existing';
    return `<div class="tabs" role="group" aria-label="Origem dos termos"><button class="tab active" type="button" data-action="term-tab" data-tab="existing">Termos existentes</button><button class="tab" type="button" data-action="term-tab" data-tab="mine">Meus termos</button><button class="tab" type="button" data-action="term-tab" data-tab="create">Criar novo termo</button></div>
      <div data-role="inline-term" hidden><div class="field"><label for="inline-name">Nome do termo</label><input id="inline-name" data-role="inline-name" maxlength="200"></div><div class="field"><label for="inline-definition">Definição</label><textarea id="inline-definition" data-role="inline-definition" maxlength="5000"></textarea></div><button class="btn btn-soft" type="button" data-action="inline-create">Criar e selecionar</button><p class="small muted">O termo será salvo em Meus termos e selecionado aqui. Salve a trilha ou coleção para concluir a inclusão.</p></div>
      <div class="toolbar"><input type="search" data-role="term-search" placeholder="Pesquise um termo ou definição para começar" autocomplete="off"><select data-role="term-area"><option value="">Todas as áreas</option>${areas.map(a=>`<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('')}</select><span class="muted small"><b data-role="selected-count">${state.selectedTermIds.size}</b> selecionado(s)</span></div>
      <div class="checklist" data-role="term-results">${state.catalogTerms.length ? renderTermChoices() : '<p class="muted small term-search-hint">Digite no campo de pesquisa para exibir termos.</p>'}</div>
      <aside class="selection-tray"><h3>Termos selecionados</h3><p class="small muted">Arraste para ordenar ou use as setas.</p><div class="selected-term-list" data-role="selected-term-list" aria-live="polite">${renderSelectedTerms()}</div></aside>
      <div class="term-selection-inputs" data-role="selected-term-inputs">${[...state.selectedTermIds].map(id=>`<input type="hidden" name="term_ids" value="${id}">`).join('')}</div>`;
  }

  function renderSelectedTerms() {
    if (!state.selectedTermIds.size) return '<p class="small muted">Nenhum termo selecionado.</p>';
    return `<div class="muted small">Selecionados:</div>${[...state.selectedTermIds].map(id=>{
      const term=state.selectedTermInfo.get(id);
      return `<span class="selected-term-chip" draggable="true" data-selected-id="${id}">${esc(term?.name || `Termo ${id}`)}<button type="button" class="reorder-button" data-action="reorder-term" data-id="${id}" data-direction="-1" aria-label="Mover ${esc(term?.name||'termo')} para antes">↑</button><button type="button" class="reorder-button" data-action="reorder-term" data-id="${id}" data-direction="1" aria-label="Mover ${esc(term?.name||'termo')} para depois">↓</button><button type="button" data-action="remove-selected-term" data-id="${id}" aria-label="Remover ${esc(term?.name || 'termo')}">×</button></span>`;
    }).join('')}`;
  }

  function renderTermChoices() {
    const rows = state.catalogTerms.filter(term => !state.existingTermIds.has(term.id));
    if (!rows.length) return '<p class="muted small">Nenhum termo novo encontrado.</p><button class="btn btn-soft" type="button" data-action="term-tab" data-tab="create">Criar novo termo</button>';
    return rows.map(term=>`<label class="check-row"><input type="checkbox" data-role="term-checkbox" value="${term.id}" ${state.selectedTermIds.has(term.id)?'checked':''}><span><strong>${esc(term.name)}</strong>${term.created_by_me ? ' <small class="chip gold">Criado por você</small>' : ''}<br><small class="muted">${esc(term.area)} · ${esc(term.definition)}</small><span class="term-choice-anatomy">${(term.radical_list||[]).map(r=>`<span data-tone="${window.LiseComponents.tone(r.type)}">${esc(r.observed_form||r.text)} · ${esc(r.meaning)}</span>`).join('')}</span></span></label>`).join('');
  }

  function renderAddTerms() {
    const target = state.termSelectionTarget;
    if (!target) return loadingCard();
    const isTrail = target.type === 'trail';
    return `<div class="section-heading"><div><button class="btn btn-plain btn-small" data-action="${isTrail?'navigate':'open-collection'}" ${isTrail?'data-view="dashboard"':`data-id="${target.id}"`}>← Voltar</button><div class="eyebrow" style="margin-top:1rem">${isTrail?'Trilha':'Coleção'}</div><h1 class="page-title">Adicionar termos</h1><p>Pesquise termos para incluir em “${esc(target.name)}”. Nenhum termo é exibido antes da busca.</p></div></div>
      <form class="card term-selection-form" data-form="${isTrail?'trail-add-terms':'collection-add-terms'}" data-target-id="${target.id}">${renderTermSelection()}<div class="card-actions"><button class="btn btn-primary" type="submit">Adicionar selecionados</button><button class="btn btn-plain" type="button" data-action="${isTrail?'navigate':'open-collection'}" ${isTrail?'data-view="dashboard"':`data-id="${target.id}"`}>Cancelar</button></div></form>`;
  }

  function renderTeacherTerm() {
    const d = state.dashboard || {classes:[], areas:[]};
    return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Painel',action:'navigate',attrs:'data-view="dashboard"'}])}<div class="eyebrow" style="margin-top:1rem">Termo personalizado</div><h1 class="page-title">Criar termo</h1><p>Informe somente o termo e a definição. Ele não será dividido automaticamente em radicais.</p></div></div>
      <form class="card" data-form="teacher-term"><div class="field"><label>Nome do termo</label><input name="name" maxlength="200" required></div><div class="field"><label>Definição</label><textarea name="definition" maxlength="5000" required></textarea></div><details class="optional-share"><summary>Compartilhar (opcional)</summary><div class="form-row"><div class="field"><span class="field-label">Turmas</span><div class="checklist">${d.classes.map(c=>`<label class="check-row"><input type="checkbox" name="class_ids" value="${c.id}"><span>${esc(c.name)}</span></label>`).join('')||'<p class="muted small">Você ainda não tem turmas.</p>'}</div></div><div class="field"><span class="field-label">Trilhas</span><div class="checklist">${(d.trails || []).map(t=>`<label class="check-row"><input type="checkbox" name="trail_ids" value="${t.id}"><span>${esc(t.name)}</span></label>`).join('') || '<p class="muted small">Você ainda não tem trilhas.</p>'}</div></div></div></details><button class="btn btn-primary" type="submit">Salvar termo</button></form>`;
  }

  function renderStudentTerm() {
    const collections = state.collections || [];
    return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Início',action:'navigate',attrs:'data-view="dashboard"'}])}<div class="eyebrow" style="margin-top:1rem">Termo personalizado</div><h1 class="page-title">Criar termo</h1><p>Informe o nome e a definição. Termos personalizados não recebem componentes etimológicos automaticamente.</p></div></div>
      <form class="card" data-form="student-term"><div class="field"><label>Nome do termo</label><input name="name" maxlength="200" required></div><div class="field"><label>Definição</label><textarea name="definition" maxlength="5000" required></textarea></div><div class="field"><label>Adicionar a uma coleção (opcional)</label><select name="collection_id"><option value="">Não adicionar agora</option>${collections.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><button class="btn btn-primary" type="submit">Salvar termo privado</button></form>`;
  }

  function renderStudentDetail() {
    const detail = state.studentDetail;
    if (!detail) return loadingCard();
    const s = detail.student;
    return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:detail.class_name,action:'back-to-class'},{label:s.name}])}<div class="eyebrow" style="margin-top:1rem">Acompanhamento da turma</div><h1 class="page-title">${esc(s.name)}</h1><p>${esc(s.email)} · Último acesso: ${fmtDate(s.last_access)}</p></div></div>
      <div class="student-overview"><div><div class="stat-card"><strong>${s.weekly_xp}</strong><span>XP nesta turma nesta semana</span></div></div><div>
      <div class="split-heading"><h2>Trilhas atribuídas nesta turma</h2></div>
      ${detail.trails.length ? `<div class="grid grid-2">${detail.trails.map(t=>{
        const schedule=t.assessment?.opens_at && t.assessment?.closes_at
          ? `BioQuiz: ${fmtBrazilDate(t.assessment.opens_at)} até ${fmtBrazilDate(t.assessment.closes_at)}.`
          : t.assessment ? 'O BioQuiz ainda não foi agendado.' : '';
        return `<article class="card"><div class="card-top"><span class="chip">${esc(t.area)}</span><span class="chip ${['atrasado','concluida_com_atraso'].includes(t.status)?'danger':'gold'}">${esc(t.status_label)}</span></div><h3>${esc(t.name)}</h3><p>${t.played} de ${t.total} termos praticados (${t.percent}%)</p><div class="progress-track"><div class="progress-fill" style="width:${t.percent}%"></div></div><p class="muted small">Prazo da trilha: ${t.due_date?fmtBrazilDate(t.due_date):'Sem prazo'}</p>${schedule?`<p class="muted small">${schedule} O prazo da trilha termina no encerramento.</p>`:''}<p>${t.completed?'Trilha concluída.':t.assessment?.passed?'BioQuiz aprovado; falta praticar todos os termos.':t.assessment?'BioQuiz ainda não aprovado.': 'BioQuiz ainda não configurado pelo professor.'}</p>${!t.assessment?button('Configurar BioQuiz','configure-assessment','btn-soft',`data-assignment="${t.assignment_id}" data-class="${state.classId}" data-name="${esc(t.name)}"`):''}${t.attempts.length?`<div class="table-wrap"><table style="min-width:0"><thead><tr><th>Tentativa</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead><tbody>${t.attempts.map((a,i)=>`<tr><td>${i+1}</td><td>${a.score}%</td><td>${a.passed?'Aprovado':'Não aprovado'}</td><td>${fmtDate(a.played_at)}</td></tr>`).join('')}</tbody></table></div>`:''}</article>`;
      }).join('')}</div>`:empty('Nenhuma trilha atribuída', 'Esta turma ainda não tem trilhas para acompanhar.')}</div></div>`;
  }

  function renderAssessmentConfig() {
    const target=state.assessmentTarget;
    if (!target) return loadingCard();
    const a=target.assessment || {};
    return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Turma',action:'back-to-class'},{label:'Configurar BioQuiz'}])}<div class="eyebrow" style="margin-top:1rem">BioQuiz final da trilha</div><h1 class="page-title">${a.id?'Editar BioQuiz':'Configurar BioQuiz'}</h1><p>${esc(target.trail_name)} · O aluno só poderá iniciar depois de praticar todos os termos e durante esta janela, no fuso de Brasília. O encerramento também encerra o prazo da trilha.</p></div></div>
      <form class="card question" data-form="assessment-config"><div class="field"><label>Título</label><input name="title" maxlength="150" required value="${esc(a.title || `BioQuiz: ${target.trail_name}`)}"></div><div class="form-row"><div class="field"><label>Quantidade de questões</label><input name="question_count" type="number" min="1" max="50" value="${a.question_count || 10}" required></div><div class="field"><label>Nota mínima (%)</label><input name="pass_score" type="number" min="0" max="100" value="${a.pass_score ?? 70}" required></div></div><div class="form-row"><div class="field"><label>Abre em (Brasília)</label><input name="opens_at" type="datetime-local" value="${dateTimeInputValue(a.opens_at)}" required></div><div class="field"><label>Encerra em (Brasília)</label><input name="closes_at" type="datetime-local" value="${dateTimeInputValue(a.closes_at)}" required></div></div><div class="form-row"><div class="field"><label>Conteúdo</label><select name="content"><option value="ambos" ${!a.content||a.content==='ambos'?'selected':''}>Termos e radicais</option><option value="termos" ${a.content==='termos'?'selected':''}>Somente termos</option><option value="radicais" ${a.content==='radicais'?'selected':''}>Somente radicais</option></select></div><div class="field"><label>Formato</label><select name="mode"><option value="misto" ${!a.mode||a.mode==='misto'?'selected':''}>Misto</option><option value="termo_definicao" ${a.mode==='termo_definicao'?'selected':''}>Termo para definição</option><option value="definicao_termo" ${a.mode==='definicao_termo'?'selected':''}>Definição para termo</option><option value="radical_significado" ${a.mode==='radical_significado'?'selected':''}>Elemento para significado</option><option value="significado_radical" ${a.mode==='significado_radical'?'selected':''}>Significado para elemento</option></select></div></div><button class="btn btn-primary" type="submit">Salvar agendamento</button></form>`;
  }

  function renderAssessment() {
    const session=state.assessmentSession;
    if (!session) return loadingCard();
    const q=session.questions[state.assessmentIndex];
    if (!q) return loadingCard('Preparando avaliação…');
    const progress=Math.round(state.assessmentIndex/session.total*100);
    return `<section class="card question"> <div class="eyebrow">BioQuiz final · Questão ${state.assessmentIndex+1} de ${session.total}</div><p class="muted small">Prazo final: ${fmtBrazilDate(session.closes_at)} (horário de Brasília)</p><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><h1 class="question-title">${esc(q.prompt)}</h1>${state.assessmentAnswer?`<div class="feedback ${state.assessmentAnswer.correct?'good':'bad'}"><strong>${state.assessmentAnswer.correct?'Resposta correta':'Resposta incorreta'}</strong><p>Resposta: ${esc(state.assessmentAnswer.answer)}</p></div><div class="card-actions">${button(state.assessmentIndex+1<session.total?'Próxima questão':'Finalizar BioQuiz','assessment-next','btn-primary')}</div>`:`<form data-form="assessment-answer"><div class="option-list">${q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o.id)}" required><span>${esc(o.label)}</span></label>`).join('')}</div><button class="btn btn-primary" type="submit">Responder</button></form>`}</section>`;
  }

  function renderAssessmentResult() {
    const r=state.assessmentResult;
    if (!r) return loadingCard();
    return `<section class="card question" style="text-align:center"><div class="eyebrow">Avaliação concluída</div><h1 class="page-title">${r.score}%</h1><p>Você acertou ${r.correct} de ${r.total} questões. Nota mínima: ${r.pass_score}%.</p><p class="chip ${r.passed?'gold':''}">${r.passed?'Avaliação aprovada':'Tente novamente depois de revisar a trilha'}</p><div class="card-actions" style="justify-content:center">${button('Voltar à turma','open-class','btn-primary',`data-id="${state.classId}"`)}</div></section>`;
  }

  function renderRank(d) {
    const rows = d.weekly_leaderboard || [];
    const formatDay = value => value ? new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : '';
    return `<div class="card"><div class="card-top"><div><h2>Ranking semanal de XP</h2><p class="muted small">XP conquistado em atividades realizadas nesta turma entre segunda-feira e domingo.</p></div><span class="chip gold">${formatDay(d.week_start)} a ${formatDay(d.week_end)}</span></div>${rankTable(rows)}</div>`;
  }

  function rankTable(rows) {
    return rows.length ? `<div class="table-wrap"><table style="min-width:0"><thead><tr><th>#</th><th>Aluno</th><th>XP</th></tr></thead><tbody>${rows.map(r=>`<tr ${r.is_me?'style="background:#f2f6ef"':''}><td class="rank">${r.rank}</td><td>${esc(r.name)} ${r.is_me?'<small class="chip">Você</small>':''}</td><td><strong>${r.xp}</strong></td></tr>`).join('')}</tbody></table></div>` : empty('Sem alunos para ranquear', 'O ranking aparece quando estudantes entram na turma.');
  }

  function renderAssessmentResults(rows) {
    return `<div class="card"><h2>Notas das avaliações de trilha</h2><p class="muted small">A avaliação é uma etapa do professor, separada dos jogos de prática.</p>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Aluno</th><th>Trilha</th><th>Avaliação</th><th>Nota</th><th>Resultado</th><th>Data</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${esc(q.student)}</td><td>${esc(q.trail)}</td><td>${esc(q.assessment)}</td><td><strong>${q.score}%</strong><br><small class="muted">${q.correct}/${q.total} questões</small></td><td><span class="chip ${q.passed?'gold':''}">${q.passed?'Aprovado':'Não aprovado'}</span></td><td>${fmtDate(q.played_at)}</td></tr>`).join('')}</tbody></table></div>` : empty('Nenhuma avaliação concluída', 'Configure uma avaliação em uma trilha atribuída para registrar as notas dos alunos.')}</div>`;
  }

  function renderClassTrails(d, teacher) {
    const trails = d.trails || [];
    let assign = '';
    if (teacher) {
      const used = new Set(trails.map(t=>t.id));
      const available = (d.available_trails || []).filter(t=>!used.has(t.id));
      assign = `<div class="card-actions">${button('Atribuir trilha','open-assign')}${button('Criar trilha','new-trail','btn-soft')}</div><dialog id="assign-trail-dialog" class="app-dialog" aria-labelledby="assign-title"><div class="dialog-heading"><h2 id="assign-title">Atribuir trilha</h2>${button('×','close-dialog','icon-button','aria-label="Fechar atribuição"')}</div><form data-form="assign-trail" class="toolbar"><label for="assign-trail">Trilha</label><select id="assign-trail" name="trail_id" required><option value="">Escolha uma trilha…</option>${available.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><label for="assign-date">Prazo (opcional)</label><input id="assign-date" type="date" name="due_date"><button class="btn btn-primary" type="submit">Atribuir</button></form></dialog>`;
    }
    return `${assign}${trails.length ? `<div class="grid grid-2">${trails.map(t=>{
      const learning=t.status_label ? `<div class="trail-progress"><span>${t.played || 0} de ${t.total || t.terms?.length || 0} termos praticados</span><span class="chip ${['atrasado','concluida_com_atraso'].includes(t.status)?'danger':''}">${esc(t.status_label)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${t.progress ?? 0}%"></div></div>` : `<p class="muted small">${t.terms?.length||0} termos · <span class="chip ${t.due_date?(new Date(t.due_date)<new Date()?'danger':'warning'):'neutral'}">${t.due_date?`Prazo: ${fmtDate(t.due_date,false)}`:'Sem prazo definido'}</span></p>`;
      const quizLabel=!t.assessment?.opens_at ? 'BioQuiz sem horário' :
        t.assessment.window_state==='agendado' ? `Abre ${fmtBrazilDate(t.assessment.opens_at)}` :
        t.assessment.window_state==='encerrado' ? 'Prazo do BioQuiz encerrado' :
        t.assessment.can_start ? (t.assessment.passed?'Refazer BioQuiz':'Fazer BioQuiz') : 'Pratique todos os termos primeiro';
      const assessmentAction=teacher ? button(t.assessment?.opens_at?(new Date(t.assessment.opens_at)<=new Date()?'Ver avaliação':'Editar agendamento'):'Configurar avaliação','configure-assessment','btn-soft btn-small',`data-assignment="${t.assignment_id}" data-trail="${t.id}" data-name="${esc(t.name)}" data-class="${d.id}"`) : t.assessment ? button(quizLabel,'start-assessment',t.assessment.can_start?'btn-primary btn-small':'btn-plain btn-small',`data-assignment="${t.assignment_id}" data-class="${d.id}" ${t.assessment.can_start?'':'disabled'}`) : '<span class="muted small">Aguardando avaliação do professor</span>';
      const quizSchedule=t.assessment ? (t.assessment.opens_at && t.assessment.closes_at ?
        `<p class="muted small">BioQuiz: ${fmtBrazilDate(t.assessment.opens_at)} até ${fmtBrazilDate(t.assessment.closes_at)}. O prazo da trilha termina junto.</p>` :
        '<p class="muted small">O professor ainda não agendou o BioQuiz.</p>') : '';
      const practice=teacher?'':button('Praticar trilha','practice-trail','btn-primary btn-small',`data-assignment="${t.assignment_id}" data-trail="${t.id}" data-name="${esc(t.name)}" data-class="${d.id}"`);
      return `<article class="card"><div class="card-top"><span class="chip">${esc(t.area)}</span>${teacher?button('Remover da turma','unassign-trail','btn-danger btn-small',`data-id="${t.id}" data-class="${d.id}"`):`<span class="chip gold">${t.progress ?? 0}%</span>`}</div><h3>${esc(t.name)}</h3>${learning}${quizSchedule}${teacher?`<p><span class="chip ${t.assessment?'warning':'neutral'}">${!t.assessment?.opens_at?'Não configurada':new Date(t.assessment.closes_at)<new Date()?'Encerrada':new Date(t.assessment.opens_at)<=new Date()?'Aberta':'Agendada'}</span></p>`:''}<div class="card-actions">${teacher?`${button('Ver termos','open-trail','btn-plain btn-small',`data-id="${t.id}" data-assignment="${t.assignment_id}"`)}${assessmentAction}`:button('Ver termos','open-trail','btn-plain btn-small',`data-id="${t.id}" data-assignment="${t.assignment_id}"`)}${!teacher?assessmentAction:''}${practice}</div></article>`;
    }).join('')}</div>` : empty('Nenhuma trilha atribuída', teacher ? 'Crie uma trilha ou atribua uma das existentes.' : 'Seu professor ainda não atribuiu uma trilha a esta turma.')}`;
  }

  function renderSources() {
    const s = state.sources;
    if (!s) return loadingCard();
    const areaCards = s.areas.map(a=>`<button class="card" data-action="choose-source" data-type="area" data-name="${esc(a.name)}"><span class="chip">Área</span><h3>${esc(a.name)}</h3><p>Termos cadastrados nesta área.</p></button>`).join('');
    const trailCards = s.trails.map(t=>`<button class="card" data-action="choose-source" data-type="trail" data-id="${t.assignment_id}" data-class="${t.class_id}" data-name="${esc(t.name)}"><span class="chip gold">${esc(t.class_name)}</span><h3>${esc(t.name)}</h3><p>Trilha atribuída · ${esc(t.area)}</p></button>`).join('');
    const collectionCards = s.collections.map(c=>`<button class="card" data-action="choose-source" data-type="collection" data-id="${c.id}" data-name="${esc(c.name)}"><span class="chip">Coleção</span><h3>${esc(c.name)}</h3><p>Suas palavras selecionadas.</p></button>`).join('');
    return `<div class="section-heading"><div><button class="btn btn-plain btn-small" data-action="games-back">← Praticar</button><div class="eyebrow" style="margin-top:1rem">${state.practiceGame ? esc(gameTitle(state.practiceGame)) : 'Escolha um jogo'}</div><h1 class="page-title">Escolha o conteúdo</h1><p>Os jogos montam perguntas automaticamente a partir dos seus termos, radicais e relações cadastrados.</p></div></div>
      <div class="card-actions" style="margin-bottom:1rem">${button(`Favoritos (${s.favorites_count})`, 'choose-source', 'btn-soft', 'data-type="favorites" data-name="Seus favoritos"')}</div>
      ${s.trails.length ? `<div class="split-heading"><h2>Trilhas das suas turmas</h2></div><div class="grid grid-3">${trailCards}</div>` : ''}
      ${s.collections.length ? `<div class="split-heading"><h2>Suas coleções</h2></div><div class="grid grid-3">${collectionCards}</div>` : `<div class="notice">Você ainda não tem coleção. Crie uma em Coleções ou pratique por área.</div>`}
      <div class="split-heading"><h2>Áreas</h2></div><div class="grid grid-3">${areaCards}</div>`;
  }

  function renderGameConfig() {
    const game = GAMES.find(g=>g.id===state.practiceGame);
    const source = state.practiceSource;
    const modeSelector = state.practiceGame === 'memoria' ? `<div class="field"><label>Tipo de pares</label><select name="mode"><option value="termo_definicao">Termos e definições</option><option value="radical_significado">Elementos e significados validados</option></select></div>` : state.practiceGame === 'bioquiz' ? `<div class="field"><label>Formato das perguntas</label><select name="mode">${game.modes.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div>` : '';
    const entries=(state.availability||[]).filter(item=>item.game===state.practiceGame);
    const selected=entries.find(item=>item.mode===(state.configMode || (state.practiceGame==='bioquiz'?'misto':'termo_definicao')));
    const target=state.practiceGame==='memoria'?6:state.practiceGame==='familia_palavras'?5:10;
    const notice=state.availabilityError || (!state.availability?'Verificando conteúdo disponível…':!selected?.available?(selected?.reason || 'Conteúdo indisponível.'):state.practiceGame==='familia_palavras'?`${selected.count} desafio(s) de associação, com até 10 termos.`:`${selected.count} ${state.practiceGame==='memoria'?'pares':'questões'} nesta partida.${selected.count<target?' Modo reduzido: usa todo o conteúdo compatível, sem repetir termos.':''}`);
    return `<div class="section-heading"><div><button class="btn btn-plain btn-small" data-action="choose-game-back">← Praticar</button><div class="eyebrow">Preparar prática</div><h1 class="page-title">${esc(game?.title || '')}</h1><p>Conteúdo: <strong>${esc(source?.name || '')}</strong></p></div></div><form class="card question" data-form="game-config">${modeSelector}<p class="notice" role="status">${esc(notice)}</p><button class="btn btn-primary" type="submit" ${!selected?.available?'disabled':''}>Começar</button></form>`;
  }

  function renderGameQuestion() {
    const session = state.gameSession;
    if (!session) return loadingCard();
    const question = session.questions[state.gameIndex];
    if (!question) { return ''; }
    const isMemory=session.game==='memoria',pairs=question.cards?.length/2||0;
    const progress = isMemory?Math.round(state.memoryPairs.length/(pairs||1)*100):Math.round(state.gameIndex/session.questions.length*100);
    const header = `<div class="eyebrow">${esc(gameTitle(session.game))} · ${isMemory?`Pares ${state.memoryPairs.length}/${pairs}`:`Questão ${state.gameIndex+1} de ${session.questions.length}`}</div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>`;
    if (state.gameFeedback) {
      const f = state.gameFeedback.feedback || {};
      const correctText = f.correct_answer ? `<p>Resposta: <strong>${esc(f.correct_answer)}</strong></p>` : '';
      const explanation=f.definition?`<p>${esc(f.definition)}</p>`:'';
      const roots=f.radicals?.length?window.LiseComponents.anatomy({name:f.correct_answer||'Elementos do desafio',radical_list:f.radicals}):'';
      const family = f.correct_terms?.length ? `<div class="family-feedback"><p><strong>Você marcou corretamente:</strong> ${f.correct_selected?.length ? f.correct_selected.map(esc).join(', ') : 'nenhum termo'}</p><p><strong>Faltaram:</strong> ${f.omitted_terms?.length ? f.omitted_terms.map(esc).join(', ') : 'nenhum termo'}</p><p><strong>Não se aplicavam:</strong> ${f.incorrect_terms?.length ? f.incorrect_terms.map(esc).join(', ') : 'nenhum termo'}</p><p><strong>Termos relacionados:</strong> ${f.correct_terms.map(esc).join(', ')}</p></div>` : '';
      const favorites = [...(f.favorite_terms || []).map(x=>({ ...x, type:'term', text:x.name })), ...(f.favorite_radicals || []).map(x=>({ ...x, type:'radical', text:x.name }))];
      const favoriteActions = favorites.length ? `<div class="card-actions">${favorites.map(x=>button(`${x.favorite?'Favorito':'Favoritar'}: ${esc(x.text)}`, 'toggle-game-favorite', x.favorite?'btn-soft btn-small':'btn-plain btn-small', `data-favorite="${x.favorite}" data-type="${x.type}" data-id="${x.id}"`)).join('')}</div>` : '';
      const radicalReveal=f.radical?`<p>Radical: <strong>${esc(f.radical)}</strong></p>`:'';
      return `<section class="card question">${header}<div class="feedback ${state.gameFeedback.correct?'good':'bad'}"><strong>${state.gameFeedback.correct ? 'Muito bem!' : 'Vamos revisar esta resposta.'}</strong><p>${state.gameFeedback.correct ? `Você recebeu ${state.gameFeedback.xp || 0} XP.` : 'Confira a resposta correta e tente novamente na próxima rodada.'}</p>${correctText}${explanation}${roots}${family}${radicalReveal}</div>${favoriteActions}<div class="card-actions">${button(state.gameIndex+1 < session.questions.length ? 'Próxima questão →' : 'Ver resultado', 'next-question', 'btn-primary')}</div></section>`;
    }
    if (session.game === 'familia_palavras') return `<section class="card question">${header}<form data-form="game-answer"><h2 class="question-title">Leia o significado: “${esc(question.prompt)}”</h2><p>Marque todos os termos que usam esse radical. Você pode escolher várias palavras.</p><div class="option-list">${question.options.map(o=>`<label class="option"><input type="checkbox" name="answer" value="${o.id}"><span>${esc(o.name)}</span></label>`).join('')}</div><button class="btn btn-primary">Conferir termos</button></form></section>`;
    if (session.game === 'bioquiz') return `<section class="card question">${header}<form data-form="game-answer"><h2 class="question-title">${esc(question.prompt)}</h2><div class="option-list">${question.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${esc(o.id)}" required><span>${esc(o.text)}</span></label>`).join('')}</div><button class="btn btn-primary">Responder</button></form></section>`;
    if (session.game === 'decifrador') {
      if (state.decipherSlots.length !== question.letters.length) {
        state.decipherSlots = question.letters.map(() => null);
        state.decipherSelectedLetter = null;
      }
      const placed = new Set(state.decipherSlots.filter(index => index !== null));
      const letters = question.letters.map((letter, index) => placed.has(index) ? '' : `<li><button class="decipher-letter ${state.decipherSelectedLetter===index?'selected':''}" type="button" draggable="true" data-action="decipher-letter" data-letter-index="${index}" aria-label="Letra ${esc(letter)}" aria-pressed="${state.decipherSelectedLetter===index}">${esc(letter)}</button></li>`).join('');
      const slots = state.decipherSlots.map((letterIndex, position) => {
        const letter = letterIndex === null ? '' : question.letters[letterIndex];
        const selected = letterIndex !== null && state.decipherSelectedLetter === letterIndex;
        return `<li><button class="decipher-slot ${letterIndex===null?'empty':''} ${selected?'selected':''}" type="button" data-action="decipher-slot" data-decipher-drop="slot" data-slot-index="${position}" ${letterIndex===null?'':`draggable="true" data-letter-index="${letterIndex}"`} aria-label="${letterIndex===null?`Espaço ${position+1} vazio`:`Letra ${esc(letter)}, posição ${position+1}`}" ${letterIndex===null?'':'aria-pressed="'+selected+'"'}>${esc(letter)}</button></li>`;
      }).join('');
      const complete = state.decipherSlots.every(index => index !== null);
      return `<section class="card question">${header}<h2 class="question-title">Que termo corresponde a esta definição?</h2><p>${esc(question.clue)}</p><div class="decipher-board"><div><p class="field-label">Letras disponíveis</p><div class="decipher-bank" data-decipher-drop="bank"><ul class="decipher-letters">${letters}</ul></div></div><div class="decipher-answer"><p class="field-label">Monte a palavra</p><ol class="decipher-slots" aria-label="Caixa de resposta">${slots}</ol></div></div><p class="muted small">Arraste cada letra para um espaço. Para retirar, arraste-a de volta às letras disponíveis. No toque, selecione uma letra e depois o espaço; toque numa letra preenchida para devolvê-la.</p><form data-form="game-answer"><button class="btn btn-primary" type="submit" ${complete?'':'disabled'}>Conferir</button></form></section>`;
    }
    if (session.game === 'memoria') {
      const cards = question.cards || [];
      const seconds=Math.max(0,Math.floor((Date.now()-(state.memoryStartedAt||Date.now()))/1000));
      const elapsed=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
      return `<section class="card question">${header}<h2 class="question-title">Encontre os pares</h2><p class="muted">${question.mode === 'termo_definicao' ? 'Termo e definição' : 'Elemento e significado validados'}. Vire dois cartões para conferir a combinação.</p><div class="memory-grid" style="--memory-columns:${Math.ceil(cards.length/2)}">${cards.map(c=>`<button class="memory-card ${state.memoryMatched.has(c.id)?'matched':''} ${state.memorySelected.includes(c.id)?'selected':''} ${state.memoryMismatch&&state.memorySelected.includes(c.id)?'mismatch':''}" type="button" aria-label="${state.memoryMatched.has(c.id)?'Par encontrado':state.memorySelected.includes(c.id)?esc(c.text):'Virar carta '+(cards.indexOf(c)+1)}" data-action="memory-card" data-card="${esc(c.id)}" ${state.memoryMatched.has(c.id)||state.memoryLocked?'disabled':''}><span class="memory-card-inner"><span class="memory-back" aria-hidden="true">${iconMarkup('dna')}<span>LISE</span></span><span class="memory-front" aria-hidden="${!state.memoryMatched.has(c.id)&&!state.memorySelected.includes(c.id)}">${esc(c.text)}</span></span></button>`).join('')}</div><p class="muted small">Pares: ${state.memoryPairs.length}/${cards.length/2} · Tentativas: ${state.memoryAttempts} · Tempo: ${elapsed}</p>${state.memoryCompleting?'<p role="status">Salvando resultado…</p>':state.memoryCompletionError?`<p class="notice" role="alert">${esc(state.memoryCompletionError)}</p>${button('Tentar salvar resultado novamente','memory-complete','btn-primary')}`:''}</section>`;
    }
    return '';
  }

  function renderResult() {
    const r = state.result;
    if (!r) return loadingCard();
    return `<div class="question card" style="text-align:center"><div class="eyebrow">Prática concluída</div>${state.practiceGame==='memoria'?`<div class="memory-progress"><span>Pares: <strong>${state.memoryPairs.length}</strong></span><span>Tentativas: <strong>${state.memoryAttempts}</strong></span><span>Tempo: <strong>${state.memoryElapsed??Math.floor((Date.now()-state.memoryStartedAt)/1000)}s</strong></span></div>`:''}<h1 class="page-title">${r.score}%</h1><p>Você acertou ${r.correct} de ${r.total} questões e recebeu <strong data-count="${r.xp}" data-count-suffix=" XP">${r.xp} XP</strong>.</p><div class="card-actions" style="justify-content:center">${button('Jogar novamente', 'again-game', 'btn-primary')} ${button('Voltar aos Games', 'nav-games', 'btn-soft')} ${state.classId ? button('Voltar para a turma', 'open-class', 'btn-plain', `data-id="${state.classId}"`) : ''}</div></div>`;
  }

  function renderSmallForm(view) {
    if (view === 'new-class') return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Painel',action:'navigate',attrs:'data-view="dashboard"'}])}<div class="eyebrow" style="margin-top:1rem">Professor</div><h1 class="page-title">Criar turma</h1><p>Depois de criar, compartilhe o código de entrada com seus alunos.</p></div></div><form class="card question" data-form="new-class"><div class="field"><label>Nome da turma</label><input name="name" maxlength="150" required placeholder="Ex.: 3º ano A"></div><button class="btn btn-primary">Criar turma</button></form>`;
    if (view === 'join-class') return `<div class="section-heading"><div>${window.LiseComponents.breadcrumb([{label:'Início',action:'navigate',attrs:'data-view="dashboard"'}])}<div class="eyebrow" style="margin-top:1rem">Entrar em uma turma</div><h1 class="page-title">Digite o código</h1><p>Peça ao professor o código de seis caracteres da turma.</p></div></div><form class="card question" data-form="join-class"><div class="field"><label>Código da turma</label><input name="code" maxlength="6" required autocapitalize="characters" placeholder="ABC234"></div><button class="btn btn-primary">Entrar na turma</button></form>`;
    return '';
  }

  function learningPanel(learning) {
    if(!learning) return '';
    return `<section class="learning-panel card"><h2>Seu aprendizado</h2><div class="grid grid-3"><div><strong>${learning.coverage}%</strong><p>Cobertura · ${learning.practiced} de ${learning.total} termos praticados</p></div><div><strong>${learning.attempts}</strong><p>Interações · ${learning.correct} acertos e ${learning.errors} erros</p></div><div><strong>${learning.consistent}</strong><p>Termos com desempenho consistente</p></div></div><div class="progress-track"><div class="progress-fill" style="width:${learning.coverage}%"></div></div><p class="small muted">Cobertura completa significa que todos os termos foram praticados. Consistência: ao menos 3 interações e 80% de acerto; é um indicador de revisão, não uma certificação de domínio.</p></section>`;
  }

  function renderRadicalDetail() {
    if (!state.detail) return loadingCard();
    if (state.detailType === 'term') {
      const { term, similar_terms: similar } = state.detail;
      const collections = state.collections || [];
      return `<div class="section-heading"><div><button class="btn btn-plain btn-small" data-action="detail-back">← Voltar</button><div class="eyebrow" style="margin-top:1rem">${esc(term.area)}</div><h1 class="page-title">${esc(term.name)}</h1></div><span class="chip">${term.created_by_me ? ('Criado por você' + (term.private ? ' · privado' : '')) : 'Termo de Biologia'}</span></div>
        <div class="grid grid-2"><article class="card"><h2>Definição biológica</h2><p>${esc(term.definition)}</p>${sourceLink(term.source_url,'Fonte da definição')}</article><article class="card"><h2>Elementos etimológicos validados</h2><div class="radical-list">${(term.radical_list || []).map(r => `<div class="radical-row"><div><strong>${esc(r.observed_form || r.text)}</strong><span class="muted small"> · ${esc(morphLabel(r.type))}</span></div><span>${esc(r.meaning)}${sourceLink(r.reference_url,'Fonte')}</span></div>`).join('') || '<p>Sem relações etimológicas validadas.</p>'}</div></article></div>
        <div class="card-actions">${button(term.favorite ? 'Favorito' : 'Favoritar', 'toggle-favorite', term.favorite ? 'btn-soft' : 'btn-primary', `data-favorite="${term.favorite}" data-type="term" data-id="${term.id}"`)}
          ${collections.length ? `<form data-form="add-to-collection" class="card-actions"><input type="hidden" name="term_id" value="${term.id}"><select name="collection_id" required class="field" style="margin:0"><option value="">Adicionar a uma coleção…</option>${collections.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn btn-soft" type="submit">Adicionar</button></form>` : button('Criar coleção', 'new-collection', 'btn-soft')}
        </div><div class="split-heading"><h2>Termos parecidos</h2><span class="muted small">Compartilham pelo menos um elemento validado</span></div>${similar.length ? `<div class="grid grid-3">${similar.map(t=>`<article class="card term-card" tabindex="0" aria-label="Abrir termo" data-action="open-term" data-id="${t.id}"><span class="chip">${esc(t.area)}</span><h3>${esc(t.name)}</h3><p>${esc(t.definition)}</p></article>`).join('')}</div>` : empty('Sem termos relacionados', 'Este termo ainda não compartilha radicais com outros termos visíveis.')}`;
    }
    const { radical, terms } = state.detail;
    return `<div class="section-heading"><div><button class="btn btn-plain btn-small" data-action="detail-back">← Voltar</button><div class="eyebrow" style="margin-top:1rem">${esc(morphLabel(radical.classification))} · ${esc(radical.area)}</div><h1 class="page-title">${esc(radical.name)}</h1><p>${esc(radical.meaning)}</p>${radical.origin?`<p class="small muted">Origem: ${esc(radical.origin)}</p>`:''}${radical.variants?.length?`<p class="small muted">Variantes: ${radical.variants.map(esc).join(', ')}</p>`:''}${sourceLink(radical.source_url,'Fonte etimológica')}</div>${button(radical.favorite ? 'Favorito' : 'Favoritar', 'toggle-favorite', radical.favorite ? 'btn-soft' : 'btn-primary', `data-favorite="${radical.favorite}" data-type="radical" data-id="${radical.id}"`)}</div>
      <div class="split-heading"><h2>Termos que usam este radical</h2><span class="chip">${terms.length}</span></div>${terms.length ? `<div class="grid grid-3">${terms.map(t=>`<article class="card term-card" tabindex="0" aria-label="Abrir termo" data-action="open-term" data-id="${t.id}"><span class="chip">${esc(t.area)}</span><h3>${esc(t.name)}</h3><p>${esc(t.definition)}</p></article>`).join('')}</div>` : empty('Nenhum termo visível', 'Ainda não há termos ligados a este radical nas suas áreas e turmas.')}`;
  }
    return {renderNewCollection,renderCreateTrail,renderTermSelection,renderSelectedTerms,renderTermChoices,renderAddTerms,renderTeacherTerm,renderStudentTerm,renderStudentDetail,renderAssessmentConfig,renderAssessment,renderAssessmentResult,renderRank,rankTable,renderAssessmentResults,renderClassTrails,renderSources,renderGameConfig,renderGameQuestion,renderResult,renderSmallForm,learningPanel,renderRadicalDetail};
  };
})();
