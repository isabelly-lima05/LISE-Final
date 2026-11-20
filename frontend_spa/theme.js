/* Resolve theme before paint; one accessible switch, shared across all routes. */
(() => {
 'use strict';
 const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 let preference='system';
 try{const saved=localStorage.getItem('lise_theme');if(['light','dark','system'].includes(saved))preference=saved;}catch(_){}
 const isDark=()=>preference==='dark'||(preference==='system'&&!!media?.matches);
 const setFavicon=()=>{
  if(!document.head||typeof document.createElement!=='function')return;
  if(document.querySelector('link[rel="icon"]'))return;
  const icon=document.createElement('link');
  icon.rel='icon';icon.type='image/svg+xml';icon.href='/assets/favicon.svg';
  document.head.append(icon);
 };
 const art=(name)=>name==='sun'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>';
 let pendingTheme=false,pendingTimer=null;
 function applyTheme(dark){
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111c18':'#f4f5ef');
 }
 function syncControls(dark){
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.setAttribute('aria-checked',String(dark));b.title=dark?'Ativar tema claro':'Ativar tema escuro';});
 }
 function sync(){const dark=isDark();applyTheme(dark);syncControls(dark);}
 window.LiseTheme={control:()=>`<button type="button" class="appearance-switch" data-theme-toggle role="switch" aria-label="Tema escuro" aria-checked="${isDark()}" title="${isDark()?'Ativar tema claro':'Ativar tema escuro'}"><span class="appearance-sun">${art('sun')}</span><span class="appearance-moon">${art('moon')}</span><span class="appearance-thumb" aria-hidden="true"></span></button>`};
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-theme-toggle]');if(!b)return;
  if(pendingTheme)return;
  const nextDark=!isDark();
  b.classList?.remove('is-moving-on','is-moving-off');void b.offsetWidth;b.classList?.add(nextDark?'is-moving-on':'is-moving-off');
  preference=nextDark?'dark':'light';try{localStorage.setItem('lise_theme',preference);}catch(_){}syncControls(nextDark);
  const finish=()=>{if(!pendingTheme&&typeof b.addEventListener==='function')return;pendingTheme=false;globalThis.clearTimeout?.(pendingTimer);b.classList?.remove('is-moving-on','is-moving-off');applyTheme(nextDark);syncControls(nextDark);};
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if(reduce||typeof b.addEventListener!=='function'){pendingTheme=true;finish();return;}
  pendingTheme=true;
  const onEnd=event=>{if(event.target?.classList?.contains('appearance-thumb'))finish();};
  b.addEventListener('animationend',onEnd,{once:true});
  pendingTimer=globalThis.setTimeout?.(finish,280);
 });
 window.addEventListener('storage',e=>{if(e.key!=='lise_theme')return;pendingTheme=false;globalThis.clearTimeout?.(pendingTimer);preference=['light','dark'].includes(e.newValue)?e.newValue:'system';sync();});
 media?.addEventListener?.('change',()=>{if(preference==='system')sync();});
 setFavicon();sync();
})();
