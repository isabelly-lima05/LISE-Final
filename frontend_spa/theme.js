/* Resolve theme before paint; one accessible switch, shared across all routes. */
(() => {
 'use strict';
 const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 let preference='system';
 try{const saved=localStorage.getItem('lise_theme');if(['light','dark','system'].includes(saved))preference=saved;}catch(_){}
 const isDark=()=>preference==='dark'||(preference==='system'&&!!media?.matches);
 const art=(name)=>name==='sun'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>';
 function sync(){
  const dark=isDark();
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111c18':'#f4f5ef');
  document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.setAttribute('aria-checked',String(dark));b.title=dark?'Ativar tema claro':'Ativar tema escuro';});
 }
 window.LiseTheme={control:()=>`<button type="button" class="appearance-switch" data-theme-toggle role="switch" aria-label="Tema escuro" aria-checked="${isDark()}" title="${isDark()?'Ativar tema claro':'Ativar tema escuro'}"><span class="appearance-sun">${art('sun')}</span><span class="appearance-moon">${art('moon')}</span><span class="appearance-thumb" aria-hidden="true"></span></button>`};
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-theme-toggle]');if(!b)return;
  const nextDark=!isDark();
  b.classList?.remove('is-moving-on','is-moving-off');void b.offsetWidth;b.classList?.add(nextDark?'is-moving-on':'is-moving-off');
  preference=nextDark?'dark':'light';try{localStorage.setItem('lise_theme',preference);}catch(_){}sync();
  globalThis.setTimeout?.(()=>b.classList?.remove('is-moving-on','is-moving-off'),260);
 });
 window.addEventListener('storage',e=>{if(e.key!=='lise_theme')return;preference=['light','dark'].includes(e.newValue)?e.newValue:'system';sync();});
 media?.addEventListener?.('change',()=>{if(preference==='system')sync();});
 sync();
})();
