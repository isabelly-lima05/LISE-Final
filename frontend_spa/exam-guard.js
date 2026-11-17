/* This guard applies ONLY to sessions created by a teacher-assigned assessment. */
(() => {
 'use strict';let hooks={},ticket=null,pending=null,timer;
 const KEY='lise_assigned_exam';
 const owner=()=>hooks.getUser?.()?.id||hooks.getUser?.()?.email||'';
 function save(){try{if(ticket)sessionStorage.setItem(KEY,JSON.stringify(ticket));else sessionStorage.removeItem(KEY);}catch(_){}}
 function clear(){ticket=null;clearTimeout(timer);save();}
 function start(item){clear();ticket={...item,owner:owner(),hash:window.location?.hash||'',locked:false};save();const until=new Date(item.closesAt).getTime()-Date.now();if(Number.isFinite(until))timer=setTimeout(()=>leave('prazo'),Math.max(0,Math.min(until,2147483647)));if(document.hidden)leave('saida',true);}
 async function leave(reason='saida',keepalive=false){
  if(!ticket)return false;if(pending)return pending;
  ticket.locked=true;save();clearTimeout(timer);
  document.querySelectorAll('[data-form="assessment-answer"] input,[data-form="assessment-answer"] button').forEach(el=>el.disabled=true);
  const item=ticket;window.LiseInteractions?.notify('Encerrando sua tentativa…','info');
  pending=(async()=>{
   try{
    let result;
    if(keepalive){const response=await fetch(`${hooks.base}/api/v1/assessment/sessions/${item.id}/abandon`,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:`Bearer ${hooks.getToken()}`},body:JSON.stringify({reason})});if(!response.ok)throw new Error('Falha ao registrar o encerramento.');result=await response.json();}
    else result=await hooks.api(`/assessment/sessions/${item.id}/abandon`,{method:'POST',body:{reason}});
    if(owner()!==item.owner){ticket=null;return false;}
    clear();hooks.onResult(result);return true;
   }catch(error){const retry=document.querySelector('[data-exam-retry]');if(retry)retry.hidden=false;window.LiseInteractions?.notify('Sua tentativa foi bloqueada neste navegador. Reconecte e clique em “Registrar encerramento” para enviar o resultado.','error');return false;}
   finally{pending=null;}
  })();return pending;
 }
 async function recover(){if(!hooks.getUser?.())return false;if(!ticket){try{ticket=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch(_){ticket=null;}}if(!ticket||ticket.owner!==owner()){ticket=null;return false;}await leave();return true;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ticket)leave('saida',true);});
 window.addEventListener('pagehide',()=>{if(ticket)leave('saida',true);});
 window.addEventListener('beforeunload',()=>{if(ticket)leave('saida',true);});
 window.addEventListener('hashchange',()=>{if(ticket&&ticket.hash&&window.location.hash!==ticket.hash)leave('saida');});
 window.addEventListener('online',()=>{if(ticket?.locked)leave();});
 window.LiseExamGuard={configure:h=>hooks=h,start,clear,leave,recover,active:()=>!!ticket,closing:()=>!!ticket?.locked};
})();
