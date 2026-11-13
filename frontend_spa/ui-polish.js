(() => {
  'use strict';
  let queued=false;
  function sync(){document.documentElement.classList.toggle('page-scrolled',window.scrollY>360);queued=false;}
  window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(sync);}},{passive:true});
  window.addEventListener('pageshow',sync);
  setInterval(()=>{
    if(document.hidden)return;
    const clock=document.querySelector('[data-memory-clock]');
    if(!clock)return;
    const seconds=Math.max(0,Math.floor((Date.now()-Number(clock.dataset.start))/1000));
    clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  },1000);
  sync();
})();
