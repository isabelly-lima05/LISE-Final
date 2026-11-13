/* Apply the saved choice before the page is painted. No account data is stored. */
(() => {
 'use strict';
 const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 let preference='system';
 try { const saved=localStorage.getItem('lise_theme');if(['light','dark','system'].includes(saved))preference=saved; } catch(_){}
 function apply(){
  const dark=preference==='dark'||(preference==='system'&&media?.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#121d19':'#f6f7f3');
  document.querySelectorAll('[data-theme-choice]').forEach(el=>{el.value=preference;});
 }
 window.LiseTheme={control:()=>`<label class="theme-control"><span>Tema</span><select data-theme-choice aria-label="Tema da interface"><option value="system" ${preference==='system'?'selected':''}>Automático</option><option value="light" ${preference==='light'?'selected':''}>Claro</option><option value="dark" ${preference==='dark'?'selected':''}>Escuro</option></select></label>`};
 document.addEventListener('change',e=>{
  if(!e.target.matches('[data-theme-choice]'))return;
  const next=e.target.value;if(!['light','dark','system'].includes(next))return;
  preference=next;try{localStorage.setItem('lise_theme',preference);}catch(_){}apply();
 });
 media?.addEventListener?.('change',()=>{if(preference==='system')apply();});
 apply();
})();
