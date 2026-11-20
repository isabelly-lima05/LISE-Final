/* Interacoes compartilhadas. Conteudo do usuario sempre entra por textContent/escape. */
(() => {
 'use strict';
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let hooks={},observer,dirty=false,dragged=null,progressObserver,lastEntrance='',previousTabs=new Map(),seenStats=new Set(),memoryFaces=new Map(),lastMemorySession='',leavePromise=null;
 const pending=new Map();
 const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
 const icons=()=>window.lucide?.createIcons({attrs:{'stroke-width':1.7}});
 const motion=(el,frames,opts={})=>!reduced()&&el?.animate?.(frames,{duration:200,easing:'cubic-bezier(.77,0,.175,1)',...opts});
 const pulse=el=>{if(reduced()||!el?.isConnected)return;el.classList.remove('ui-confirm-pulse');void el.offsetWidth;el.classList.add('ui-confirm-pulse');setTimeout(()=>el.classList.remove('ui-confirm-pulse'),360);};
 const shake=el=>{if(reduced()||!el?.isConnected)return;el.classList.remove('ui-error-shake');void el.offsetWidth;el.classList.add('ui-error-shake');setTimeout(()=>el.classList.remove('ui-error-shake'),280);};
 function notify(message,tone='success',options={}) {
  const root=document.getElementById('toast');if(!root)return;
  root.className='toast-stack';root.removeAttribute('role');root.removeAttribute('aria-live');
  const card=document.createElement('div');card.className='notice';card.dataset.tone=tone;
  card.setAttribute('role',tone==='error'?'alert':'status');
  const labels={success:'Tudo certo',error:'Não foi possível concluir',warning:'Atenção',info:'Em andamento'};
  const marks={success:'circle-check',error:'circle-x',warning:'triangle-alert',info:'info'};
  const mark=document.createElement('span');mark.className='notice-mark';mark.innerHTML=icon(marks[tone]||marks.info);card.append(mark);
  const copy=document.createElement('span');copy.className='notice-copy';
  const title=document.createElement('strong');title.className='notice-title';title.textContent=options.title||labels[tone]||labels.info;
  const text=document.createElement('span');text.className='notice-message';text.textContent=message;
  copy.append(title,text);card.append(copy);
  let timer,closing=false;const close=()=>{clearTimeout(timer);if(closing||!card.isConnected)return;closing=true;if(reduced()){card.remove();return;}const exit=motion(card,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}],{duration:160,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});Promise.resolve(exit?.finished).catch(()=>{}).then(()=>card.remove());};
  if(options.action){const action=document.createElement('button');action.type='button';action.className='btn btn-text';action.textContent=options.label||'Desfazer';action.onclick=()=>{options.action();close();};card.append(action);}
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='icon-button';dismiss.setAttribute('aria-label','Dispensar aviso');dismiss.innerHTML=icon('x');dismiss.onclick=close;card.append(dismiss);
  root.append(card);icons();const entrance=motion(card,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{easing:'cubic-bezier(.23,1,.32,1)'});if(tone==='success')Promise.resolve(entrance?.finished).catch(()=>{}).then(()=>pulse(card));if(tone==='error')Promise.resolve(entrance?.finished).catch(()=>{}).then(()=>shake(card));
  let remaining=options.duration??4000,started=Date.now();
  const start=()=>{started=Date.now();timer=setTimeout(close,remaining);};
  const pause=()=>{clearTimeout(timer);remaining=Math.max(0,remaining-(Date.now()-started));};
  card.addEventListener('mouseenter',pause);card.addEventListener('mouseleave',start);
  card.addEventListener('focusin',pause);card.addEventListener('focusout',start);start();
  while(root.children.length>4)root.firstElementChild.remove();return close;
 }
 function dialog(title,body,trigger) {
  const el=document.createElement('dialog');el.className='app-dialog interaction-dialog';
  const id='interaction-'+crypto.randomUUID();el.setAttribute('aria-labelledby',id);
  el.innerHTML=`<div class="dialog-heading"><h2 id="${id}">${esc(title)}</h2><button type="button" class="icon-button" data-ui="dismiss-dialog" aria-label="Fechar">${icon('x')}</button></div>${body}`;
  document.body.append(el);icons();
  const nativeClose=el.close.bind(el);let closing=false;
  el.close=value=>{if(closing)return;if(reduced()){nativeClose(value);return;}closing=true;const exit=motion(el,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(6px) scale(.98)'}],{duration:160,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});Promise.resolve(exit?.finished).catch(()=>{}).then(()=>nativeClose(value));};
  el.addEventListener('cancel',event=>{event.preventDefault();el.close();});
  el.addEventListener('click',e=>{if(e.target===el)el.close();});
  el.addEventListener('close',()=>{el.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});},{once:true});
  el.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...el.querySelectorAll('button:not([disabled]),input,select,textarea,a[href]')].filter(x=>x.getClientRects().length);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}});
  el.showModal();(el.querySelector('[autofocus]')||el.querySelector('button'))?.focus();return el;
 }
 function confirmAction(title,message,trigger,attention=false) {
  return new Promise(resolve=>{const el=dialog(title,`<p>${esc(message)}</p><div class="card-actions"><button class="btn btn-outline" type="button" data-cancel>Cancelar</button><button class="btn ${attention?'btn-attention':'btn-danger'}" type="button" data-confirm>${esc(title)}</button></div>`,trigger);el.querySelector('[data-cancel]').onclick=()=>el.close();el.querySelector('[data-confirm]').onclick=()=>{resolve(true);el.close();};el.addEventListener('close',()=>resolve(false),{once:true});el.querySelector('[data-cancel]').focus();});
 }
 function busy(button,label='Salvando…') {
  if(!button)return()=>{};
  const html=button.innerHTML,disabled=button.disabled,width=button.getBoundingClientRect().width;
  const authButton=button.classList.contains('access-submit');
  button.style.minWidth=width+'px';button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML=authButton?`<span class="access-chip-loader" aria-hidden="true"><i>Pato</i><i>gên</i><i>ese</i></span><span class="sr-only">${esc(label)}</span>`:`<span class="spinner" aria-hidden="true"></span><span>${esc(label)}</span>`;
  return success=>{button.disabled=disabled;button.removeAttribute('aria-busy');if(success&&button.isConnected){button.innerHTML=icon('check')+' Salvo';icons();pulse(button);setTimeout(()=>{button.innerHTML=html;button.style.minWidth='';},1200);}else{button.innerHTML=html;button.style.minWidth='';}};
 }
 async function delayedRemoval(key,node,commit) {
  if(pending.has(key))return;
  const selector=node?.dataset.term?`[data-term="${node.dataset.term}"]`:null;
  const task={node,selector};pending.set(key,task);
  if(node){motion(node,[{opacity:1},{opacity:0,transform:'translateX(8px)'}]);setTimeout(()=>{if(pending.has(key)&&node.isConnected)node.hidden=true;},200);}
  const undo=()=>{clearTimeout(task.timer);pending.delete(key);if(node?.isConnected){node.hidden=false;motion(node,[{opacity:0},{opacity:1}]);}notify('Remoção cancelada.');};
  task.timer=setTimeout(async()=>{pending.delete(key);task.close?.();try{await commit();notify('Remoção concluída.');}catch(error){if(node?.isConnected)node.hidden=false;notify(error.message,'error');}},6000);
  task.close=notify('Remoção agendada.', 'warning',{duration:6000,label:'Desfazer',action:undo});
 }
 function cancelPending(){seenStats.clear();memoryFaces.clear();for(const task of pending.values()){clearTimeout(task.timer);task.close?.();if(task.node?.isConnected)task.node.hidden=false;}pending.clear();}
 function chooseAvatar(trigger) {
  const state=hooks.state(),selected=state.user.avatar;
  const isValid=id=>hooks.avatars.some(a=>a.id===id);
  let choice=isValid(selected)?selected:'';
  const intro=choice?'Escolha outro companheiro ou mantenha o atual.':'Escolha um companheiro para completar seu perfil.';
  const el=dialog('Escolha seu companheiro',`<p class="avatar-dialog-intro">${esc(intro)}</p><div class="avatar-options">${hooks.avatars.map(a=>`<button type="button" class="avatar-option ${a.id===choice?'selected':''}" data-choice="${esc(a.id)}" aria-pressed="${a.id===choice}">${hooks.avatarMarkup(a.id)}<strong>${esc(a.label)}</strong><small>${esc(a.species)}</small></button>`).join('')}</div><div class="card-actions"><button type="button" class="btn btn-outline" data-cancel>Cancelar</button><button type="button" class="btn btn-primary" data-save>Salvar avatar</button></div>`,trigger);
  const save=el.querySelector('[data-save]');save.disabled=!choice;save.title=choice?'':'Escolha um mascote antes de salvar.';
  el.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{choice=b.dataset.choice;save.disabled=false;save.title='';el.querySelectorAll('[data-choice]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});motion(b,[{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:180});});
  el.querySelector('[data-cancel]').onclick=()=>el.close();
  save.onclick=async e=>{if(!choice)return;const restore=busy(e.currentTarget);try{const d=await hooks.api('/auth/profile',{method:'PATCH',body:{avatar:choice}});state.user=d.user;el.close();hooks.render();document.querySelector('[data-ui="avatar"]')?.focus();notify('Avatar atualizado.');}catch(err){notify(err.message,'error');}finally{restore();}};
 }
 function createClass(trigger) {
  const el=dialog('Criar turma',`<p class="dialog-lead">Prepare o espaço da turma agora; o código para os alunos aparece logo após a criação.</p><ol class="creation-flow" aria-label="Etapas para criar a turma"><li class="is-current"><b>1</b><span><strong>Nomear</strong><small>Identifique a turma</small></span></li><li><b>2</b><span><strong>Gerar código</strong><small>A LISE cria automaticamente</small></span></li><li><b>3</b><span><strong>Compartilhar</strong><small>Envie aos alunos</small></span></li></ol><form data-ui-form="new-class"><div class="field"><label for="quick-class-name">Nome da turma</label><input id="quick-class-name" name="name" maxlength="150" required autofocus placeholder="Ex.: 3º ano A"><small>Use um nome fácil de reconhecer no planejamento.</small></div><div class="card-actions"><button class="btn btn-outline" type="button" data-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Criar e gerar código</button></div></form>`,trigger);
  el.querySelector('[data-cancel]').onclick=()=>el.close();
  el.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;if(form.dataset.pending)return;form.dataset.pending='1';const restore=busy(form.querySelector('[type=submit]'),'Criando…');try{const d=await hooks.api('/classes',{method:'POST',body:{name:new FormData(form).get('name')},idempotencyKey:form.dataset.operationKey||(form.dataset.operationKey=crypto.randomUUID())});await hooks.loadDashboard();const c=d.class||d.turma||d;el.querySelector('form').innerHTML=`<div class="created-class"><span class="success-mark">${icon('circle-check')}</span><h3>Turma criada</h3><p>${esc(c.name||'Compartilhe este código com seus alunos.')}</p><button class="code-chip" type="button" data-ui="copy" data-code="${esc(c.code||'')}">${esc(c.code||'')} ${icon('copy')}</button></div><button type="button" class="btn btn-primary" data-ui="dismiss-dialog">Concluir</button>`;icons();notify('Turma criada.');}catch(err){notify(err.message,'error');}finally{delete form.dataset.pending;restore();}};
 }
 function enhancePasswords(root) {
  root.querySelectorAll('input[type=password]:not([data-enhanced])').forEach(input=>{
   input.dataset.enhanced='1';const wrap=document.createElement('div');wrap.className='password-field';input.before(wrap);wrap.append(input);
   const b=document.createElement('button');b.type='button';b.className='icon-button';b.setAttribute('aria-label','Mostrar senha');b.setAttribute('aria-pressed','false');b.innerHTML=icon('eye');wrap.append(b);
   b.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');b.setAttribute('aria-pressed',String(show));b.innerHTML=icon(show?'eye-off':'eye');icons();};
   if(input.id==='new-password'){
    const info=document.createElement('div');info.className='password-requirements';info.innerHTML='<p class="small">Use de 8 a 128 caracteres.</p><meter min="0" max="4" value="0" aria-label="Força estimada da senha"></meter><ul><li data-length>De 8 a 128 caracteres</li><li data-match>Confirmação igual à nova senha</li></ul><small>Força estimada; não substitui uma senha exclusiva.</small>';wrap.after(info);
    const update=()=>{const value=input.value,confirm=root.querySelector('#confirm-password');info.querySelector('[data-length]').classList.toggle('met',value.length>=8&&value.length<=128);info.querySelector('[data-match]').classList.toggle('met',!!value&&confirm?.value===value);info.querySelector('meter').value=Math.min(4,(value.length>=8?1:0)+(value.length>=12?1:0)+(/[a-z]/.test(value)&&/[A-Z]/.test(value)?1:0)+(/[^a-zA-Z]/.test(value)?1:0));};
    input.addEventListener('input',update);root.querySelector('#confirm-password')?.addEventListener('input',update);
   }
  });
 }
 function enhanceAuth(root){
  const form=root.querySelector('.access-form');if(!form||form.dataset.validationReady)return;
  form.dataset.validationReady='true';form.noValidate=true;
  const register=form.dataset.form==='register',email=form.querySelector('input[type=email]'),password=form.querySelector('#auth-password');
  const message=(input,text='')=>{const field=input?.closest('.access-field');if(!field)return;field.classList.toggle('is-invalid',!!text);field.querySelector('.access-field-feedback').textContent=text;input.setAttribute('aria-invalid',String(!!text));};
  const validate=input=>{
   if(!input)return true;
   const value=input.value.trim();let error='';
   if(!value)error=input.type==='email'?'Digite seu e-mail para continuar.':input.type==='password'?'Digite sua senha para continuar.':'Conte seu nome para a gente começar.';
   else if(input.type==='email'&&!input.validity.valid)error='Confira o e-mail — ele deve seguir o formato nome@exemplo.com.';
   else if(input.type==='password'&&input.value.length<8)error='Use pelo menos 8 caracteres — uma frase curta funciona bem.';
   else if(input.name==='name'&&value.length<2)error='Seu nome precisa ter pelo menos 2 caracteres.';
   message(input,error);return !error;
  };
  if(email){
   const updateEmail=showError=>{const ready=!!email.value&&email.validity.valid;email.closest('.access-field').classList.toggle('is-valid',ready);if(showError||ready)validate(email);};
   email.addEventListener('input',()=>updateEmail(false));email.addEventListener('blur',()=>updateEmail(true));
  }
  if(register&&password){
   const strength=document.createElement('div');strength.className='access-password-strength';strength.dataset.strength='0';strength.setAttribute('aria-live','polite');strength.innerHTML='<span class="access-strength-track" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="access-strength-copy"><span>Força da senha</span><strong>Comece a digitar</strong></span>';
   password.closest('.access-field').append(strength);
   const updateStrength=()=>{const value=password.value;const score=Math.min(4,(value.length>=8?1:0)+(value.length>=12?1:0)+(/[a-z]/.test(value)&&/[A-Z]/.test(value)?1:0)+(/[0-9]/.test(value)&&/[^a-zA-Z0-9]/.test(value)?1:0));const labels=['Comece a digitar','Ainda curta','Pode ficar melhor','Boa','Forte'];strength.dataset.strength=String(score);strength.querySelector('strong').textContent=labels[score];if(password.closest('.access-field').classList.contains('is-invalid'))validate(password);};
   password.addEventListener('input',updateStrength);password.addEventListener('blur',()=>validate(password));
  }
  form.querySelectorAll('.access-field input').forEach(input=>input.addEventListener('blur',()=>validate(input)));
  form.addEventListener('submit',event=>{
   let valid=true;form.querySelectorAll('.access-field input[required]').forEach(input=>{if(!validate(input))valid=false;});
   const consent=form.querySelector('.access-consent input[required]');if(consent){const label=consent.closest('.access-consent');let feedback=form.querySelector('.access-consent-feedback');label.classList.toggle('is-invalid',!consent.checked);consent.setAttribute('aria-invalid',String(!consent.checked));if(!consent.checked){valid=false;if(!feedback){feedback=document.createElement('p');feedback.className='access-consent-feedback';label.after(feedback);}feedback.textContent='Para criar sua conta, confirme que leu e aceita os documentos da LISE.';}else feedback?.remove();}
   if(!valid){event.preventDefault();event.stopPropagation();const first=form.querySelector('.is-invalid input');first?.focus({preventScroll:true});first?.closest('.access-field,.access-consent')?.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'});}
  });
  const story=root.querySelector('.access-story'),art=story?.querySelector('.access-story-art');if(!story||!art||reduced())return;
  const morphemes=story.querySelector('.access-morpheme-word'),wordParts=morphemes?.querySelectorAll('span');
  if(wordParts?.length===3){const words=[['Pato','gên','ese'],['Hemo','glob','ina'],['Cito','plasm','a']];let wordIndex=0;const timer=setInterval(()=>{if(!story.isConnected){clearInterval(timer);return;}wordIndex=(wordIndex+1)%words.length;wordParts.forEach((part,index)=>part.textContent=words[wordIndex][index]);morphemes.classList.remove('is-remixing');void morphemes.offsetWidth;morphemes.classList.add('is-remixing');setTimeout(()=>morphemes?.classList.remove('is-remixing'),420);},4200);}
  let frame=0,lastEvent;
  const renderPointer=()=>{frame=0;if(!lastEvent||!story.isConnected)return;const box=story.getBoundingClientRect(),x=Math.max(0,Math.min(box.width,lastEvent.clientX-box.left)),y=Math.max(0,Math.min(box.height,lastEvent.clientY-box.top)),nx=x/box.width-.5,ny=y/box.height-.5;story.style.setProperty('--glow-x',`${x}px`);story.style.setProperty('--glow-y',`${y}px`);art.classList.remove('is-settling');art.style.transform=`translate3d(${nx*12}px,${ny*9}px,0)`;};
  story.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;lastEvent=event;if(!frame)frame=requestAnimationFrame(renderPointer);},{passive:true});
  story.addEventListener('pointerleave',()=>{if(frame)cancelAnimationFrame(frame);frame=0;lastEvent=null;art.classList.add('is-settling');art.style.transform='translate3d(0,0,0)';story.style.setProperty('--glow-x','50%');story.style.setProperty('--glow-y','35%');});
 }
 function tabs(root) {
  root.querySelectorAll('[role=tablist]').forEach(list=>{
   const active=list.querySelector('[aria-selected=true]');if(!active)return;
   list.querySelector(':scope > .tab-indicator')?.remove();
   const key=list.getAttribute('aria-label')||list.id||'tabs',indicator=document.createElement('span');
   indicator.className='tab-indicator';indicator.setAttribute('aria-hidden','true');list.append(indicator);
   const geometry=()=>{const listBox=list.getBoundingClientRect(),activeBox=active.getBoundingClientRect();return {left:activeBox.left-listBox.left+list.scrollLeft,width:activeBox.width};};
   const place=animate=>{if(!list.isConnected)return;const current=geometry(),before=previousTabs.get(key);indicator.style.width=current.width+'px';indicator.style.transform=`translate3d(${current.left}px,0,0)`;if(animate&&before&&!reduced())indicator.animate([{transform:`translate3d(${before.left}px,0,0) scaleX(${before.width/(current.width||1)})`},{transform:`translate3d(${current.left}px,0,0) scaleX(1)`}],{duration:280,easing:'cubic-bezier(.65,0,.35,1)'});previousTabs.set(key,current);};
   place(true);requestAnimationFrame(()=>place(false));document.fonts?.ready.then(()=>place(false));
  });
 }
 const popoverPanel=details=>details.querySelector(':scope>.collection-menu-content,:scope>.management-options,:scope>div');
 function closePopover(details,restoreFocus=false){
  if(!details?.open||details.dataset.closing)return;
  const summary=details.querySelector(':scope>summary'),panel=popoverPanel(details);
  if(reduced()||!panel){details.open=false;if(restoreFocus)summary?.focus();return;}
  details.dataset.closing='true';
  const exit=motion(panel,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.95)'}],{duration:160,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  Promise.resolve(exit?.finished).catch(()=>{}).then(()=>{delete details.dataset.closing;details.open=false;if(restoreFocus)summary?.focus();});
 }
 function popovers(root){
  root.querySelectorAll('details.trail-menu,details.collection-menu,details.management-menu').forEach(details=>{
   if(details.dataset.motionReady)return;details.dataset.motionReady='true';
   details.querySelector(':scope>summary')?.addEventListener('click',event=>{if(!details.open||details.dataset.closing)return;event.preventDefault();closePopover(details);});
  });
 }
 function scrollspy(root) {
  const legal=root.querySelector('.legal-copy');if(!legal)return;
  observer?.disconnect();
  const headings=[...legal.querySelectorAll('h2')];headings.forEach((h,i)=>h.id='legal-section-'+i);
  if(headings.length){const nav=document.createElement('nav');nav.className='legal-toc';nav.setAttribute('aria-label','Nesta página');const strong=document.createElement('strong');strong.textContent='Nesta página';nav.append(strong);for(const h of headings){const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;a.onclick=e=>{e.preventDefault();h.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});h.tabIndex=-1;h.focus({preventScroll:true});};nav.append(a);}legal.before(nav);}
  legal.querySelectorAll('table').forEach(t=>{if(t.parentElement.classList.contains('legal-table-wrap'))return;const wrap=document.createElement('div');wrap.className='legal-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Tabela de cookies; role para os lados');t.before(wrap);wrap.append(t);});
  observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){root.querySelectorAll('.legal-toc a').forEach(a=>a.toggleAttribute('aria-current',a.hash==='#'+entry.target.id));}},{rootMargin:'-10% 0px -65% 0px'});headings.forEach(h=>observer.observe(h));
 }
 function enhanceDates(root){root.querySelectorAll('input[type=date]').forEach(input=>{const box=document.createElement('div');box.className='date-shortcuts';for(const [label,last]of [['Em 1 semana',false],['Fim do mês',true]]){const b=document.createElement('button');b.type='button';b.className='btn btn-text btn-small';b.textContent=label;b.onclick=()=>{const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));const date=new Date(Number(parts.year),Number(parts.month)-1,Number(parts.day));if(last)date.setMonth(date.getMonth()+1,0);else date.setDate(date.getDate()+7);input.value=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');input.dispatchEvent(new Event('change',{bubbles:true}));};box.append(b);}input.after(box);input.min=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());});}
 function assessment(root){
  const form=root.querySelector('[data-form=assessment-config]');if(!form)return;
  const output=document.createElement('p');output.className='schedule-summary';output.setAttribute('role','status');form.prepend(output);
  const format=value=>value.slice(0,10).split('-').reverse().join('/')+' às '+value.slice(11,16);
  const update=()=>{const open=form.elements.opens_at,close=form.elements.closes_at,score=form.elements.pass_score;close.setCustomValidity(open.value&&close.value&&close.value<=open.value?'O encerramento precisa ser posterior à abertura.':'');score.setCustomValidity(Number(score.value)<0||Number(score.value)>100?'Use uma nota de 0 a 100.':'');output.textContent=open.value&&close.value?`Aberto de ${format(open.value)} até ${format(close.value)} · fuso de Brasília`:'Defina a abertura e o encerramento, no fuso de Brasília.';};
  form.addEventListener('input',update);update();
  const existing=hooks.state?.().assessmentTarget?.assessment;
  if(existing?.opens_at&&new Date(existing.opens_at)<=new Date()){
   const note=document.createElement('p');note.className='legal-note';note.textContent='Esta avaliação já foi aberta. As regras e notas foram preservadas; a configuração está disponível para consulta.';output.after(note);
   form.querySelectorAll('input,select,textarea,button[type=submit]').forEach(control=>control.disabled=true);
  }
 }
 function stepper(root){
  const form=root.querySelector('[data-form=trail-create]');if(!form)return;
  let step=0;const panels=[...form.querySelectorAll('[data-step-panel]')];if(panels.length!==3)return;
  const tabs=form.querySelectorAll('[data-step]'),prev=form.querySelector('[data-ui=step-prev]'),next=form.querySelector('[data-ui=step-next]'),save=form.querySelector('[type=submit]');
  const valid=()=>{if(step===0){for(const x of panels[0].querySelectorAll('input,textarea,select'))if(!x.reportValidity())return false;}if(step===1&&!hooks.state().selectedTermIds.size){notify('Selecione ao menos um termo.','warning');return false;}return true;};
  const commit=n=>{step=n;panels.forEach((p,i)=>p.hidden=i!==step);tabs.forEach((t,i)=>{t.setAttribute('aria-current',i===step?'step':'false');t.classList.toggle('active',i===step);});prev.hidden=step===0;next.hidden=step===2;save.hidden=step!==2;save.disabled=!hooks.state().selectedTermIds.size;save.title=save.disabled?'Selecione ao menos um termo':'';form.dataset.currentStep=String(step);};
  const show=n=>{if(n>step&&!valid())return;if(n===2&&!hooks.state().selectedTermIds.size){notify('Selecione ao menos um termo.','warning');return;}if(n===step){commit(n);return;}const from=step,direction=n>from?'forward':'back';if(!reduced()&&document.startViewTransition){document.documentElement.dataset.stepDirection=direction;document.documentElement.classList.add('step-transition');panels[from].style.viewTransitionName='trail-step';panels[n].style.viewTransitionName='trail-step';const transition=document.startViewTransition(()=>commit(n));transition.finished.catch(()=>{}).then(()=>{document.documentElement.classList.remove('step-transition');delete document.documentElement.dataset.stepDirection;panels.forEach(panel=>panel.style.removeProperty('view-transition-name'));});}else{commit(n);motion(panels[n],[{opacity:0,transform:`translateX(${direction==='forward'?16:-16}px)`},{opacity:1,transform:'translateX(0)'}]);}};
  prev.onclick=()=>show(Math.max(0,step-1));next.onclick=()=>show(Math.min(2,step+1));tabs.forEach(t=>t.onclick=()=>show(Number(t.dataset.step)));
  form.addEventListener('submit',event=>{if(step!==2){event.preventDefault();event.stopImmediatePropagation();show(step+1);}},true);form.addEventListener('input',()=>dirty=true);form.addEventListener('change',()=>dirty=true);show(0);
 }
 function mount(root=document.getElementById('app'),key='') {
  if(!root)return;observer?.disconnect();
  const memorySession=hooks.state?.().gameSession?.session_id||'';if(memorySession!==lastMemorySession){memoryFaces.clear();lastMemorySession=memorySession;}
  root.querySelectorAll('.memory-card').forEach(card=>{const face=card.classList.contains('selected')||card.classList.contains('matched'),old=memoryFaces.get(card.dataset.card)||false;memoryFaces.set(card.dataset.card,face);if(face!==old)motion(card.querySelector('.memory-card-inner'),[{transform:old?'rotateY(180deg)':'rotateY(0)'},{transform:face?'rotateY(180deg)':'rotateY(0)'}],{duration:300});});
  tabs(root);popovers(root);enhancePasswords(root);enhanceAuth(root);enhanceDates(root);assessment(root);stepper(root);scrollspy(root);
  for(const button of root.querySelectorAll('button.btn-small,.icon-button,.nav-button'))button.style.minHeight='44px';
  if(key&&key!==lastEntrance&&!key.startsWith('game')){
   root.querySelectorAll('main>.section-heading,main>.stat-strip,main>.teacher-columns,main>.home-columns').forEach((el,i)=>{if(i<6)motion(el,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:220,delay:i*30,easing:'cubic-bezier(.23,1,.32,1)'});});
   root.querySelectorAll('.trail-list>article,.class-grid>.class-card,.collection-grid>.collection-cover,.specimen-grid>.specimen-card,.crud-list-item,.student-table tbody tr,.assessment-list>article').forEach((el,i)=>{if(i<10)motion(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:220,delay:i*30,easing:'cubic-bezier(.23,1,.32,1)'});});
  }
  root.querySelectorAll('.stat-strip dd,[data-count]').forEach((el,i)=>{const id=hooks.state?.().user?.id+':'+key+':'+i;if(seenStats.has(id)||reduced())return;seenStats.add(id);const value=Number(el.dataset.count??el.textContent.replace(/\./g,''));if(!Number.isFinite(value))return;const start=performance.now();const tick=time=>{if(!el.isConnected)return;const progress=Math.min(1,(time-start)/600);el.textContent=Math.round(value*(1-(1-progress)**3)).toLocaleString('pt-BR')+(el.dataset.countSuffix||'');if(progress<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  progressObserver?.disconnect();
  progressObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){motion(entry.target,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'});progressObserver.unobserve(entry.target);}},{threshold:.2});
  root.querySelectorAll('.progress-fill,progress').forEach(el=>progressObserver.observe(el));lastEntrance=key;icons();
 }
 function clearDirty(){dirty=false;}
 async function mayLeave(trigger){if(!dirty)return true;if(!leavePromise)leavePromise=confirmAction('Sair sem salvar','As alterações desta trilha ainda não foram salvas.',trigger,true).finally(()=>leavePromise=null);return leavePromise;}
 window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.trail-menu[open],.collection-menu[open],.management-menu[open]').forEach(menu=>closePopover(menu,true));});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-ui]');if(!b)return;const action=b.dataset.ui;if(['step-prev','step-next'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();if(action==='dismiss-dialog')b.closest('dialog')?.close();else if(action==='avatar')chooseAvatar(b);else if(action==='copy'){try{await navigator.clipboard.writeText(b.dataset.code);notify('Código copiado.');}catch(_e){notify('Não foi possível copiar. Selecione o código exibido.','warning');}}},true);
 document.addEventListener('dragstart',e=>{const chip=e.target.closest('[data-selected-id]');if(!chip)return;dragged=chip.dataset.selectedId;e.dataTransfer.setData('text/lise-term',dragged);});
 document.addEventListener('dragend',()=>dragged=null);
 document.addEventListener('dragover',e=>{if(dragged&&e.target.closest('[data-selected-id]'))e.preventDefault();});
 document.addEventListener('drop',e=>{const chip=e.target.closest('[data-selected-id]');if(!chip||!dragged)return;e.preventDefault();hooks.reorder?.(Number(dragged),Number(chip.dataset.selectedId));dragged=null;});
 window.LiseInteractions={configure:value=>hooks=value,mount,notify,confirm:confirmAction,busy,delayedRemoval,cancelPending,createClass,dialog,markDirty:()=>dirty=true,clearDirty,mayLeave,motion,icons};
})();
