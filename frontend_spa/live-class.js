/* Refresh shared teaching lists without restoring stale browser-history snapshots. */
(() => {
 'use strict';let hooks={},pending=false;
 const signature=d=>JSON.stringify({trails:d?.trails,classes:d?.classes?.map(c=>({id:c.id,trilhas:c.trilhas})),assessments:d?.assessments,weekly:d?.weekly_leaderboard});
 async function refresh(){
  const s=hooks.state?.();if(!s?.user||document.hidden||pending||s.loading||!['class','dashboard','trails'].includes(s.view))return;
  const view=s.view,id=s.classId,generation=hooks.generation(),archived=s.showArchived;
  pending=true;
  try{const data=await hooks.api(view==='class'?`/classes/${id}`:'/dashboard'+(archived?'?archived=1':''));
   const current=hooks.state();if(current.view!==view||current.classId!==id||current.showArchived!==archived||generation!==hooks.generation())return;
   const previous=view==='class'?current.classDetail:current.dashboard;
   if(signature(data)!==signature(previous)){if(view==='class')current.classDetail=data;else current.dashboard=data;hooks.render();}
  }catch(_){/* Keep the current screen; the next read can retry. */}finally{pending=false;}
 }
 window.addEventListener('focus',refresh);document.addEventListener?.('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.setInterval?.(refresh,15000);
 window.LiseLiveClass={configure:h=>hooks=h,refresh};
})();
