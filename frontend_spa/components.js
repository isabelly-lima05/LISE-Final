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
  const codeChip = code => {
    if(!code)return '';
    const raw=String(code),visual=raw.length>12?`<span class="middle-truncate" aria-hidden="true"><span>${esc(raw.slice(0,6))}</span><span>…</span><span>${esc(raw.slice(-6))}</span></span><span class="sr-only">${esc(raw)}</span>`:`<span>${esc(raw)}</span>`;
    return `<button type="button" class="code-chip" data-action="copy-code" data-code="${esc(raw)}" aria-label="Copiar código ${esc(raw)}">${visual}${icon('copy')}</button>`;
  };

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
      const label=morphLabel(r.type),meaning=String(r.meaning||'').trim();
      return `<span class="word-segment" data-tone="${tone(r.type)}" data-part-label="${esc(label)}" data-meaning="${esc(meaning)}" tabindex="0" aria-label="${esc(text)}: ${esc(meaning)}. ${esc(label)}">${esc(text)}</span>`;
    }).join('') : esc(term.name);
    return `<div class="word-anatomy"><span class="word-name ${large?'word-display':''}" aria-label="${esc(term.name)}">${word}</span><div class="anatomy-parts" aria-label="Elementos etimológicos validados">${parts.map(r=>`<span class="anatomy-part" data-tone="${tone(r.type)}"><strong>${esc(r.observed_form || r.text)}</strong>${meanings?`<span>${esc(r.meaning)}</span>`:''}<small>${esc(morphLabel(r.type))}</small></span>`).join('')}</div></div>`;
  }

  function termCard(term, {study=false, revealed=false, extra='', numbered=false, status=''}={}) {
    const isHidden = study && !revealed;
    return `<article class="specimen-card ${numbered?'path-card':''} ${study?'study-card':''} ${study&&revealed?'study-revealed':''}" data-term="${esc(term.id)}"><div class="specimen-meta"><span>${esc(term.area || 'Biologia')}</span></div>
      <div class="specimen-title"><h3 class="${isHidden?'':'sr-only'}">${esc(term.name)}</h3>${isHidden?'':anatomy(term,{meanings:false})}</div>
      ${isHidden?'<p class="study-prompt">O que esta palavra conta sobre a Biologia?</p>':`<p class="specimen-definition">${esc(term.definition)}</p>`}
      ${status?`<p class="practice-mark">${icon(status==='Praticado'?'circle-check':'circle')}${esc(status)}</p>`:''}
      <div class="card-actions">${isHidden?button('Revelar significado','reveal-study','btn-primary btn-small',`data-id="${term.id}"`):button('Investigar palavra '+icon('arrow-right'),'open-term','btn-text btn-small',`data-id="${term.id}"`)}
      ${!isHidden?(window.LiseSpeech?.button(term.name)||''):''}${button(icon('heart'),'toggle-favorite',`icon-button favorite-toggle${term.favorite?' is-favorite':''}`,`data-type="term" data-id="${term.id}" data-favorite="${!!term.favorite}" aria-label="${term.favorite?'Remover dos favoritos':'Favoritar'} ${esc(term.name)}" aria-pressed="${!!term.favorite}"`)}${extra}</div>
      ${term.created_by_me?'<span class="ownership-note">Criado por você</span>':''}</article>`;
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
      bioquiz:'<rect x="48" y="27" width="68" height="78" rx="12"/><path d="M67 27v-7h30v7M64 50h36M64 67h23M64 84h31"/><path d="m100 78 6 6 12-15"/>',
      familia_palavras:'<path d="M82 104V38m0 22c-17 0-29-9-34-24 19-2 31 7 34 24Zm0 18c17 0 29-9 34-24-19-2-31 7-34 24Z"/><circle cx="82" cy="31" r="8"/><circle cx="48" cy="91" r="9"/><circle cx="116" cy="91" r="9"/><path d="M82 78 51 88m31-10 31 10"/>',
      memoria:'<rect x="35" y="30" width="57" height="72" rx="11" transform="rotate(-7 64 66)"/><rect x="75" y="30" width="57" height="72" rx="11" transform="rotate(7 104 66)"/><path d="M52 62c9-14 20-14 27 0-9 14-20 14-27 0Zm44 5 8 8 13-18"/>',
      decifrador:'<circle cx="72" cy="60" r="30"/><path d="m94 82 26 26"/><rect x="55" y="49" width="13" height="18" rx="3"/><rect x="74" y="49" width="13" height="18" rx="3"/><path d="M31 106h51M38 116h37"/>'
    };
    return `<svg class="game-illustration" viewBox="0 0 164 132" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="illustration-wash" stroke="none" d="M24 28C43 6 106 1 137 26c25 20 18 70-11 91-28 20-87 11-105-18C7 77 8 47 24 28Z"/><path class="game-sprig" d="M26 93c17-3 29-12 36-28M38 86c-8-1-13-5-16-11m26 2c1-8 5-13 12-17"/>${pieces[game]||pieces.bioquiz}</svg>`;
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
        && (!state.exploreMine||t.created_by_me) && (state.exploreKind!=='favorites'||t.favorite);
    }).sort((a,b)=>(state.sort==='desc'?-1:1)*a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
  }
  window.LiseComponents={esc,fold,icon,morphLabel,tone,button,empty,value,heading,breadcrumb,codeChip,anatomy,termCard,statsStrip,classCard,gameArt,dayTerm,filteredTerms};
})();
