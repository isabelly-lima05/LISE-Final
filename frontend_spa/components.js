/* Componentes puros: dados autorizados da API entram; HTML escapado sai. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  const icon = name => `<i data-lucide="${esc(name)}" aria-hidden="true"></i>`;
  const morphLabel = value => ({PREFIXO:'Prefixo',RADICAL:'Radical',RAIZ:'Raiz',SUFIXO:'Sufixo',ELEMENTO_COMPOSICAO:'Elemento de composição'})[value] || 'Elemento etimológico';
  const tone = value => value === 'PREFIXO' ? 'prefix' : value === 'SUFIXO' ? 'suffix' : ['RADICAL','RAIZ','ELEMENTO_COMPOSICAO'].includes(value) ? 'root' : 'neutral';
  const button = (label, action, cls='btn-primary', extra='') => `<button class="btn ${cls}" type="button" data-action="${action}" ${extra}>${label}</button>`;
  const empty = (title, detail) => `<div class="empty"><span class="empty-mark">${icon('sprout')}</span><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
  const value = number => Number.isFinite(number) ? number.toLocaleString('pt-BR') : '—';
  const heading = (eyebrow, title, description='', actions='') => `<header class="section-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1 class="page-title">${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div>${actions?`<div class="card-actions">${actions}</div>`:''}</header>`;
  const breadcrumb = items => `<nav class="breadcrumb" aria-label="Caminho">${items.map((item,i)=>`${i?'<span aria-hidden="true">/</span>':''}${item.action?`<button type="button" data-action="${item.action}" ${item.attrs||''}>${esc(item.label)}</button>`:`<span aria-current="page">${esc(item.label)}</span>`}`).join('')}</nav>`;
  const codeChip = code => code ? `<button type="button" class="code-chip" data-action="copy-code" data-code="${esc(code)}" aria-label="Copiar código ${esc(code)}"><span>${esc(code)}</span>${icon('copy')}</button>` : '';

  function anatomy(term, {large=false, meanings=true}={}) {
    const parts = (term.radical_list || []).filter(r=>String(r.text||'').trim() && String(r.meaning||'').trim());
    if (!parts.length) return `<div class="word-anatomy"><span class="word-name ${large?'word-display':''}">${esc(term.name)}</span><p class="anatomy-missing">Composição etimológica ainda não disponível.</p></div>`;
    const clean = text => String(text).replace(/^-+|-+$/g,'');
    const surfaces = parts.map(r=>clean(r.observed_form || r.text));
    const exact = surfaces.join('').normalize('NFC').toLocaleLowerCase('pt-BR') === String(term.name).normalize('NFC').toLocaleLowerCase('pt-BR');
    // Não adivinha posições, hifens ou classificação pela ordem das partes.
    let offset=0;
    const word = exact ? parts.map((r,i)=>{
      const text=String(term.name).slice(offset,offset+surfaces[i].length); offset+=surfaces[i].length;
      return `<span class="word-segment" data-tone="${tone(r.type)}">${esc(text)}</span>`;
    }).join('') : esc(term.name);
    return `<div class="word-anatomy"><span class="word-name ${large?'word-display':''}" aria-label="${esc(term.name)}">${word}</span><div class="anatomy-parts" aria-label="Elementos etimológicos validados">${parts.map(r=>`<span class="anatomy-part" data-tone="${tone(r.type)}"><strong>${esc(r.observed_form || r.text)}</strong>${meanings?`<span>${esc(r.meaning)}</span>`:''}<small>${esc(morphLabel(r.type))}</small></span>`).join('')}</div></div>`;
  }

  function termCard(term, {study=false, revealed=false, extra='', numbered=false, status=''}={}) {
    const isHidden = study && !revealed;
    const favButton = `<button class="favorite-toggle${term.favorite?' is-favorite':''}" type="button" data-action="toggle-favorite" data-type="term" data-id="${esc(term.id)}" data-favorite="${!!term.favorite}" aria-label="${term.favorite?'Remover dos favoritos':'Favoritar'} ${esc(term.name)}" aria-pressed="${!!term.favorite}" title="${term.favorite?'Salvo nos favoritos':'Adicionar aos favoritos'}">${icon('heart')}<span>${term.favorite?'Favorito':'Favoritar'}</span></button>`;
    const titleMarkup = numbered && !isHidden
      ? `<h3 class="sr-only">${esc(term.name)}</h3>${anatomy(term,{meanings:false})}`
      : `<h3 class="word-name">${esc(term.name)}</h3>`;
    return `<article class="specimen-card ${numbered?'path-card':''} ${study&&revealed?'study-revealed':''}" data-term="${esc(term.id)}"><div class="specimen-meta"><div class="specimen-tags"><span class="specimen-area">${esc(term.area || 'Biologia')}</span>${term.created_by_me?'<span class="specimen-origin">Seu termo</span>':''}</div>${favButton}</div>
      <div class="specimen-title">${titleMarkup}</div>
      ${isHidden?'<p class="study-prompt">O que esta palavra significa na Biologia?</p>':`<p class="specimen-definition">${esc(term.definition)}</p>`}
      ${status?`<p class="practice-mark">${icon(status==='Praticado'?'circle-check':'circle')}${esc(status)}</p>`:''}
      <div class="card-actions">${isHidden?button('Revelar significado','reveal-study','btn-primary btn-small',`data-id="${term.id}"`):button('Investigar palavra '+icon('arrow-right'),'open-term','btn-soft btn-small',`data-id="${term.id}"`)}${!isHidden?(window.LiseSpeech?.button(term.name)||''):''}${extra}</div></article>`;
  }

  function statsStrip(items) {
    return `<dl class="stat-strip">${items.map(([label,number,mark])=>`<div>${mark?icon(mark):''}<dt>${esc(label)}</dt><dd>${value(number)}</dd></div>`).join('')}</dl>`;
  }

  function classCard(c, teacher) {
    const studentCount=Number.isFinite(c.student_count)?c.student_count:Array.isArray(c.alunos)?c.alunos.length:null;
    const trailCount=Array.isArray(c.trilhas)?c.trilhas.length:null;
    return `<article class="class-card"><div class="card-top"><span class="class-emblem" aria-hidden="true">${icon('users')}</span>${teacher?codeChip(c.code):'<span class="class-kicker">Aprender em conjunto</span>'}</div><span class="eyebrow">${c.archived_at?'Turma arquivada':teacher?'Sua turma':'Sua comunidade'}</span><h3><button class="stretched-link" type="button" data-action="open-class" data-id="${c.id}">${esc(c.name)}</button></h3><div class="class-counts"><span>${icon('users')}<strong>${value(studentCount)}</strong> ${studentCount===1?'aluno':'alunos'}</span><span>${icon('route')}<strong>${value(trailCount)}</strong> ${trailCount===1?'trilha':'trilhas'}</span></div><span class="class-open" aria-hidden="true">Acessar turma ${icon('arrow-up-right')}</span></article>`;
  }

  function gameArt(game) {
    const pieces = {
      bioquiz:'<path d="M40 27h84v70H40z"/><path d="m54 46 5 5 10-12m-15 28 5 5 10-12m12-15h28M81 67h28M54 84h55"/>',
      familia_palavras:'<path d="M82 48v18M44 85V66h76v19M82 66v19"/><rect x="55" y="22" width="54" height="27" rx="13"/><rect x="20" y="85" width="47" height="26" rx="13"/><rect x="95" y="85" width="47" height="26" rx="13"/><path d="M72 35h20M33 98h20m55 0h20"/>',
      memoria:'<rect x="30" y="24" width="54" height="77" rx="8" transform="rotate(-10 57 62)"/><rect x="79" y="32" width="54" height="77" rx="8" transform="rotate(10 106 70)"/><path d="M48 55q16-24 23 0-16 24-23 0m44 11 10 10 17-23"/>',
      decifrador:'<circle cx="72" cy="59" r="29"/><path d="m94 82 27 27M54 59h36m-23-12 10 24"/><path d="M26 102h53m-48 11h36"/>'
    };
    return `<svg class="game-illustration" viewBox="0 0 164 132" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="82" cy="66" r="59" class="illustration-wash" stroke="none"/>${pieces[game]||pieces.bioquiz}</svg>`;
  }

  function dayTerm(terms, date=new Date()) {
    const ordered=[...terms].sort((a,b)=>Number(a.id)-Number(b.id));
    const curated=ordered.filter(t=>(t.radical_list||[]).length);
    const candidates=curated.length?curated:ordered;
    if (!candidates.length) return null;
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    let hash=0; for(const char of day) hash=(hash*31+char.charCodeAt(0))>>>0;
    return candidates[hash%candidates.length];
  }

  function filteredTerms(state) {
    const words=fold(state.exploreSearch).split(/\s+/).filter(Boolean);
    return [...(state.explore?.terms||[])].filter(t=>{
      const parts=t.radical_list||[];
      const text=fold([t.name,t.definition,...parts.flatMap(r=>[r.text,r.observed_form,r.meaning])].join(' '));
      return words.every(word=>text.includes(word)) && (!state.exploreArea||t.area===state.exploreArea)
        && (!state.exploreMine||t.created_by_me) && (state.exploreKind!=='favorites'||t.favorite)
        && (!state.exploreType||parts.some(r=>r.type===state.exploreType));
    }).sort((a,b)=>(state.sort==='desc'?-1:1)*a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
  }
  window.LiseComponents={esc,fold,icon,morphLabel,tone,button,empty,value,heading,breadcrumb,codeChip,anatomy,termCard,statsStrip,classCard,gameArt,dayTerm,filteredTerms};
})();