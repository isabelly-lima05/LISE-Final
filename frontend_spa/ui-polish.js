(() => {
  'use strict';
  let queued=false;
  function sync(){document.documentElement.classList.toggle('page-scrolled',window.scrollY>360);queued=false;}
  window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(sync);}},{passive:true});
  window.addEventListener('pageshow',sync);
  sync();
})();
