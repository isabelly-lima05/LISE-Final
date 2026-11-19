(() => {
  'use strict';

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const API_BASE = String(window.LISE_CONFIG?.API_BASE_URL || '').replace(/\/$/, '');
  const state = {
    token: localStorage.getItem('lise_access_token') || '', user: null, view: 'auth', authMode: 'login',
    dashboard: null, classDetail: null, classId: null, classTab: '', classDate: '',
    explore: null, exploreKind: 'terms', exploreMine: false, exploreSearch: '', exploreArea: '', sort: 'asc',
    detail: null, detailType: '', detailBack: 'explore', collections: [], collection: null,
    sources: null, practiceSource: null, practiceGame: '', trailCatalog: null, trailAreas: [],
    gameSession: null, gameFeedback: null, gameIndex: 0, decipherSlots: [], decipherSelectedLetter: null, memorySelected: [], memoryPairs: [],
    memoryMatched: new Set(), memoryAttempts: 0, memoryStartedAt: 0, memoryLocked: false, memoryTimer: null, result: null, busy: false,
    studentDetail: null, assessmentTarget: null, assessmentReturnTab: 'trails', assessmentSession: null, assessmentIndex: 0,
    assessmentAnswer: null, assessmentResult: null,
    profilePasswordEdit: false, selectedTermIds: new Set(), selectedTermInfo: new Map(), catalogTerms: [], catalogSearchTimer: null,
    catalogSearchSequence: 0, termSelectionTarget: null, existingTermIds: new Set(),
    sidebarCollapsed: localStorage.getItem('lise_sidebar_collapsed') !== 'false',
    account: null, legal: null, legalVersion: '', accountTab:'perfil', collectionsLoaded:false,
    exploreMode:'browse', exploreShown:15, explorePage:1, explorePageSize:15, studyRevealed:new Set(),
    discovery:null, discoveryError:'', studentSort:'name', studentSortDir:'asc', showRanking:false
  };

  const AVATARS = window.LISE_AVATARS;
  const EMPTY_AVATAR = {
    label: 'Escolha seu mascote', species: 'Avatar não selecionado', color: '#e8eede',
    image: '/assets/avatars/avatar-placeholder.svg'
  };
  const avatarMarkup = (id) => {
    const selected = AVATARS.find(item => item.id === id);
    const avatar = selected || EMPTY_AVATAR;
    return `<span class="avatar-art ${selected?'':'avatar-placeholder'}" style="--avatar-bg:${esc(avatar.color)}"><span class="avatar-fallback" aria-hidden="true">${selected?esc(avatar.label.slice(0,1)):'?'}</span>${avatar.image ? `<img src="${esc(avatar.image)}" alt="${esc(avatar.label)} — ${esc(avatar.species || 'Avatar')}" class="avatar-image" loading="lazy" decoding="async" width="88" height="88">` : ''}</span>`;
  };
  const iconMarkup = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const GAMES = [
    { id: 'bioquiz', title: 'BioQuiz', icon: 'circle-help', description: 'Responda perguntas sobre termos, definições e elementos etimológicos validados.', modes: [['misto','Misto'],['termo_definicao','Termo → definição'],['definicao_termo','Definição → termo'],['radical_significado','Elemento → significado'],['significado_radical','Significado → elemento']] },
    { id: 'familia_palavras', title: 'Família de palavras', icon: 'network', description: 'Leia o significado de um radical e marque todos os termos que o utilizam.' },
    { id: 'memoria', title: 'Memória', icon: 'layers', description: 'Encontre pares de termos e definições ou de radicais e significados.' },
    { id: 'decifrador', title: 'Decifrador', icon: 'scan-search', description: 'Use a definição biológica como pista e descubra o termo com as letras embaralhadas.' }
  ];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtDate = (value, includeTime = true) => {
    if (!value) return 'Ainda não acessou';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ainda não acessou';
    return new Intl.DateTimeFormat('pt-BR', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(date);
  };
  const fmtBrazilDate = (value) => {
    if (!value) return 'Horário indisponível';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Horário indisponível';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo', hourCycle: 'h23'
    }).format(date);
  };
  const dateTimeInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
  };
  const gameTitle = (id) => id === 'avaliacao_trilha' ? 'Avaliação da trilha' : (GAMES.find(g => g.id === id)?.title || id);
  const morphLabel = (value) => ({PREFIXO:'Prefixo', SUFIXO:'Sufixo', RADICAL:'Radical', RAIZ:'Raiz', ELEMENTO_COMPOSICAO:'Elemento de composição'})[value] || value || 'Elemento etimológico';
  const safeSource=url=>{try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';}catch(_error){return '';}};
  const sourceLink = (url, label = 'Consultar fonte') => safeSource(url) ? `<a class="source-link" href="${esc(safeSource(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
  const button = (label, action, cls = 'btn-primary', extra = '') => `<button class="btn ${cls}" type="button" data-action="${action}" ${extra}>${label}</button>`;
  const empty = (title, detail) => `<div class="empty"><strong>${esc(title)}</strong>${esc(detail)}</div>`;

  // Share only concurrent reads, never persist personalized API responses.
  const pendingReads = new Map();
  let mutationGeneration=0;
  function api(path, options = {}) {
    const method = options.method || 'GET';
    if (method !== 'GET') {
      mutationGeneration++;pendingReads.clear();
      return requestApi(path, options);
    }
    const key = `${state.token}:${path}`;
    if (pendingReads.has(key)) return pendingReads.get(key).then(structuredClone);
    const pending = requestApi(path, options).finally(() => {
      if (pendingReads.get(key) === pending) pendingReads.delete(key);
    });
    pendingReads.set(key, pending);
    return pending.then(structuredClone);
  }

  async function requestApi(path, options = {}) {
    if (!API_BASE) throw new Error('Configure o endereço da API em frontend_spa/config.js.');
    const requestToken=state.token;
    const headers = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if(options.idempotencyKey)headers['Idempotency-Key']=options.idempotencyKey;
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const closePending=(options.method||'GET')!=='GET'?window.LiseInteractions?.notify('Processando sua ação…','info',{duration:60000}):null;
    try {
    let response;
    try {
      response = await fetch(`${API_BASE}/api/v1${path}`, {
        method: options.method || 'GET', headers, credentials: 'omit',
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    } catch (_error) {
      throw new Error('Não consegui acessar o backend. Confira o endereço da API e a configuração de CORS.');
    }
    const data = await response.json().catch(() => ({}));
    if(!path.startsWith('/legal/')&&!path.startsWith('/auth/')&&requestToken!==state.token)throw new Error('Sua sessão mudou. Abra a página novamente.');
    if (!response.ok) {
      if (response.status === 401 && state.token) {
        localStorage.removeItem('lise_access_token');forgetSession();renderAuth();
      }
      if (data.code === 'terms_required' && state.user) await loadAccount('privacidade');
      const error=new Error(response.status===404 && path.startsWith('/games/') ? 'A API publicada não oferece esta rota de jogo. Publique também o backend atualizado do LISE.' : data.error || 'Não foi possível concluir essa ação.'); error.status=response.status; error.code=data.code; throw error;
    }
    if((options.method||'GET')!=='GET'&&data.message)window.LiseInteractions?.notify(data.message,'success');
    return data;
    } finally {if(typeof closePending==='function')closePending();}
  }

  const celebrated = new Set();
  function celebrate(key) {
    if (celebrated.has(key) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    celebrated.add(key);
    const layer=document.createElement('div'); layer.className='confetti'; layer.setAttribute('aria-hidden','true');
    for(let i=0;i<36;i++) { const p=document.createElement('i'); p.style.cssText=`left:${Math.random()*100}%;--drift:${Math.random()*140-70}px;background:${['#8daa91','#c5a467','#4a5d4e','#e6c8aa'][i%4]};animation-delay:${Math.random()*.25}s`; layer.append(p); }
    document.body.append(layer); setTimeout(()=>layer.remove(),3300);
  }
  function toast(message,tone='success') {
    if(window.LiseInteractions)return window.LiseInteractions.notify(message,tone);
    toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove('show'),4000);
  }

  function loadingCard(message = 'Carregando…') {
    state.loading = true;
    return `<section class="card loading-card" role="status" aria-live="polite"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line short"></span><small>${esc(message)}</small></section>`;
  }

  function setLoading(message = 'Carregando…') {
    state.loading = true; state.loadError = '';
    app.innerHTML = shell(loadingCard(message));navigation.mount();
  }

  function renderLoadError() {
    return `<section class="card load-error" role="alert"><div class="eyebrow">Não foi possível carregar</div><h2>Confira sua conexão e tente novamente.</h2><p>${esc(state.loadError || 'O serviço não respondeu desta vez.')}</p><button class="btn btn-primary" type="button" data-action="retry-current">Recarregar página</button></section>`;
  }

  function shell(content) { return navigation.shell(content); }

  function renderOverlapping() {
    const canOverlap=typeof document.startViewTransition==='function'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!canOverlap){render();return null;}
    return document.startViewTransition(()=>render());
  }

  function renderAuth() {
    window.LiseSpeech?.stop();
    state.view='auth';
    const previous=app.querySelector('.access-panel');const wasRegister=previous?.classList.contains('access-register');
    app.innerHTML=screens.auth();window.LiseInteractions?.mount(app,'auth');
    if(previous&&wasRegister!==(state.authMode==='register'))app.querySelector('.access-panel')?.classList.add('access-changing');
    if(state.authMode==='register') {
      const submit=app.querySelector('[type=submit]'); submit.disabled=!state.legalVersion;
      ensureLegalVersion().then(()=>{if(submit.isConnected)submit.disabled=false;}).catch(error=>toast(error.message,'error'));
    }
  }

  function legalLinks() {
    return `<nav class="legal-links" aria-label="Documentos da LISE"><a href="/#privacidade" data-action="open-legal" data-document="privacidade" ${state.legal?.document==='privacidade'||legalRoute()==='privacidade'?'aria-current="page"':''}>Privacidade</a><a href="/#termos-de-uso" data-action="open-legal" data-document="termos-de-uso" ${legalRoute()==='termos-de-uso'?'aria-current="page"':''}>Termos de Uso</a><a href="/#cookies" data-action="open-legal" data-document="cookies" ${legalRoute()==='cookies'?'aria-current="page"':''}>Cookies</a></nav>`;
  }

  async function ensureLegalVersion() {
    if (!state.legalVersion) state.legalVersion = (await api('/legal/termos-de-uso')).version;
    return state.legalVersion;
  }

  async function loadLegal(document, updateHistory = true) {
    const content = await api(`/legal/${encodeURIComponent(document)}`);
    state.legal = content; state.legalVersion = content.version; state.view = 'legal';
    state.loading = false; state.loadError = '';
    if (updateHistory) history.pushState({legal:document}, '', `/#${document}`);
    app.innerHTML = shell(renderLegal());navigation.mount();window.LiseInteractions?.mount(app,'legal');
  }

  function renderLegal() {
    const d = state.legal;
    return `<article class="card legal-page"><a href="/" data-action="legal-back">← ${state.user ? 'Voltar à minha conta' : 'Voltar ao acesso'}</a><div class="eyebrow">Transparência na LISE</div><h1 class="page-title">${esc(d.title)}</h1><p>Versão ${esc(d.version)}</p>${legalLinks()}${!d.ready ? '<p class="legal-note" role="status">Estes documentos estão em revisão pela equipe. O contato e os procedimentos de atendimento serão completados na versão definitiva.</p>' : ''}<div class="legal-copy">${d.html}</div></article>`;
  }

  async function loadAccount(tab=state.accountTab || 'perfil',overlap=false) {
    state.accountTab=['perfil','seguranca','privacidade'].includes(tab)?tab:'perfil';
    state.account=await api('/account'); state.legalVersion=state.account.legal_version;
    state.view='account'; state.loading=false; state.loadError=''; overlap?renderOverlapping():render();
  }

  function renderAccount() { return screens.account(); }

  function renderProfile() { return screens.account(); }

  function renderDashboard() { return screens.dashboard(); }

  function renderExplore() { return screens.explore(); }

  function renderDetail() { return screens.detail(); }

  function renderCollections() { return screens.collections(); }

  function renderClasses() { return screens.classes(); }

  function learningPanel(learning) { return activities.learningPanel(learning); }

  function renderCollection() { return screens.collection(); }

  function renderNewCollection() { return activities.renderNewCollection(); }

  function renderCreateTrail() { return activities.renderCreateTrail(); }

  function renderTermSelection() { return activities.renderTermSelection(); }

  function renderSelectedTerms() { return activities.renderSelectedTerms(); }

  function renderTermChoices() { return activities.renderTermChoices(); }

  function renderAddTerms() { return activities.renderAddTerms(); }

  function renderTeacherTerm() { return activities.renderTeacherTerm(); }

  function renderStudentTerm() { return activities.renderStudentTerm(); }

  function renderClass() { return screens.classDetail(); }

  function renderStudents(students) { return screens.students(students); }

  function renderStudentDetail() { return activities.renderStudentDetail(); }

  function renderAssessmentConfig() { return activities.renderAssessmentConfig(); }

  function renderAssessment() { return activities.renderAssessment(); }

  function renderAssessmentResult() { return activities.renderAssessmentResult(); }

  function renderRank(d) { return activities.renderRank(d); }

  function rankTable(rows) { return activities.rankTable(rows); }

  function renderAssessmentResults(rows) { return activities.renderAssessmentResults(rows); }

  function renderClassTrails(d, teacher) { return activities.renderClassTrails(d, teacher); }

  function renderTrail() { return screens.trail(); }

  function renderGames() { return screens.games(); }

  function renderSources() { return activities.renderSources(); }

  function renderChooseGame() { return screens.games(true); }

  function renderGameConfig() { return activities.renderGameConfig(); }

  function renderGameQuestion() { return activities.renderGameQuestion(); }

  function renderResult() { return activities.renderResult(); }

  function renderSmallForm(view) { return activities.renderSmallForm(view); }

  const routeSnapshots = new Map();
  let restoringRoute = false, routeCounter = 0;
  function rememberRoute() {
    if (!state.user || restoringRoute || state.loading) return;
    const parts = [state.view === 'account' ? 'conta' : state.view];
    if(state.view==='account')parts.push(state.accountTab);
    if (state.view === 'class') parts.push(state.classId);
    if (['collection','trail'].includes(state.view)) parts.push(state.collection?.id || '');
    if (state.view === 'trail' && state.collection?.assignment_id) parts.push(state.collection.assignment_id);
    if (state.view === 'detail') parts.push(state.detailType, state.detail?.[state.detailType]?.id || '');
    if (state.view === 'game') parts.push(state.gameSession?.session_id || '');
    let key=parts.join('/');
    if(state.view==='explore'){
      const params=new URLSearchParams();
      if(state.exploreMode==='study')params.set('mode','study');
      if(state.exploreSearch)params.set('search',state.exploreSearch);
      if(state.exploreArea)params.set('area',state.exploreArea);
      if(state.exploreMine)params.set('mine','1');
      if(state.exploreKind==='favorites')params.set('favorite','1');
      if(state.sort==='desc')params.set('sort','desc');
      if(state.explorePage>1)params.set('page',String(state.explorePage));
      if(state.explorePageSize!==15)params.set('per_page',String(state.explorePageSize));
      if(params.size)key+='?'+params;
    }
    if(state.view==='class'&&state.classTab)key+='?tab='+state.classTab;
    const previous = history.state;
    const snapshot = Object.fromEntries(Object.entries(state).filter(([k]) => !['token','user','busy','memoryTimer','catalogSearchTimer','explore','sidebarCollapsed'].includes(k)));
    const id = previous?.key === key ? previous.id : ++routeCounter;
    routeSnapshots.set(id, structuredClone(snapshot));
    // Older entries fall back to a fresh dashboard instead of growing indefinitely.
    while (routeSnapshots.size > 20) routeSnapshots.delete(routeSnapshots.keys().next().value);
    const url = `${location.pathname}#${key}`;
    if (previous?.key === key || !previous?.lise) history.replaceState({lise:true,id,key},'',url);
    else history.pushState({lise:true,id,key},'',url);
    lastRouteHash=location.hash;
  }
  function forgetSession() {
    window.LiseInteractions?.cancelPending();window.LiseInteractions?.clearDirty();
    clearTimeout(state.memoryTimer);clearTimeout(state.catalogSearchTimer);clearTimeout(exploreInputTimer);
    state.token='';state.user=null;state.view='auth';state.authMode='login';
    for(const key of ['dashboard','classDetail','studentDetail','collection','detail','account','explore','discovery','gameSession','gameFeedback','assessmentSession','assessmentResult','sources','practiceSource','result'])state[key]=null;
    state.collections=[];state.collectionsLoaded=false;state.studyRevealed.clear();state.selectedTermIds.clear();state.selectedTermInfo.clear();
    state.catalogTerms=[];state.exploreSearch='';state.exploreArea='';state.exploreMine=false;state.explorePage=1;state.explorePageSize=15;
    state.loading=false;state.loadError='';routeSnapshots.clear();pendingReads.clear();celebrated.clear();
  }
  window.addEventListener('storage', event=>{if(event.key==='lise_access_token' && !event.newValue){forgetSession();renderAuth();}});
  window.addEventListener('pageshow', ()=>{if(!localStorage.getItem('lise_access_token') && state.user){forgetSession();renderAuth();}});
  async function mayRestoreRoute(){
    if(state.view!=='trail-create'||!window.LiseInteractions)return true;
    if(await window.LiseInteractions.mayLeave(document.querySelector('[data-form=trail-create] input'))){window.LiseInteractions.clearDirty();return true;}
    history.replaceState(history.state,'',location.pathname+lastRouteHash);return false;
  }
  window.addEventListener('popstate', async event => {
    if(window.LiseExamGuard?.active()){await window.LiseExamGuard.leave();return;}
    if(!await mayRestoreRoute())return;
    if(legalRoute()){await loadLegal(legalRoute(),false);lastRouteHash=location.hash;return;}
    if(!state.token||!state.user){renderAuth();return;}
    restoringRoute=true;
    try {const saved=routeSnapshots.get(event.state?.id);if(saved&&!['class','trails','trail','assessment','assessment-result','dashboard'].includes(saved.view)){Object.assign(state,structuredClone(saved));state.loading=false;state.loadError='';render();}else await restoreLocation();}
    catch(error){toast(error.message,'error');}finally{restoringRoute=false;lastRouteHash=location.hash;}
  });
  window.addEventListener('hashchange',async()=>{
    if(location.hash===lastRouteHash)return;
    if(!await mayRestoreRoute())return;
    try{if(legalRoute())await loadLegal(legalRoute(),false);else if(state.user)await restoreLocation();else if(state.token)await init();else renderAuth();lastRouteHash=location.hash;}catch(error){toast(error.message,'error');}
  });
  function render() {
    window.LiseSpeech?.stop();
    const draft=app.querySelector('[data-form=trail-create]');if(draft&&state.view==='trail-create'){state.trailDraft={values:[...new FormData(draft).entries()],step:Number(draft.dataset.currentStep)||0};}
    const focusBefore=captureFocus();
    if (state.view === 'legal' && state.legal) { app.innerHTML = shell(renderLegal());navigation.mount();window.LiseInteractions?.mount(app,'legal');return; }
    if (!state.user) { state.view='auth'; renderAuth(); return; }
    if (state.view !== 'game') { clearTimeout(state.memoryTimer); state.memoryLocked = false; }
    if (state.loadError) { app.innerHTML = shell(renderLoadError());navigation.mount();return; }
    state.loading = false;
    let content = '';
    switch (state.view) {
      case 'auth': renderAuth(); return;
      case 'dashboard': content = renderDashboard(); break;
      case 'classes': content = renderClasses(); break;
      case 'new-class': case 'join-class': content = renderSmallForm(state.view); break;
      case 'explore': content = renderExplore(); break;
      case 'detail': content = renderDetail(); break;
      case 'collections': content = renderCollections(); break;
      case 'collection': content = renderCollection(); break;
      case 'collection-create': content = renderNewCollection(); break;
      case 'trail-create': content = renderCreateTrail(); break;
      case 'teacher-term': content = renderTeacherTerm(); break;
      case 'student-term': content = renderStudentTerm(); break;
      case 'class': content = renderClass(); break;
      case 'student-detail': content = renderStudentDetail(); break;
      case 'trail': content = renderTrail(); break;
      case 'assessment-config': content = renderAssessmentConfig(); break;
      case 'assessment': content = renderAssessment(); break;
      case 'assessment-result': content = renderAssessmentResult(); break;
      case 'profile': state.view='account';state.accountTab='perfil';content=renderAccount();break;
      case 'trails': content=screens.trails();break;
      case 'account': content = renderAccount(); break;
      case 'collection-add-terms': content = renderAddTerms(); break;
      case 'trail-add-terms': content = renderAddTerms(); break;
      case 'games': content = renderGames(); break;
      case 'sources': content = renderSources(); break;
      case 'choose-game': content = renderChooseGame(); break;
      case 'game-config': content = renderGameConfig(); break;
      case 'game': content = renderGameQuestion(); break;
      case 'result': content = renderResult(); break;
      default: content = '<div class="empty">Tela não encontrada.</div>';
    }
    app.innerHTML = shell(content);
    afterRender(focusBefore);
    if(state.view==='game-config' && state.configMode) { const mode=app.querySelector('[name=mode]'); if(mode) mode.value=state.configMode; }
    rememberRoute();
  }

  let dashboardLoadSequence = 0;
  async function loadDashboard() {
    const sequence=++dashboardLoadSequence;
    state.view='dashboard'; state.dashboard=null;state.discovery=null;state.discoveryError='';setLoading();
    state.dashboard=await api('/dashboard');
    if(sequence!==dashboardLoadSequence||state.view!=='dashboard')return;
    state.loading=false;render();
    if(state.user.role==='Aluno') {
      void Promise.allSettled([api('/collections'),api('/explore?kind=terms')]).then(results=>{
        if(sequence!==dashboardLoadSequence||state.view!=='dashboard')return;
        state.collections=results[0].status==='fulfilled'?results[0].value.collections:state.dashboard.collections||[];
        state.collectionsLoaded=results[0].status==='fulfilled';
        if(results[1].status==='fulfilled') {
          state.explore=results[1].value;state.discovery=window.LiseComponents.dayTerm(state.explore.terms);
        } else state.discoveryError=results[1].reason.message;
        render();
      });
    }
  }
  async function loadCollections() {
    const d = await api('/collections'); state.collections = d.collections;state.collectionsLoaded=true;state.view = 'collections'; render();
  }
  async function loadCollection(id) {
    const d = await api(`/collections/${id}`); state.collection = d.collection; state.view = 'collection'; render();
  }
  let exploreSequence = 0;
  async function loadExplore(kind=state.exploreKind) {
    const sequence=++exploreSequence; state.exploreKind=kind; state.view='explore';
    state.loading=false; state.loadError='';
    render();
    const data=await api('/explore?kind=terms');
    if(sequence!==exploreSequence || state.view!=='explore')return;
    state.explore=data;render();
  }
  async function loadClass(id, date = '') {
    state.classId = Number(id); state.classDate = date; state.view = 'class'; state.classDetail = null; render();
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    state.classDetail = await api(`/classes/${id}${suffix}`);
    state.classTab = state.classDetail.role === 'Professor' ? 'overview' : 'trails';
    render();
  }
  async function loadStudentDetail(userId) {
    state.view='student-detail'; state.studentDetail=null; render();
    state.studentDetail=await api(`/classes/${state.classId}/students/${encodeURIComponent(userId)}`);
    render();
  }
  function configureAssessment(buttonEl) {
    const trail=(state.classDetail?.trails || []).find(item=>Number(item.assignment_id)===Number(buttonEl.dataset.assignment));
    state.assessmentReturnTab=state.classTab||'trails';
    state.assessmentTarget={class_id:Number(buttonEl.dataset.class), assignment_id:Number(buttonEl.dataset.assignment),
      trail_name:buttonEl.dataset.name || trail?.name || 'Trilha', assessment:trail?.assessment || null};
    state.view='assessment-config'; render();
  }
  async function startAssessment(classId, assignmentId) {
    state.classId=Number(classId); state.assessmentAnswer=null; state.assessmentResult=null;
    const d=await api(`/classes/${classId}/trails/${assignmentId}/assessment/sessions`,{method:'POST',body:{}});
    state.assessmentSession=d; state.assessmentIndex=0; state.view='assessment';render();window.LiseExamGuard?.start({id:d.session_id,classId:Number(classId),closesAt:d.closes_at});
  }
  async function loadSources() {
    state.sources = await api('/sources');
  }
  async function startPractice(game, source, config = {}) {
    state.decipherSlots=[]; state.decipherSelectedLetter=null; state.memoryMismatch=false; state.memoryCompleting=false; state.memoryCompletionError='';
    state.practiceGame = game; state.practiceSource = source; state.classId = source.class_id || null; state.view = 'game'; state.gameSession = null; state.gameFeedback = null; render();
    const payload = {game, source_type:source.type, source_id:source.id, area:source.area, class_id:source.class_id, question_count:Number(config.question_count || 10), mode:config.mode || 'termo_definicao'};
    let d;
    try { d = await api('/games/sessions', {method:'POST', body:payload}); }
    catch (error) { state.view='game-config'; render(); throw error; }
    clearTimeout(state.memoryTimer); state.gameSession = d; state.gameIndex = 0; state.gameFeedback = null; state.memoryPairs = []; state.memoryMatched = new Set(); state.memorySelected = []; state.memoryAttempts=0; state.memoryStartedAt=Date.now();state.memoryElapsed=null; state.memoryLocked=false; render();
  }

  async function chooseGameForSource(game) {
    state.practiceGame = game; state.configMode='';
    state.view = 'game-config'; state.availability=null; state.availabilityError='';
    render();
    try { const d=await api('/games/availability',{method:'POST',body:{source_type:state.practiceSource.type,source_id:state.practiceSource.id,area:state.practiceSource.area,class_id:state.practiceSource.class_id}}); state.availability=d.games; } catch(error){state.availabilityError=error.message;}
    render();
  }

  async function openTerm(id, from = state.view) {
    state.detailBack = from;
    state.detail = await api(`/explore/terms/${id}`);
    if(state.user.role==='Aluno'&&!state.collectionsLoaded){const data=await api('/collections');state.collections=data.collections;state.collectionsLoaded=true;}
    state.detailType = 'term'; state.view = 'detail'; render();
  }
  async function openRadical(id, from = state.view) {
    state.detailBack = from;
    state.detail = await api(`/explore/radicals/${id}`);
    state.detailType = 'radical'; state.view = 'detail'; render();
  }
  async function loadTrail(id, assignmentId) {
    const d = await api(`/trails/${id}${assignmentId?`?assignment_id=${assignmentId}`:''}`);
    state.collection = d.trail; state.classId = d.trail.class_id; state.view = 'trail'; render();
  }

  async function createCollectionScreen() {
    const [meta, collections] = await Promise.all([api('/meta'), api('/collections')]);
    clearTimeout(state.catalogSearchTimer); state.catalogSearchSequence++;
    state.trailAreas = meta.areas; state.collections = collections.collections; state.catalogTerms = [];
    state.selectedTermIds = new Set(); state.selectedTermInfo = new Map(); state.existingTermIds = new Set(); state.view = 'collection-create'; render();
  }
  async function createTrailScreen() {
    state.editingTrail=null;state.trailDraft=null;
    const [meta, dash] = await Promise.all([api('/meta'), api('/dashboard')]);
    clearTimeout(state.catalogSearchTimer); state.catalogSearchSequence++;
    state.trailAreas = meta.areas; state.dashboard = dash; state.catalogTerms = [];
    state.selectedTermIds = new Set(); state.selectedTermInfo = new Map(); state.existingTermIds = new Set(); state.view = 'trail-create'; render();
  }
  async function addCollectionTermsScreen(id, name) {
    const [detail, meta] = await Promise.all([api(`/collections/${id}`), api('/meta')]);
    clearTimeout(state.catalogSearchTimer); state.catalogSearchSequence++;
    state.trailAreas = meta.areas; state.catalogTerms = [];
    state.selectedTermIds = new Set(); state.selectedTermInfo = new Map(); state.existingTermIds = new Set(detail.collection.terms.map(term => term.id));
    state.termSelectionTarget = {type:'collection', id:Number(id), name:name || detail.collection.name};
    state.view = 'collection-add-terms'; render();
  }
  async function addTrailTermsScreen(id, name) {
    if (!state.dashboard) state.dashboard = await api('/dashboard');
    const trail = (state.dashboard.trails || []).find(item => Number(item.id) === Number(id));
    if (!trail) throw new Error('Trilha não encontrada no painel.');
    const meta = await api('/meta');
    clearTimeout(state.catalogSearchTimer); state.catalogSearchSequence++;
    state.trailAreas = meta.areas; state.catalogTerms = [];
    state.selectedTermIds = new Set(); state.selectedTermInfo = new Map(); state.existingTermIds = new Set(trail.terms || []);
    state.termSelectionTarget = {type:'trail', id:Number(id), name:name || trail.name};
    state.view = 'trail-add-terms'; render();
  }
  async function createTermScreen(student) {
    if (student) {
      const [catalog, meta, collections] = await Promise.all([api('/catalog/radicals'), api('/meta'), api('/collections')]);
      state.trailCatalog = catalog; state.trailAreas = meta.areas; state.collections = collections.collections; state.view = 'student-term';
    } else {
      state.dashboard = await api('/dashboard'); state.view = 'teacher-term';
    }
    render();
  }

  async function navigate(view) {
    if (view === 'dashboard') return loadDashboard();
    if (view === 'classes') { state.showArchived=false;state.view='classes'; if(!state.dashboard){setLoading('Carregando turmas…');state.dashboard=await api('/dashboard');} return render(); }
    if (view === 'explore') return loadExplore('terms');
    if (view === 'trails') { state.showArchived=false;state.view='trails';if(!state.dashboard){setLoading('Consultando trilhas…');state.dashboard=await api('/dashboard');}return render(); }
    if (view === 'favorites') return loadExplore('favorites');
    if (view === 'collections') return loadCollections();
    if (view === 'games') { state.practiceGame=''; state.practiceSource=null; state.view='games'; return render(); }
  }

  async function submitGameAnswer(form) {
    const question = state.gameSession.questions[state.gameIndex];
    const data = new FormData(form);
    let body = {question_id:question.id};
    if (state.gameSession.game === 'familia_palavras') body.answer = data.getAll('answer');
    else if (state.gameSession.game === 'decifrador') body.answer = state.decipherSlots.map(index => question.letters[index]).join('');
    else body.answer = data.get('answer');
    const answer = await api(`/games/sessions/${state.gameSession.session_id}/answer`, {method:'POST', body});
    state.gameFeedback = answer; render();
    if(answer.correct) celebrate(`${state.gameSession.session_id}:${question.id}`);
  }

  async function nextQuestion() {
    if (state.gameIndex + 1 < state.gameSession.questions.length) {
      clearTimeout(state.memoryTimer); state.gameIndex++; state.gameFeedback=null; state.decipherSlots=[]; state.decipherSelectedLetter=null; state.memoryPairs=[]; state.memoryMatched=new Set(); state.memorySelected=[]; state.memoryAttempts=0; state.memoryStartedAt=Date.now();state.memoryElapsed=null; state.memoryLocked=false; render(); return;
    }
    const result = await api(`/games/sessions/${state.gameSession.session_id}/finish`, {method:'POST', body:{}});
    state.result = result; state.view='result'; render();
  }

  async function handleClick(event) {
    const buttonEl = event.target.closest('[data-action]');
    if (!buttonEl) return;
    if (buttonEl.tagName === 'A') event.preventDefault();
    if(state.view==='trail-create'&&['navigate','go-dashboard','open-account','open-profile','logout','open-legal'].includes(buttonEl.dataset.action)){if(window.LiseInteractions&&!await window.LiseInteractions.mayLeave(buttonEl))return;window.LiseInteractions?.clearDirty();}
    if(!['open-menu','close-menu'].includes(buttonEl.dataset.action))navigation.close();
    const action = buttonEl.dataset.action;
    if(state.view==='assessment'&&!['assessment-next','open-menu','close-menu','toggle-sidebar','back-to-top','skip-content','retry-exam-close'].includes(action)){await window.LiseExamGuard?.leave();return;}
    if(action==='back-to-top'){window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});document.getElementById('main-content')?.focus({preventScroll:true});return;}
    if(buttonEl.dataset.pending==='1' || buttonEl.disabled) return;
    buttonEl.dataset.pending='1'; buttonEl.setAttribute('aria-busy','true');
    try {
      if(action==='retry-exam-close'){await window.LiseExamGuard?.leave();return;}
      if(action==='skip-content')app.querySelector('main')?.focus();
      else if(action==='skip-auth')document.getElementById('auth-title')?.focus();
      else if (action === 'open-menu') navigation.open(buttonEl);
      else if(action==='close-menu')navigation.close();
      else if(action==='copy-code') {
        try { await navigator.clipboard.writeText(buttonEl.dataset.code);buttonEl.classList.add('copied');buttonEl.innerHTML=esc(buttonEl.dataset.code)+' '+iconMarkup('check');window.LiseInteractions?.icons();toast('Código copiado.');setTimeout(()=>{if(buttonEl.isConnected){buttonEl.classList.remove('copied');buttonEl.innerHTML=esc(buttonEl.dataset.code)+' '+iconMarkup('copy');window.LiseInteractions?.icons();}},1200); }
        catch(_error) {const text=document.createElement('textarea');text.value=buttonEl.dataset.code;document.body.append(text);text.select();const ok=document.execCommand('copy');text.remove();toast(ok?'Código copiado.':`Código da turma: ${buttonEl.dataset.code}`);}
      }
      else if(action==='open-assign')openDialog(document.getElementById('assign-trail-dialog'),buttonEl);
      else if(action==='close-dialog')closeDialog(buttonEl.closest('dialog'));
      else if(action==='account-tab')await loadAccount(buttonEl.dataset.tab,true);
      else if(action==='sort-students'){state.studentSortDir=state.studentSort===buttonEl.dataset.sort&&state.studentSortDir==='asc'?'desc':'asc';state.studentSort=buttonEl.dataset.sort;render();}
      else if(action==='explore-mode'){
        const mode=buttonEl.dataset.mode;
        if(mode===state.exploreMode)return;
        state.exploreMode=mode;state.exploreShown=15;state.explorePage=1;
        const segmented=buttonEl.closest('.segmented');
        segmented?.querySelectorAll('[data-action="explore-mode"]').forEach(el=>{const selected=el.dataset.mode===mode;el.classList.toggle('is-selected',selected);el.setAttribute('aria-pressed',String(selected));});
        const results=document.querySelector('#explore-results'),intro=document.querySelector('.study-intro');
        if(mode==='study'&&!intro&&results){const note=document.createElement('p');note.className='study-intro';note.textContent='Observe a palavra. Tente lembrar seu significado antes de revelar a ficha.';results.before(note);}
        else if(mode!=='study')intro?.remove();
        refreshExplore();
      }
      else if(action==='explore-more'){state.exploreShown+=15;refreshExplore();document.querySelectorAll('.specimen-card')[state.exploreShown-15]?.querySelector('button')?.focus();}
      else if(action==='explore-page'){state.explorePage=Math.max(1,Number(buttonEl.dataset.page)||1);refreshExplore();document.querySelector('#explore-results')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});document.querySelector('.specimen-card button')?.focus({preventScroll:true});}
      else if(action==='reveal-study'){state.studyRevealed.add(Number(buttonEl.dataset.id));refreshExplore();document.querySelector(`[data-term="${buttonEl.dataset.id}"] [data-action="open-term"]`)?.focus();}
      else if(action==='explore-clear'){state.exploreSearch='';state.exploreMine=false;state.exploreArea='';state.exploreKind='terms';state.sort='asc';state.exploreShown=15;state.explorePage=1;render();document.querySelector('#explore-search')?.focus();}
      else if(action==='retry-discovery')await loadDashboard();
      else if (action === 'open-legal') await loadLegal(buttonEl.dataset.document);
      else if (action === 'legal-back') {
        history.replaceState({}, '', '/');
        if (state.user) await loadAccount(); else { state.view='auth'; renderAuth(); }
      }
      else if (action === 'open-account') await loadAccount();
      else if (action === 'export-data') {
        const end=window.LiseInteractions?.busy(buttonEl,'Preparando PDF…')||(()=>{});
        const token=state.token,user={...state.user};
        try {
          const [exported,privacy,sessions]=await Promise.allSettled([api('/account/data',{method:'POST',body:{}}),api('/account'),api('/account/sessions')]);
          if(token!==state.token)throw new Error('Sua sessão mudou. Entre novamente para exportar seus dados.');
          if(exported.status!=='fulfilled')throw exported.reason;
          if(!window.LiseDataReport)throw new Error('O gerador de PDF não carregou. Atualize a página e tente novamente.');
          await window.LiseDataReport.download(exported.value,{user,account:privacy.status==='fulfilled'?privacy.value:null,sessions:sessions.status==='fulfilled'?sessions.value:null});
          toast('PDF dos seus dados preparado para download.');
        } finally {end();}
      }
      else if (action === 'revoke-sessions') {
        if (!await window.LiseInteractions.confirm('Encerrar todas as sessões','Você sairá da LISE em todos os dispositivos, incluindo este. Será necessário entrar novamente.',buttonEl,true))return;
        const result = await api('/account/sessions/revoke', {method:'POST', body:{}});
        localStorage.removeItem('lise_access_token');forgetSession();history.replaceState({},'', '/');renderAuth();toast(result.message);
      }
      else if (action === 'auth-mode') { state.authMode=buttonEl.dataset.mode; renderAuth();document.querySelector('#auth-title')?.focus({preventScroll:true}); }
      else if (action === 'navigate') await navigate(buttonEl.dataset.view);
      else if (action === 'go-dashboard') await loadDashboard();
      else if (action === 'retry-current') { location.reload(); }
      else if (action === 'toggle-sidebar') {
        state.sidebarCollapsed=!state.sidebarCollapsed;
        localStorage.setItem('lise_sidebar_collapsed',String(state.sidebarCollapsed));
        const layout=buttonEl.closest('.app-layout');
        layout?.classList.toggle('sidebar-collapsed',state.sidebarCollapsed);
        const sidebarAction=state.sidebarCollapsed?'Expandir':'Recolher';
        buttonEl.setAttribute('aria-expanded',String(!state.sidebarCollapsed));
        buttonEl.setAttribute('aria-label',`LISE — ${sidebarAction} menu lateral`);
        buttonEl.title=`${sidebarAction} menu`;
      }
      else if (action === 'logout') { await api('/auth/logout',{method:'POST',body:{}}).catch(()=>{});localStorage.removeItem('lise_access_token');forgetSession();history.replaceState({},'',location.pathname);renderAuth(); }
      else if (action === 'new-class') { window.LiseInteractions.createClass(buttonEl); }
      else if (action === 'join-class') { state.view='join-class'; render(); }
      else if (action === 'new-trail') await createTrailScreen();
      else if (action === 'new-teacher-term') await createTermScreen(false);
      else if (action === 'new-student-term') await createTermScreen(true);
      else if (action === 'new-collection') await createCollectionScreen();
      else if (action === 'open-profile') { state.profilePasswordEdit=false;await loadAccount('perfil'); }
      else if (action === 'edit-profile-password') { state.profilePasswordEdit=true; render(); }
      else if (action === 'cancel-password-edit') { state.profilePasswordEdit=false; render(); }
      else if (action === 'select-avatar') {
        const d=await api('/auth/profile',{method:'PATCH',body:{avatar:buttonEl.dataset.avatar}});
        state.user=d.user; render(); toast('Avatar atualizado.');
      }
      else if(action==='reorder-term'){const list=[...state.selectedTermIds],index=list.indexOf(Number(buttonEl.dataset.id)),next=Math.max(0,Math.min(list.length-1,index+Number(buttonEl.dataset.direction)));reorderTerms(list[index],list[next]);}
      else if (action === 'term-tab') {
        state.termTab=buttonEl.dataset.tab;
        document.querySelectorAll('[data-action="term-tab"]').forEach(el=>el.classList.toggle('active',el===buttonEl));
        document.querySelector('[data-role="inline-term"]').hidden=state.termTab!=='create';
        document.querySelector('[data-role="term-search"]').closest('.toolbar').hidden=state.termTab==='create';
        document.querySelector('[data-role="term-results"]').hidden=state.termTab==='create';
        if(state.termTab!=='create') searchCatalogTerms();
      }
      else if (action === 'inline-create') {
        const name=document.querySelector('[data-role="inline-name"]').value.trim();
        const definition=document.querySelector('[data-role="inline-definition"]').value.trim();
        if(!name || !definition) { toast('Preencha o nome e a definição.'); return; }
        const teacher=state.user.role==='Professor';
        const d=await api(teacher?'/terms':'/me/terms',{method:'POST',body:{name,definition,context:teacher?'trail':'collection'}});
        state.selectedTermIds.add(d.term.id); state.selectedTermInfo.set(d.term.id,d.term); updateSelectedCount();
        document.querySelector('[data-role="inline-name"]').value=''; document.querySelector('[data-role="inline-definition"]').value='';
        toast('Termo criado e selecionado.');
      }
      else if (action === 'add-collection-terms') await addCollectionTermsScreen(buttonEl.dataset.id,buttonEl.dataset.name);
      else if (action === 'add-trail-terms') await addTrailTermsScreen(buttonEl.dataset.id,buttonEl.dataset.name);
      else if (action === 'remove-selected-term') {
        const id=Number(buttonEl.dataset.id);
        state.selectedTermIds.delete(id); state.selectedTermInfo.delete(id);if(state.view==='trail-create')window.LiseInteractions?.markDirty();
        const checkbox=document.querySelector(`[data-role="term-checkbox"][value="${id}"]`);
        if (checkbox) checkbox.checked=false;
        updateSelectedCount();
      }
      else if (action === 'open-class') await loadClass(buttonEl.dataset.id);
      else if (action === 'open-student') await loadStudentDetail(buttonEl.dataset.id);
      else if (action === 'open-term') await openTerm(buttonEl.dataset.id);
      else if (action === 'open-radical') await openRadical(buttonEl.dataset.id);
      else if (action === 'detail-back') { state.view=state.detailBack; render(); }
      else if (action === 'toggle-sort') { state.sort=state.sort==='asc'?'desc':'asc'; render(); }
      else if (action === 'toggle-favorite') {
        const type=buttonEl.dataset.type, id=buttonEl.dataset.id;
        if (buttonEl.dataset.favorite === 'true') await api(`/favorites/${type}/${id}`,{method:'DELETE'});
        else await api('/favorites',{method:'POST',body:{type,id:Number(id)}});
        if (state.view==='detail') state.detail=state.detailType==='term'?await api(`/explore/terms/${id}`):await api(`/explore/radicals/${id}`);
        else if (state.view==='explore') state.explore=await api('/explore?kind=terms');
        else if (state.view==='trail' && state.collection) state.collection=(await api(`/trails/${state.collection.id}?assignment_id=${state.collection.assignment_id}`)).trail;
        render(); toast('Favoritos atualizados.');
      }
      else if (action === 'toggle-game-favorite') {
        const type=buttonEl.dataset.type, id=Number(buttonEl.dataset.id);
        const itemList=type==='term'?state.gameFeedback.feedback.favorite_terms:state.gameFeedback.feedback.favorite_radicals;
        const item=itemList.find(x=>x.id===id);
        if (!item) return;
        if (item.favorite) await api(`/favorites/${type}/${id}`,{method:'DELETE'});
        else await api('/favorites',{method:'POST',body:{type,id}});
        item.favorite=!item.favorite; render();
      }
      else if (action === 'delete-trail') {
        if (!await window.LiseInteractions.confirm('Excluir trilha','Excluir esta trilha definitivamente? Os termos do catálogo continuam disponíveis. A trilha sairá de todas as turmas. O histórico de avaliações será preservado.',buttonEl))return;
        const id=buttonEl.dataset.id;
        await api(`/trails/${id}`,{method:'DELETE'});
        state.dashboard=await api('/dashboard'+(state.showArchived?'?archived=1':''));render();toast('Trilha excluída de todas as turmas.');
      }
      else if (action === 'delete-collection') {
        if (!await window.LiseInteractions.confirm('Excluir coleção','Esta ação exclui o caderno pessoal. Os termos do catálogo serão preservados.',buttonEl))return;
        await api(`/collections/${buttonEl.dataset.id}`,{method:'DELETE'}); await loadCollections(); toast('Coleção apagada.');
      }
      else if (action === 'open-collection') await loadCollection(buttonEl.dataset.id);
      else if (action === 'remove-collection-term') {
        const collectionId=buttonEl.dataset.collection,termId=buttonEl.dataset.term;window.LiseInteractions.delayedRemoval(`collection:${collectionId}:${termId}`,buttonEl.closest('.specimen-card'),async()=>{await api(`/collections/${collectionId}/terms/${termId}`,{method:'DELETE'});if(state.view==='collection'&&String(state.collection?.id)===collectionId)await loadCollection(collectionId);});
      }
      else if (action === 'practice-collection') {
        state.practiceSource={type:'collection',id:Number(buttonEl.dataset.id),name:buttonEl.dataset.name}; state.practiceGame=''; state.view='choose-game'; render();
      }
      else if (action === 'practice-favorites') {
        state.practiceSource={type:'favorites',name:'Seus favoritos'}; state.practiceGame=''; state.view='choose-game'; render();
      }
      else if (action === 'class-tab') { state.classTab=buttonEl.dataset.tab; renderOverlapping(); }
      else if(action==='review-assessment'){state.assessmentResult=await api(`/assessment/sessions/${buttonEl.dataset.id}`);state.view='assessment-result';render();}
      else if (action === 'configure-assessment') configureAssessment(buttonEl);
      else if (action === 'start-assessment') await startAssessment(buttonEl.dataset.class,buttonEl.dataset.assignment);
      else if (action === 'unassign-trail') {
        const classId=buttonEl.dataset.class,trailId=buttonEl.dataset.id;
        window.LiseInteractions.delayedRemoval(`assignment:${classId}:${trailId}`,buttonEl.closest('article'),async()=>{
          await api(`/classes/${classId}/trails/${trailId}`,{method:'DELETE'});
          if(state.view==='class'&&String(state.classId)===classId){await loadClass(classId);state.classTab='trails';render();}
        });
      }
      else if (action === 'practice-trail') {
        state.practiceSource={type:'trail',id:Number(buttonEl.dataset.assignment),class_id:Number(buttonEl.dataset.class),name:buttonEl.dataset.name};
        state.practiceGame=''; state.view='choose-game'; render();
      }
      else if (action === 'open-trail') await loadTrail(buttonEl.dataset.id,buttonEl.dataset.assignment);
      else if (action === 'back-to-class') await loadClass(state.classId);
      else if (action === 'select-game') { state.practiceGame=buttonEl.dataset.game; await loadSources(); state.view='sources'; render(); }
      else if (action === 'choose-source') {
        state.practiceSource={type:buttonEl.dataset.type,id:buttonEl.dataset.id?Number(buttonEl.dataset.id):undefined,area:buttonEl.dataset.type==='area'?buttonEl.dataset.name:undefined,name:buttonEl.dataset.name,class_id:buttonEl.dataset.class?Number(buttonEl.dataset.class):undefined};
        if (state.practiceGame) await chooseGameForSource(state.practiceGame); else {state.view='choose-game'; render();}
      }
      else if (action === 'configure-game') await chooseGameForSource(buttonEl.dataset.game);
      else if (action === 'games-back') { state.view='games'; render(); }
      else if (action === 'practice-back') { state.view=state.practiceSource?.type==='trail'?'class':state.practiceSource?.type==='collection'?'collection':'games'; render(); }
      else if (action === 'choose-game-back') { state.view='choose-game'; render(); }
      else if (action === 'nav-games') { clearTimeout(state.memoryTimer); state.memoryLocked=false; state.view='games'; state.gameSession=null; render(); }
      else if (action === 'next-question') await nextQuestion();
      else if (action === 'decipher-letter') {
        const letterIndex=Number(buttonEl.dataset.letterIndex);
        state.decipherSelectedLetter=state.decipherSelectedLetter===letterIndex?null:letterIndex;
        render();
      }
      else if (action === 'decipher-slot') {
        const slotIndex=Number(buttonEl.dataset.slotIndex);
        if (state.decipherSelectedLetter !== null) {
          placeDecipherLetter(state.decipherSelectedLetter,slotIndex);
          state.decipherSelectedLetter=null;
        } else if (state.decipherSlots[slotIndex] !== null) {
          state.decipherSlots[slotIndex]=null;
        }
        render();
      }
      else if (action === 'assessment-next') {
        if (state.assessmentIndex + 1 < state.assessmentSession.total) {
          state.assessmentIndex++; state.assessmentAnswer=null; render();
        } else {
          state.assessmentResult=await api(`/assessment/sessions/${state.assessmentSession.session_id}/finish`,{method:'POST',body:{}});
          window.LiseExamGuard?.clear();state.view='assessment-result'; render();
        }
      }
      else if (action === 'again-game') { state.view='game-config'; state.result=null; render(); }
      else if (action === 'memory-read') {
        const question=state.gameSession?.questions[state.gameIndex];
        const card=question?.cards?.find(item=>item.id===buttonEl.dataset.card);
        if(card&&(state.memorySelected.includes(card.id)||state.memoryMatched.has(card.id))){
          const dialog=window.LiseInteractions.dialog('Leia e conecte',`<span class="eyebrow">Carta da memória</span><p class="memory-reader-copy">${esc(card.text)}</p><p class="memory-reader-hint">Feche para continuar sua partida.</p>`,buttonEl);
          dialog.classList.add('memory-reading-dialog');
        }
      }
      else if (action === 'memory-card') await memoryCard(buttonEl.dataset.card);
      else if (action === 'memory-complete') await completeMemory();
      else if (action === 'add-to-collection') { /* submitted by the form handler */ }
    } catch (error) { if (state.loading) { state.loadError=error.message; render(); } toast(error.message,'error'); } finally { delete buttonEl.dataset.pending; buttonEl.removeAttribute('aria-busy'); }
  }

  function placeDecipherLetter(letterIndex, slotIndex) {
    if (!Number.isInteger(letterIndex) || !Number.isInteger(slotIndex) ||
        letterIndex<0 || letterIndex>=state.decipherSlots.length ||
        slotIndex<0 || slotIndex>=state.decipherSlots.length) return;
    const sourceSlot=state.decipherSlots.indexOf(letterIndex);
    if (sourceSlot===slotIndex) return;
    const displaced=state.decipherSlots[slotIndex];
    state.decipherSlots[slotIndex]=letterIndex;
    if (sourceSlot>=0) state.decipherSlots[sourceSlot]=displaced;
  }

  function handleDecipherDragStart(event) {
    const letter=event.target.closest('[data-letter-index]');
    if (!letter) return;
    event.dataTransfer.effectAllowed='move';
    event.dataTransfer.setData('text/plain',letter.dataset.letterIndex);
    letter.classList.add('dragging');
  }

  function handleDecipherDragOver(event) {
    if (!event.target.closest('[data-decipher-drop]')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
  }

  function handleDecipherDrop(event) {
    const target=event.target.closest('[data-decipher-drop]');
    if (!target) return;
    event.preventDefault();
    const letterIndex=Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isInteger(letterIndex) || letterIndex<0 || letterIndex>=state.decipherSlots.length) return;
    if (target.dataset.decipherDrop==='bank') {
      const sourceSlot=state.decipherSlots.indexOf(letterIndex);
      if (sourceSlot>=0) state.decipherSlots[sourceSlot]=null;
    } else placeDecipherLetter(letterIndex,Number(target.dataset.slotIndex));
    state.decipherSelectedLetter=null;
    render();
  }

  function handleDecipherDragEnd(event) {
    event.target.closest('[data-letter-index]')?.classList.remove('dragging');
  }

  async function completeMemory() {
    if (state.memoryCompleting || !state.gameSession) return;
    const sessionId=state.gameSession.session_id, questionIndex=state.gameIndex;
    const q=state.gameSession.questions[questionIndex];
    if (state.memoryMatched.size !== q.cards.length) return;
    state.memoryCompleting=true; state.memoryCompletionError=''; render();
    try {
      const answer=await api(`/games/sessions/${sessionId}/answer`,{method:'POST',body:{question_id:q.id,answer:state.memoryPairs}});
      if (state.gameSession?.session_id===sessionId && state.gameIndex===questionIndex) {
        state.memoryElapsed=Math.max(0,Math.floor((Date.now()-state.memoryStartedAt)/1000));
        state.gameFeedback=answer;
      }
    } catch (error) {
      if (state.gameSession?.session_id===sessionId) state.memoryCompletionError=error.message;
    } finally {
      if (state.gameSession?.session_id===sessionId) { state.memoryCompleting=false; render(); }
    }
  }

  async function memoryCard(cardId) {
    if (!state.gameSession || state.memoryLocked || state.memoryMatched.has(cardId) || state.memorySelected.includes(cardId)) return;
    state.memoryMismatch=false;state.memorySelected.push(cardId); render();
    if (state.memorySelected.length < 2) return;
    state.memoryLocked=true;
    const q=state.gameSession.questions[state.gameIndex], pair=[...state.memorySelected], sessionId=state.gameSession.session_id, questionIndex=state.gameIndex;
    render();
    try {
      const check=await api(`/games/sessions/${sessionId}/match`,{method:'POST',body:{question_id:q.id,pair,attempt_id:crypto.randomUUID()}});
      if (state.gameSession?.session_id!==sessionId || state.gameIndex!==questionIndex) return;
      state.memoryAttempts=check.attempts ?? state.memoryAttempts+1;
      if (check.match) {
        if(!check.duplicate) toast('Par encontrado.');
        state.memoryPairs.push(pair); pair.forEach(id=>state.memoryMatched.add(id)); state.memorySelected=[]; state.memoryLocked=false; render();
        if (state.memoryMatched.size === q.cards.length) {
          await completeMemory();
        }
      } else {
        state.memoryMismatch=true;render();
        state.memoryTimer=setTimeout(()=>{
          if (state.gameSession?.session_id!==sessionId || state.gameIndex!==questionIndex) return;
          state.memorySelected=[]; state.memoryLocked=false; render();
        },700);
      }
    } catch (error) {
      if (state.gameSession?.session_id===sessionId && state.gameIndex===questionIndex) {
        state.memorySelected=[]; state.memoryLocked=false; render();
      }
      throw error;
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const kind=form.dataset.form, data=new FormData(form);
    if(kind==='assessment-answer'&&window.LiseExamGuard?.closing()){toast('A tentativa já foi bloqueada. Registre o encerramento.','error');return;}
    form.dataset.operationKey ||= crypto.randomUUID();
    if(kind==='explore-filter'){updateExploreFromForm(form);return;}
    if(form.dataset.pending==='1') return;
    form.dataset.pending='1';const submitButton=form.querySelector('[type=submit]');const finishBusy=window.LiseInteractions?.busy(submitButton,kind==='login'?'Entrando…':kind==='assessment-config'?'Agendando…':'Salvando…');let success=false;
    try {
      if (kind === 'login') {
        const d=await api('/auth/login',{method:'POST',body:{email:data.get('email'),password:data.get('password'),remember:data.has('remember')}});
        routeSnapshots.clear(); history.replaceState({},'',location.pathname);
        state.token=d.access_token; state.user=d.user;state.explore=null;state.collections=[];state.collectionsLoaded=false;state.studyRevealed.clear();localStorage.setItem('lise_access_token',state.token); if(await window.LiseExamGuard?.recover())return;await loadDashboard(); toast(`Olá, ${state.user.name.split(' ')[0]}!`);
      } else if (kind === 'register') {
        const version = await ensureLegalVersion();
        const d=await api('/auth/register',{method:'POST',body:{name:data.get('name'),email:data.get('email'),password:data.get('password'),role:data.get('role'),accept_terms:data.has('accept_terms'),legal_version:version}}); toast(d.message); state.authMode='login'; renderAuth();
      } else if (kind === 'account-name') {
        const result=await api('/account/name',{method:'PATCH',body:{name:data.get('name')}});
        state.user.name=result.name; routeSnapshots.clear(); await loadAccount('perfil'); toast(result.message);
      } else if (kind === 'account-terms') {
        const result=await api('/account/terms',{method:'POST',body:{accept_terms:data.has('accept_terms'),legal_version:state.account.legal_version}});
        await loadAccount(); toast(result.message);
      } else if (kind === 'privacy-request') {
        const result=await api('/account/requests',{method:'POST',body:{type:data.get('type'),details:data.get('details'),confirm_delete:data.get('confirm_delete')}});
        await loadAccount(); toast(`${result.message} Protocolo: ${result.request.id}`);
      } else if (kind === 'recovery') {
        const d=await api('/auth/recovery',{method:'POST',body:{email:data.get('email')}}); toast(d.message); state.authMode='login'; renderAuth();
      } else if (kind === 'change-password') {
        if (data.get('password')!==data.get('confirm')) return toast('As senhas não são iguais.');
        const d=await api('/auth/change-password',{method:'POST',body:{current_password:data.get('current_password'),password:data.get('password')}});
        state.profilePasswordEdit=false; render(); toast(d.message);
      } else if (kind === 'new-class') {
        await api('/classes',{method:'POST',body:{name:data.get('name')},idempotencyKey:form.dataset.operationKey}); await loadDashboard(); toast('Turma criada.');
      } else if (kind === 'join-class') {
        await api('/classes/join',{method:'POST',body:{code:data.get('code')}}); await loadDashboard(); toast('Você entrou na turma.');
      } else if (kind === 'explore-filter') {
        state.exploreMine=data.has('mine'); state.exploreKind=data.get('kind'); state.exploreSearch=data.get('search'); state.exploreArea=data.get('area'); await loadExplore(state.exploreKind);
      } else if (kind === 'collection-create') {
        const body={name:data.get('name'),term_ids:[...state.selectedTermIds]};
        const d=await api('/collections',{method:'POST',body,idempotencyKey:form.dataset.operationKey}); state.collections=[...(state.collections||[]),d.collection]; await loadCollections(); toast('Coleção criada.');
      } else if (kind === 'collection-add-terms') {
        const id=Number(form.dataset.targetId);
        await api(`/collections/${id}/terms`,{method:'POST',body:{term_ids:[...state.selectedTermIds]}});
        await loadCollection(id); toast('Termos adicionados à coleção.');
      } else if (kind === 'trail-add-terms') {
        const id=Number(form.dataset.targetId);
        await api(`/trails/${id}/terms`,{method:'POST',body:{term_ids:[...state.selectedTermIds]}});
        state.dashboard=await api('/dashboard'); state.view='dashboard'; render(); toast('Termos adicionados à trilha.');
      } else if (kind === 'add-to-collection') {
        await api(`/collections/${data.get('collection_id')}/terms`,{method:'POST',body:{term_id:Number(data.get('term_id'))}}); toast('Termo adicionado à coleção.');
      } else if (kind === 'trail-create') {
        const body={name:data.get('name'),description:data.get('description'),area:data.get('area'),term_ids:[...state.selectedTermIds],class_ids:data.getAll('class_ids').map(Number),due_date:data.get('due_date') || null};
        const editing=!!state.editingTrail;if(state.editingTrail)await api('/trails/'+state.editingTrail.id,{method:'PATCH',body:{...body,revision:state.editingTrail.revision}});else await api('/trails',{method:'POST',body,idempotencyKey:form.dataset.operationKey});state.editingTrail=null;window.LiseInteractions?.clearDirty();await loadDashboard(); toast(editing?'Trilha atualizada.':'Trilha criada.');
      } else if (kind === 'assign-trail') {
        await api(`/classes/${state.classId}/trails`,{method:'POST',body:{trail_id:Number(data.get('trail_id')),due_date:data.get('due_date') || null}}); await loadClass(state.classId); state.classTab='trails'; render(); toast('Trilha atribuída à turma.');
      } else if (kind === 'assessment-config') {
        const target=state.assessmentTarget;
        await api(`/classes/${target.class_id}/trails/${target.assignment_id}/assessment`,{method:'POST',body:{title:data.get('title'),question_count:Number(data.get('question_count')),pass_score:Number(data.get('pass_score')),content:data.get('content'),mode:data.get('mode'),opens_at:data.get('opens_at'),closes_at:data.get('closes_at'),revision:target.assessment?.revision}});
        await loadClass(target.class_id); state.classTab=state.assessmentReturnTab||'trails'; render(); toast('BioQuiz agendado.');
      } else if (kind === 'teacher-term') {
        await api('/terms',{method:'POST',idempotencyKey:form.dataset.operationKey,body:{context:'trail',name:data.get('name'),definition:data.get('definition'),class_ids:data.getAll('class_ids').map(Number),trail_ids:data.getAll('trail_ids').map(Number)}}); await loadDashboard(); toast('Termo personalizado salvo.');
      } else if (kind === 'student-term') {
        const collection=data.get('collection_id');
        await api('/me/terms',{method:'POST',idempotencyKey:form.dataset.operationKey,body:{context:'collection',name:data.get('name'),definition:data.get('definition'),collection_id:collection?Number(collection):null}}); await loadDashboard(); toast('Termo pessoal criado.')
      } else if (kind === 'game-config') {
        await startPractice(state.practiceGame,state.practiceSource,{question_count:data.get('question_count'),mode:data.get('mode')});
      } else if (kind === 'game-answer') await submitGameAnswer(form);
      else if (kind === 'assessment-answer') {
        const question=state.assessmentSession.questions[state.assessmentIndex];
        const choice=data.get('answer');
        if (!choice) return toast('Selecione uma alternativa.');
        state.assessmentAnswer=await api(`/assessment/sessions/${state.assessmentSession.session_id}/answer`,{method:'POST',body:{question_id:question.id,answer:choice}}); render(); if(state.assessmentAnswer.correct) celebrate(question.id);
      }
    success=true;
    } catch (error) { if (state.loading) { state.loadError=error.message; render(); } toast(error.message,'error'); } finally { delete form.dataset.pending;finishBusy?.(success); }
  }

  function handleChange(event) {
    if(event.target.closest('[data-form="explore-filter"]')){updateExploreFromForm(event.target.form);return;}
    if(event.target.name==='explore-page-size'){state.explorePageSize=[15,20,25].includes(Number(event.target.value))?Number(event.target.value):15;state.explorePage=1;refreshExplore();return;}
    if(event.target.name==='student-sort'){state.studentSort=event.target.value;state.studentSortDir=event.target.value==='name'?'asc':'desc';render();return;}
    if(event.target.name==='show-ranking'){state.showRanking=event.target.checked;render();return;}
    if(event.target.name==='type'&&event.target.closest('[data-form="privacy-request"]')){
      const deletion=event.target.value==='exclusao';const panel=document.getElementById('delete-confirmation');if(!panel)return;panel.hidden=!deletion;
      document.getElementById('request-confirm').required=deletion;
      if(!deletion&&document.getElementById('request-confirm'))document.getElementById('request-confirm').value='';return;
    }
    const target=event.target;
    if(target.name==='mode' && state.view==='game-config') { state.configMode=target.value; render(); }
    if (target.matches('[data-role="term-area"]')) searchCatalogTerms();
    if(target.name==='area'&&target.closest('[data-form=trail-create]')){const filter=document.querySelector('[data-role="term-area"]');if(filter){filter.value=target.value;searchCatalogTerms();}}
    if (target.matches('[data-role="term-checkbox"]')) {
      const id=Number(target.value);
      if (target.checked) {
        state.selectedTermIds.add(id);
        const term=state.catalogTerms.find(item=>item.id===id);
        if (term) state.selectedTermInfo.set(id,term);
      } else {
        state.selectedTermIds.delete(id); state.selectedTermInfo.delete(id);
      }
      updateSelectedCount();
    }
    if (target.name==='class_ids') updateSelectedCount();
  }

  function handleInput(event) {
    if(event.target.id==='explore-search'){clearTimeout(exploreInputTimer);exploreInputTimer=setTimeout(()=>{if(event.target.isConnected)updateExploreFromForm(event.target.form);},180);return;}
    if (event.target.matches('[data-role="term-search"]')) searchCatalogTerms();
    if (event.target.matches('[data-role="radical-search"]')) {
      const q=event.target.value.toLocaleLowerCase();
      document.querySelectorAll('.radical-choice').forEach(row=>row.hidden=!row.dataset.search.includes(q));
    }
  }

  function searchCatalogTerms() {
    const form=document.querySelector('.term-selection-form');
    const search=document.querySelector('[data-role="term-search"]');
    const area=document.querySelector('[data-role="term-area"]');
    const results=document.querySelector('[data-role="term-results"]');
    if (!form || !search || !results) return;
    clearTimeout(state.catalogSearchTimer);
    const sequence=++state.catalogSearchSequence;
    const query=search.value.trim();
    results.innerHTML='<div class="catalog-loading" role="status"><span class="skeleton skeleton-line"></span><p class="small muted">Pesquisando termos…</p></div>';
    state.catalogSearchTimer=setTimeout(async()=>{
      try {
        const params=new URLSearchParams({search:query,area:area?.value || '',mine:state.termTab==='mine'?'1':'0'});
        const response=await api(`/catalog/terms?${params}`);
        if (sequence!==state.catalogSearchSequence || !document.querySelector('.term-selection-form')) return;
        state.catalogTerms=response.terms || [];
        results.innerHTML=renderTermChoices();
      } catch(error) {
        if (sequence===state.catalogSearchSequence) {
          results.innerHTML=`<p class="muted small">${esc(error.message)}</p>`;
        }
      }
    },query?180:0);
  }

  function updateSelectedCount() {
    const count=state.selectedTermIds.size;
    document.querySelectorAll('[data-role="selected-count"]').forEach(el=>el.textContent=String(count));
    const inputs=document.querySelector('[data-role="selected-term-inputs"]');
    if (inputs) inputs.innerHTML=[...state.selectedTermIds].map(id=>`<input type="hidden" name="term_ids" value="${id}">`).join('');
    const selected=document.querySelector('[data-role="selected-term-list"]');
    if (selected) selected.innerHTML=renderSelectedTerms();
    const save=document.querySelector('[data-form=trail-create] [type=submit]');if(save){save.disabled=count===0;save.title=count?'':'Selecione ao menos um termo';}
  }

  function legalRoute() {
    const route = location.hash.slice(1) || location.pathname.replace(/^\/+|\/+$/g,'');
    return ['privacidade','termos-de-uso','cookies'].includes(route) ? route : '';
  }

  function renderNotFound() {
    state.view='not-found'; state.loading=false;
    app.innerHTML=shell(`<section class="card not-found"><div class="error-code" aria-hidden="true">404</div><h1>Este caminho ainda não criou raízes.</h1><p>A página que você procurou não foi encontrada.</p><a class="btn btn-primary" href="/">Voltar ao início</a></section>`);
    navigation.mount();
  }

  async function init() {
    if (location.pathname !== '/' && location.pathname !== '/index.html' && !legalRoute()) { renderNotFound(); return; }
    if (!API_BASE) { renderAuth(); toast('Configure o endereço da API em config.js para conectar o LISE.'); return; }
    if (legalRoute()) { await loadLegal(legalRoute(), false); return; }
    const params=new URLSearchParams(location.search);
    if (params.get('confirmed')==='1') toast('E-mail confirmado. Agora você pode entrar.');
    if (params.get('mode')==='recovery') {
      const tokenHash=params.get('token_hash');
      if (tokenHash) {
        app.innerHTML=`<div class="auth-page"><section class="auth-aside"><div class="brand"><span class="brand-mark">L</span> LISE</div><div><h1 class="auth-title">Crie uma nova senha.</h1><p class="auth-copy">Escolha uma senha segura para voltar aos seus estudos.</p></div></section><section class="auth-main"><form class="auth-card card" data-form="password-reset"><h2>Nova senha</h2><div class="field"><label>Nova senha</label><input name="password" type="password" minlength="8" required></div><div class="field"><label>Repita a nova senha</label><input name="confirm" type="password" minlength="8" required></div><button class="btn btn-primary btn-block">Atualizar senha</button></form></section></div>`;
        state.recovery={tokenHash};
        history.replaceState({},'',`${location.pathname}?mode=recovery`);
        return;
      }
      toast('Abra o link de recuperação mais recente enviado para seu e-mail.');
    }
    if (!state.token) { renderAuth(); return; }
    try {
      const d=await api('/auth/me'); state.user=d.user;
      restoringRoute=true;
      try {await restoreLocation();}catch(error){toast(error.message,'error');if(state.view!=='account')await loadDashboard();}
      finally{restoringRoute=false;}
      history.replaceState(null,'',location.pathname+location.hash); rememberRoute();
    }
    catch (error) {if(!state.user){state.token='';localStorage.removeItem('lise_access_token');renderAuth();}else{state.loading=false;state.loadError=error.message;render();}}
  }


  let lastRouteHash=location.hash, lastRenderedView='', exploreInputTimer;
  function captureFocus() {
    const active=document.activeElement;
    if(!active || !app.contains(active))return null;
    return {id:active.id,tag:active.tagName,name:active.name,
      data:Object.fromEntries(Object.entries(active.dataset||{}).filter(([key])=>key!=='pending'))};
  }
  function afterRender(focusBefore) {
    navigation.mount();
    window.LiseInteractions?.mount(app,state.view);window.LiseCrud?.mount(app);window.LiseCompact?.mount(app,state);
    if(app.querySelector('.term-selection-form')&&!state.catalogTerms.length){const mainArea=app.querySelector('[data-form=trail-create] [name=area]'),filter=app.querySelector('[data-role="term-area"]');if(mainArea?.value&&filter)filter.value=mainArea.value;searchCatalogTerms();}
    if(state.view==='trail-create'&&state.trailDraft){const f=app.querySelector('[data-form=trail-create]');for(const [name,value] of state.trailDraft.values){const el=f?.elements.namedItem(name);if(el&&'value' in el&&el.type!=='checkbox')el.value=value;}f?.querySelector(`[data-step="${state.trailDraft.step}"]`)?.click();}
    let fieldIndex=0;
    for(const label of app.querySelectorAll('.field>label:not([for])')){
      const control=label.parentElement.querySelector('input,select,textarea');
      if(control){if(!control.id)control.id=`field-${state.view}-${++fieldIndex}`;label.htmlFor=control.id;}
    }
    for(const control of app.querySelectorAll('form button:not([type])'))control.type='submit';
    for(const control of app.querySelectorAll('[data-role="term-search"],[data-role="term-area"]'))control.setAttribute('aria-label',control.dataset.role==='term-search'?'Buscar termos para selecionar':'Filtrar termos por área');
    for(const dialog of app.querySelectorAll('dialog.app-dialog')){
      dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog(dialog);});
      dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
      dialog.addEventListener('close',()=>{if(dialog._trigger?.isConnected)dialog._trigger.focus({preventScroll:true});});
      dialog.addEventListener('keydown',event=>{
        if(event.key!=='Tab')return;
        const controls=[...dialog.querySelectorAll('button:not([disabled]),input,select,textarea,a[href]')].filter(el=>el.getClientRects().length);
        if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
        else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
      });
    }
    if(lastRenderedView!==state.view){if(lastRenderedView)app.querySelector('main')?.focus({preventScroll:true});lastRenderedView=state.view;window.scrollTo?.(0,0);}
    else if(focusBefore) {
      const target=focusBefore.id?document.getElementById(focusBefore.id):[...app.querySelectorAll('button,input,select,textarea')].find(el=>el.tagName===focusBefore.tag&&(focusBefore.name?el.name===focusBefore.name:Object.keys(focusBefore.data).length&&Object.entries(focusBefore.data).every(([key,val])=>el.dataset[key]===val)));
      if(target&&!target.disabled)target.focus({preventScroll:true});
      else if(state.view==='game'){
        const next=app.querySelector('.feedback')||app.querySelector('.decipher-slot')||app.querySelector('.memory-card:not([disabled])');
        if(next){if(!next.matches('button'))next.tabIndex=-1;next.focus({preventScroll:true});}
      }
    }
  }
  function closeDialog(dialog){
    if(!dialog?.open||dialog.dataset.closing)return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!dialog.animate){dialog.close();return;}
    dialog.dataset.closing='true';
    const exit=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(6px) scale(.98)'}],{duration:240,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    exit.finished.catch(()=>{}).then(()=>{delete dialog.dataset.closing;dialog.close();});
  }
  function openDialog(dialog,trigger){if(!dialog)return;delete dialog.dataset.closing;dialog._trigger=trigger;dialog.showModal();dialog.querySelector('button,input,select')?.focus();}
  function updateExploreFromForm(form){
    const data=new FormData(form);state.exploreSearch=data.get('search')||'';state.exploreArea=data.get('area')||'';
    state.exploreMine=data.has('mine');state.exploreKind=data.has('favorite')?'favorites':'terms';state.sort=data.get('sort')||'asc';state.exploreShown=15;state.explorePage=1;refreshExplore();
  }
  function refreshExplore(){
    const results=app.querySelector('#explore-results');if(!results)return;
    const previousCards=[...results.querySelectorAll('[data-term]')].map(el=>[el.dataset.term,el.getBoundingClientRect()]);results.innerHTML=screens.exploreResults();for(const el of results.querySelectorAll('[data-term]')){const before=previousCards.find(([id])=>id===el.dataset.term)?.[1],now=el.getBoundingClientRect();window.LiseInteractions?.motion(el,before?[{transform:`translate(${before.x-now.x}px,${before.y-now.y}px)`,opacity:.6},{transform:'none',opacity:1}]:[{opacity:0},{opacity:1}]);}window.lucide?.createIcons({attrs:{'stroke-width':1.7}});window.LiseCompact?.mount(app,state);
    const wasRestoring=restoringRoute;restoringRoute=false;
    // Filtros substituem a entrada atual, sem criar um histórico por tecla.
    const previous=history.state;if(previous?.lise)history.replaceState({...previous,key:null},'',location.href);
    if(previous?.lise)history.replaceState(null,'',location.href);
    rememberRoute();restoringRoute=wasRestoring;
  }
  async function restoreLocation(){
    if(state.view==='assessment'&&window.LiseExamGuard?.active()){await window.LiseExamGuard.leave();return;}
    if(await window.LiseExamGuard?.recover())return;
    const [path,query='']=location.hash.slice(1).split('?'),[route,id,extra]=path.split('/'),params=new URLSearchParams(query);
    if(route==='profile') {history.replaceState(null,'',location.pathname+'#conta/perfil');lastRouteHash=location.hash;return loadAccount('perfil');}
    if(route==='conta')return loadAccount(id||'perfil');
    if(route==='explore'){
      state.exploreMode=params.get('mode')==='study'?'study':'browse';state.exploreSearch=params.get('search')||'';state.exploreArea=params.get('area')||'';
      state.exploreMine=params.get('mine')==='1';state.exploreKind=params.get('favorite')==='1'?'favorites':'terms';state.sort=params.get('sort')==='desc'?'desc':'asc';state.exploreShown=15;state.explorePage=Math.max(1,Number(params.get('page'))||1);state.explorePageSize=[15,20,25].includes(Number(params.get('per_page')))?Number(params.get('per_page')):15;
      return loadExplore(state.exploreKind);
    }
    if(['classes','collections','games','trails'].includes(route))return navigate(route);
    if(route==='class'&&/^\d+$/.test(id)){await loadClass(id);const available=state.user.role==='Professor'?['overview','students','trails','results']:['trails','assessments','rank'];if(available.includes(params.get('tab'))){state.classTab=params.get('tab');render();}return;}
    if(route==='collection'&&/^\d+$/.test(id))return loadCollection(id);
    if(route==='trail'&&/^\d+$/.test(id))return loadTrail(id,/^\d+$/.test(extra)?extra:undefined);
    if(route==='detail'&&/^\d+$/.test(extra)){if(id==='term')return openTerm(extra,'explore');if(id==='radical')return openRadical(extra,'explore');}
    if (!route || route==='dashboard' || ['game','result','game-config','choose-game','sources'].includes(route)) return loadDashboard();
    return renderNotFound();
  }

  const screenContext={state,AVATARS,GAMES,avatarMarkup,fmtDate,fmtBrazilDate,dateTimeInputValue,sourceLink,gameTitle,loadingCard,legalLinks};
  const activities=window.LiseActivities(screenContext);
  const screens=window.LiseScreens({...screenContext,...activities,legacyRadicalDetail:()=>activities.renderRadicalDetail()});
  const navigation=window.LiseNavigation({state,avatarMarkup,legalLinks});
  function reorderTerms(from,to){const list=[...state.selectedTermIds],a=list.indexOf(from),b=list.indexOf(to);if(a<0||b<0||a===b)return;list.splice(a,1);list.splice(b,0,from);state.selectedTermIds=new Set(list);if(state.view==='trail-create')window.LiseInteractions?.markDirty();updateSelectedCount();}
  window.LiseInteractions?.configure({state:()=>state,api,render,loadDashboard,avatars:AVATARS,avatarMarkup,reorder:reorderTerms});
  window.LiseCrud?.configure({state:()=>state,api,render,fmtDate,dateTimeInputValue,
    forget:()=>{localStorage.removeItem('lise_access_token');forgetSession();history.replaceState({},'',location.pathname);renderAuth();},
    archiveView:async archived=>{state.dashboard=await api('/dashboard'+(archived?'?archived=1':''));render();},
    reload:async()=>{const view=state.view,tab=state.classTab;if(view==='class'){await loadClass(state.classId);state.classTab=tab;render();}else if(view==='account')await loadAccount();else if(view==='collections')await loadCollections();else if(view==='collection')await loadCollection(state.collection.id);else if(view==='explore')await loadExplore();else if(view==='trail')await loadTrail(state.collection.id,state.collection.assignment_id);else{state.dashboard=await api('/dashboard'+(state.showArchived?'?archived=1':''));state.view=view;render();}}
  });

  window.LiseLiveClass?.configure({api,state:()=>state,generation:()=>mutationGeneration,render});
  window.LiseExamGuard?.configure({api,getToken:()=>state.token,getUser:()=>state.user,base:API_BASE,onResult:result=>{if(result.class_id)state.classId=result.class_id;state.assessmentResult=result;state.view='assessment-result';render();}});
  app.addEventListener('click',event=>{const row=event.target.closest('[data-student-row]');if(row&&!event.target.closest('button,a,input,label,select'))loadStudentDetail(row.dataset.studentRow).catch(e=>toast(e.message,'error'));});
  app.addEventListener('keydown',event=>{const row=event.target.closest('[data-student-row]');if(row&&event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();loadStudentDetail(row.dataset.studentRow).catch(e=>toast(e.message,'error'));}});


  app.addEventListener('error', event => { if(event.target.matches?.('.avatar-image')) event.target.remove(); }, true);
  new MutationObserver(() => { window.lucide?.createIcons({attrs:{'stroke-width':1.7}}); }).observe(app,{childList:true});

  app.addEventListener('click', event=>handleClick(event));
  app.addEventListener('keydown', event=>{
    if(event.target.matches('[role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const tabs=[...event.target.closest('[role=tablist]').querySelectorAll('[role=tab]')],index=tabs.indexOf(event.target);
      const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
      const id=next.id;next.click();setTimeout(()=>document.getElementById(id)?.focus(),0);return;
    }
    if(event.target.matches('article[data-action][tabindex]') && ['Enter',' '].includes(event.key)) {
      event.preventDefault(); event.target.click();
    }
  });
  app.addEventListener('dragstart', handleDecipherDragStart);
  app.addEventListener('dragover', handleDecipherDragOver);
  app.addEventListener('drop', handleDecipherDrop);
  app.addEventListener('dragend', handleDecipherDragEnd);
  app.addEventListener('submit', event=>handleSubmit(event));
  app.addEventListener('change', handleChange);
  app.addEventListener('input', handleInput);
  app.addEventListener('submit', async event=>{
    if (event.target.dataset.form==='password-reset') {
      event.preventDefault(); const data=new FormData(event.target);
      if (data.get('password')!==data.get('confirm')) return toast('As senhas não são iguais.');
      try { const result=await api('/auth/password',{method:'POST',body:{password:data.get('password'),token_hash:state.recovery.tokenHash}}); history.replaceState({},'',location.pathname); toast(result.message); state.authMode='login'; renderAuth(); }
      catch(error){toast(error.message,'error');}
    }
  });
  init().catch(error=>{renderAuth();toast(error.message,'error');});
})();
