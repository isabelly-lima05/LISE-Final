(() => {
  'use strict';
  window.LiseNavigation = ({state,avatarMarkup,legalLinks}) => {
    const {esc,icon}=window.LiseComponents;
    const items = () => state.user.role==='Aluno'
      ? [['dashboard','house','Início'],['explore','compass','Explorar'],['games','puzzle','Praticar'],['collections','library','Coleções'],['classes','users','Turmas']]
      : [['dashboard','layout-dashboard','Painel'],['classes','users','Turmas'],['trails','route','Trilhas'],['explore','compass','Explorar']];
    function active(view) {
      return view===state.view || view==='classes'&&['class','student-detail','assessment-config','assessment','assessment-result'].includes(state.view)
        || view==='explore'&&state.view==='detail' || view==='collections'&&state.view.startsWith('collection')
        || view==='games'&&['sources','choose-game','game-config','game','result'].includes(state.view)
        || view==='trails'&&state.user.role==='Professor'&&['trail','trail-create','trail-add-terms'].includes(state.view);
    }
    function links() {
      return `<nav class="nav-list" aria-label="Navegação principal">${items().map(([view,mark,label])=>`<button type="button" class="nav-button ${active(view)?'active':''}" data-action="navigate" data-view="${view}" aria-label="${label}" ${active(view)?'aria-current="page"':''}>${icon(mark)}<span class="side-label">${label}</span></button>`).join('')}</nav>`;
    }
    function account() {
      return `<div class="side-bottom"><button type="button" class="side-account ${state.view==='account'?'active':''}" data-action="open-profile" aria-label="Minha conta" title="Minha conta — ${esc(state.user.name)}"><span class="account-mini-avatar">${avatarMarkup(state.user.avatar)}</span></button><button type="button" class="nav-button logout-button" data-action="logout" aria-label="Sair da conta">${icon('log-out')}<span class="side-label">Sair da conta</span></button></div>`;
    }
    function shell(content) {
      if (!state.user) return content;
      return `<div class="app-layout ${state.sidebarCollapsed?'sidebar-collapsed':''}"><a class="skip-link" href="#main-content" data-action="skip-content">Pular para o conteúdo</a>
        <aside class="sidebar" aria-label="Menu lateral"><div class="sidebar-brand-row"><button class="brand brand-toggle" type="button" data-action="toggle-sidebar" aria-label="LISE — ${state.sidebarCollapsed?'Expandir':'Recolher'} menu lateral" title="${state.sidebarCollapsed?'Expandir':'Recolher'} menu" aria-expanded="${!state.sidebarCollapsed}">${icon('dna')}<span class="brand-word">LISE</span><span class="brand-chevron" aria-hidden="true">${icon('chevron-left')}</span></button></div>${links()}${account()}</aside>
        <button type="button" class="sidebar-launcher" data-action="open-menu" aria-label="Abrir menu lateral" aria-haspopup="dialog">${icon('dna')}</button>
        <dialog class="side-drawer" id="mobile-navigation" aria-labelledby="mobile-menu-title"><div class="drawer-heading"><span class="brand" id="mobile-menu-title">${icon('dna')} LISE</span><button type="button" class="icon-button" data-action="close-menu" aria-label="Fechar menu lateral">${icon('x')}</button></div>${links()}${account()}</dialog>
        <div class="main-column ${state.user.role==='Professor'?'teacher-layout':''}"><main class="content" id="main-content" tabindex="-1">${content}</main><footer class="app-footer"><a href="#dashboard" data-action="go-dashboard" class="brand">${icon('dna')} LISE</a><p>Aprender começa por uma raiz.</p>${legalLinks()}</footer><button class="back-to-top" type="button" data-action="back-to-top" aria-label="Voltar ao topo">${icon('arrow-up')}<span>Voltar ao topo</span></button></div></div>`;
    }
    let trigger=null;
    function close() { document.getElementById('mobile-navigation')?.close(); }
    function open(button) {
      const dialog=document.getElementById('mobile-navigation');
      if (!dialog || dialog.open) return;
      trigger=button; dialog.showModal(); document.documentElement.classList.add('drawer-open');
      dialog.querySelector('[data-action="close-menu"]').focus();
    }
    function mount() {
      document.documentElement.classList.remove('drawer-open');
      const dialog=document.getElementById('mobile-navigation');
      if (!dialog) return;
      dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
      dialog.addEventListener('close',()=>{document.documentElement.classList.remove('drawer-open');if(trigger?.isConnected)trigger.focus({preventScroll:true});});
      dialog.addEventListener('keydown',event=>{
        if(event.key!=='Tab') return;
        const buttons=[...dialog.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);
        const first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      });
    }
    window.matchMedia('(min-width:1024px)').addEventListener('change',event=>{if(event.matches)close();});
    return {shell,mount,open,close};
  };
})();
