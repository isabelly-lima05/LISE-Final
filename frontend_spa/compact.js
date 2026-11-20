/* Compact navigation: paginate visible lists; never clip or remove their records. */
(() => {
 'use strict';
 const positions=new Map(),sections=new Map();let currentRoot,currentState,resizeTimer;
 const keyFor=s=>[s.view,s.accountTab,s.classTab,s.classId,s.collection?.id,s.user?.id||s.user?.email||s.user?.name].join(':');
 const elements=parent=>[...parent.children].filter(el=>!el.matches('.compact-pagination'));
 function plan(total,height,top,itemHeight,columns){
  const rows=Math.max(1,Math.floor(Math.max(0,height-Math.max(0,top)-92)/Math.max(1,itemHeight+14)));
  const size=Math.max(1,Math.min(12,rows*Math.max(1,columns)));
  return {size,pages:Math.max(1,Math.ceil(total/size))};
 }
 function paginate(el,key){
  if(el.closest('[hidden]')){if(el._lisePager)el._lisePager.hidden=true;return;}
  const itemSelector=el.matches('.crud-sessions')?'.crud-list-item':el.matches('.request-history')?'.privacy-request':null;
  const items=itemSelector?elements(el).filter(n=>n.matches(itemSelector)):elements(el);
  if(!items.length)return;
  items.forEach(item=>{item.hidden=false;});
  const old=el._lisePager;if(old)old.remove();
  const box=el.getBoundingClientRect();
  const sample=items.slice(0,Math.min(items.length,6)).map(n=>n.getBoundingClientRect());
  const first=sample[0];const gap=parseFloat(getComputedStyle(el).columnGap)||14;
  const columns=Math.max(1,Math.floor((box.width+gap)/Math.max(1,first.width+gap)));
  const itemHeight=Math.max(54,...sample.map(r=>r.height));
  const paging=plan(items.length,window.innerHeight,box.top+window.scrollY,itemHeight,columns);
  if(paging.pages===1){positions.delete(key);delete el._lisePager;return;}
  const fingerprint=items.length+':'+items.map(n=>n.dataset.term||n.dataset.studentRow||n.querySelector('[data-id]')?.dataset.id||n.textContent.slice(0,45)).join('|');
  const previous=positions.get(key);let page=previous?.fingerprint===fingerprint?Math.min(previous.page,paging.pages-1):0;
  const nav=document.createElement('nav');nav.className='compact-pagination';nav.setAttribute('aria-label','Páginas da lista');
  const prev=document.createElement('button'),next=document.createElement('button'),status=document.createElement('span');
  prev.type=next.type='button';prev.textContent='Anterior';next.textContent='Próxima';status.setAttribute('role','status');status.setAttribute('aria-live','polite');nav.append(prev,status,next);
  function show(){const start=page*paging.size;items.forEach((item,i)=>{item.hidden=i<start||i>=start+paging.size;});prev.disabled=page===0;next.disabled=page===paging.pages-1;status.textContent=`${start+1}-${Math.min(start+paging.size,items.length)} de ${items.length} · Página ${page+1}/${paging.pages}`;positions.set(key,{page,fingerprint});}
  prev.onclick=()=>{if(page>0){page--;show();if(prev.disabled)next.focus({preventScroll:true});}};
  next.onclick=()=>{if(page<paging.pages-1){page++;show();if(next.disabled)prev.focus({preventScroll:true});}};
  // Table pagination belongs outside the table, preserving its semantics.
  const anchor=el.matches('tbody')?el.closest('.table-wrap')||el.closest('table'):el;
  anchor.after(nav);el._lisePager=nav;show();
 }
 function lists(root,s){
  // Student rosters stay complete on one page; their table already has its own
  // responsive layout and should not inherit the viewport-based list pager.
  const selected='.class-grid,.trail-list,.collection-grid,.word-path,.collection-notes,.planning-panel ul,.crud-sessions,.request-history';
  root.querySelectorAll(selected).forEach((el,i)=>paginate(el,keyFor(s)+':list:'+i));
 }
 function deck(main,s){
  let host=main,groups=[],anchor;
  if(s.view==='dashboard'){
   const teacher=!!main.querySelector('.teacher-welcome');
   if(teacher){const columns=main.querySelector('.teacher-columns'),panels=columns?elements(columns):[];
    groups=[['Resumo',[main.querySelector('.teacher-metrics'),main.querySelector('.workspace-shortcuts')]],['Turmas',[panels[0]]],['Trilhas',[panels[1]]],['Planejamento',[main.querySelector('.planning-panel')]]];
    anchor=main.querySelector('.teacher-welcome');
   }else{const columns=main.querySelector('.home-columns'),panels=columns?elements(columns):[];
    const classes=Array.isArray(s.dashboard?.classes)?s.dashboard.classes.length:0,collections=Array.isArray(s.dashboard?.collections)?s.dashboard.collections.length:Array.isArray(s.collections)?s.collections.length:0;
    groups=[['Descoberta',[main.querySelector('.discovery-sheet'),main.querySelector('.growth-strip')]],['Turmas '+classes,[panels[0]]],['Coleções '+collections,[panels[1]]]];anchor=main.querySelector('.section-heading');
   }
  }else if(s.view==='account'&&s.accountTab==='privacidade'){
   host=main.querySelector('#account-tabpanel');if(!host)return;
   groups=[['Documentos e PDF',[host.querySelector('.account-columns')]],['Solicitações',[host.querySelector('.account-request')]],['Histórico',[host.querySelector('.request-history')]],['Excluir conta',[host.querySelector('.account-danger')]]];
  }else if(s.view==='account'&&s.accountTab==='seguranca'){
   host=main.querySelector('#account-tabpanel');if(!host)return;
   groups=[['Senha e segurança',[host.querySelector('.account-columns')]],['Acessos ativos',[host.querySelector('.crud-sessions')]]];
  }
  groups=groups.map(([name,nodes])=>[name,nodes.filter(Boolean)]).filter(([,nodes])=>nodes.length);
  if(groups.length<2||host.querySelector(':scope > .compact-section-nav'))return;
  const nav=document.createElement('nav');nav.className='compact-section-nav';nav.setAttribute('aria-label','Seções desta página');
  const buttons=groups.map(([title])=>{const b=document.createElement('button');b.type='button';b.textContent=title;if(title==='Excluir conta')b.classList.add('compact-danger');nav.append(b);return b;});
  const key=keyFor(s)+':deck';let selected=sections.get(key)||0;if(selected>=groups.length)selected=0;
  function choose(index){selected=index;sections.set(key,index);groups.forEach(([,nodes],i)=>{nodes.forEach(n=>n.hidden=i!==index);buttons[i].setAttribute('aria-pressed',String(i===index));});
   main.querySelectorAll('.teacher-columns,.home-columns').forEach(wrap=>{wrap.classList.add('compact-columns');wrap.hidden=elements(wrap).every(n=>n.hidden);});
   lists(main,s);
  }
  buttons.forEach((b,i)=>b.onclick=()=>choose(i));
  if(anchor)anchor.after(nav);else host.prepend(nav);choose(selected);
 }
 function mount(root,s){
  if(['game','assessment','legal','auth'].includes(s.view))return;
  currentRoot=root;currentState=s;const main=root.querySelector('main.content');if(!main)return;
  main.classList.add('compact-content');deck(main,s);lists(main,s);
 }
 window.LiseCompact={mount,plan};
 window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(currentRoot?.isConnected&&currentState)mount(currentRoot,currentState);},180);});
 // Session cards arrive asynchronously from the existing management module.
 const observer=new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('.crud-sessions'))&&currentRoot&&currentState)lists(currentRoot,currentState);});
 document.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('app');if(root)observer.observe(root,{childList:true,subtree:true});},{once:true});
})();
