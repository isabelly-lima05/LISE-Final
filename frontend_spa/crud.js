/* Management UI backed by revision-checked API operations. */
(() => {
 'use strict';
 let hooks={};
 const esc=value=>window.LiseComponents.esc(value),icon=name=>window.LiseComponents.icon(name);
 const ui=()=>window.LiseInteractions;
 const state=()=>hooks.state();
 const api=(path,options={})=>hooks.api(path,options);
 const operation=()=>crypto.randomUUID();
 const control=(label,action,attrs='',kind='btn-outline')=>`<button type="button" class="btn ${kind} btn-small" data-crud="${action}" ${attrs}>${label}</button>`;
 function add(parent,markup){if(parent){parent.insertAdjacentHTML('beforeend',markup);ui().icons();}}
 async function refresh(){await hooks.reload();}
 async function confirm(title,text,button,attention=false){return ui().confirm(title,text,button,attention);}
 async function send(path,body,method='POST',key,options={}){return api(path,{method,body,idempotencyKey:key||operation(),...options});}
 function formDialog(title,content,onSave,trigger,label='Salvar'){
  const manager=trigger?.closest('dialog[data-terms-manager]');
  const el=ui().dialog(title,`<form data-crud-form>${content}<div class="card-actions"><button type="button" class="btn btn-outline" data-ui="dismiss-dialog">Cancelar</button><button class="btn btn-primary" type="submit">${label}</button></div></form>`,trigger);
  el.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;if(form.dataset.pending)return;form.dataset.pending='1';const end=ui().busy(form.querySelector('[type=submit]'));try{await onSave(new FormData(form),el,form.dataset.operationKey||(form.dataset.operationKey=operation()));el.close();await refresh();if(manager){manager.close();await termsManager(document.querySelector('[data-crud=terms]'));}ui().notify('Alteração salva.');}catch(error){ui().notify(error.message,'error');}finally{delete form.dataset.pending;end();}};
  el.querySelector('input,textarea,select')?.focus();return el;
 }
 function field(label,name,value='',type='text',max=150){return `<div class="field"><label for="crud-${name}">${esc(label)}</label><input id="crud-${name}" name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" required></div>`;}
 function classControls(item){return `<div class="card-actions crud-actions">${control('Renomear','class-edit',`data-id="${item.id}"`)}${control(item.archived_at?'Restaurar':'Arquivar','class-archive',`data-id="${item.id}" data-restore="${!!item.archived_at}"`)}${item.archived_at?control('Excluir definitivamente','class-delete',`data-id="${item.id}"`,'btn-danger'):''}</div>`;}
 async function classItem(id){return api('/classes/'+id);}
 async function termsManager(trigger,archived=false){
  const d=await api('/my-terms'+(archived?'?archived=1':''));
  const el=ui().dialog('Meus termos',`<p>Altere somente os termos que você criou. Conteúdos oficiais permanecem protegidos.</p><div class="card-actions">${control(archived?'Ver ativos':'Ver arquivados','terms-toggle',`data-archived="${!archived}"`)}${control('Criar termo','term-new')}</div><div class="crud-term-list">${d.terms.length?d.terms.map(t=>`<article class="crud-list-item"><h3>${esc(t.name)}</h3><p>${esc(t.definition)}</p><p class="small muted">${t.usage.trails} trilha(s) · ${t.usage.classes} turma(s) · ${t.usage.collections} coleção(ões)</p><div class="card-actions">${control('Editar','term-edit',`data-id="${t.id}"`)}${control('Duplicar','term-duplicate',`data-id="${t.id}"`)}${control(t.archived?'Restaurar':'Arquivar','term-archive',`data-id="${t.id}" data-revision="${t.revision}" data-restore="${t.archived}"`)}${control('Excluir','term-delete',`data-id="${t.id}" data-revision="${t.revision}"`,'btn-danger')}</div></article>`).join(''):'<p>Nenhum termo nesta lista.</p>'}</div>`,trigger);el.dataset.termsManager=archived?'archived':'active';return el;
 }
 async function editTrail(id){
  const [d,meta,dashboard]=await Promise.all([api('/trails/'+id),api('/meta'),api('/dashboard')]);
  const s=state();s.editingTrail=d.trail;s.trailDraft=null;s.dashboard=dashboard;s.trailAreas=meta.areas;
  s.selectedTermIds=new Set(d.trail.term_items.map(t=>t.id));s.selectedTermInfo=new Map(d.trail.term_items.map(t=>[t.id,t]));s.existingTermIds=new Set();s.catalogTerms=[];s.view='trail-create';hooks.render();
 }
 async function accountSessions(panel){
  try{const d=await api('/account/sessions');if(!panel.isConnected)return;
   panel.innerHTML=`<h2>Acessos ativos</h2><p class="small muted">Os nomes dos navegadores são informados pelo próprio dispositivo.</p>${d.sessions.map(s=>`<div class="crud-list-item"><strong>${s.current?'Este acesso':esc(s.device)}</strong><p class="small muted">Último uso: ${esc(hooks.fmtDate(s.last_used))}</p>${control(s.current?'Encerrar este acesso':'Encerrar acesso','session-revoke',`data-id="${s.id}"`)}</div>`).join('')}`;ui().icons();
  }catch(error){if(panel.isConnected)panel.textContent=error.message;}
 }
 function mount(root){
  const s=state();if(!s.user)return;const teacher=s.user.role==='Professor';
  const heading=root.querySelector('main>.section-heading .card-actions')||root.querySelector('main>.section-heading');
  if(['classes','trails'].includes(s.view))add(heading,control(s.showArchived?'Ver ativos':'Ver arquivados','archive-view'));
  if(s.view==='classes'){
   root.querySelectorAll('.class-card').forEach(card=>{const id=card.querySelector('[data-action=open-class]')?.dataset.id;const item=s.dashboard.classes.find(c=>String(c.id)===id);if(item)add(card,teacher?classControls(item):control('Sair da turma','class-leave',`data-id="${item.id}"`));});
  }
  if(s.view==='class'&&s.classDetail){const d=s.classDetail;
   if(teacher){add(heading,`<details class="management-menu"><summary>Gerenciar turma <i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="management-options">${classControls(d)}<div class="card-actions crud-actions">${control('Gerar novo código','class-code',`data-id="${d.id}"`)}${control(d.enrollment_open?'Fechar matrículas':'Abrir matrículas','class-enrollment',`data-id="${d.id}"`)}</div></div></details>`);
    root.querySelectorAll('[data-student-row]').forEach(row=>add(row.querySelector('td:last-child'),control('Remover da turma','student-remove',`data-class="${d.id}" data-user="${row.dataset.studentRow}"`,'btn-text danger-text')));
    if(s.classTab==='trails'){
     add(root.querySelector('#class-tabpanel'),control('Atribuições arquivadas','assignments-archived',`data-class="${d.id}"`));
     for(const t of d.trails){const remove=root.querySelector(`[data-action=unassign-trail][data-id="${t.id}"]`);if(remove){remove.removeAttribute('data-action');remove.dataset.crud='assignment-archive';remove.dataset.assignment=t.assignment_id;remove.dataset.class=d.id;remove.dataset.revision=t.assignment_revision;remove.textContent='Arquivar atribuição';const actions=remove.closest('article').querySelector('.card-actions');add(actions,control('Editar prazo','assignment-date',`data-assignment="${t.assignment_id}"`));
       const a=t.assessment;if(a?.opens_at&&a.closes_at){const now=Date.now(),action=new Date(a.opens_at)>now?'cancel':new Date(a.closes_at)>now?'close':'reopen';add(actions,control(({cancel:'Cancelar agendamento',close:'Encerrar avaliação agora',reopen:'Reabrir janela'})[action],'assessment-life',`data-assignment="${t.assignment_id}" data-kind="${action}"`));}
      }
     }
    }
   }
   if(d.archived_at){add(root.querySelector('main>.section-heading'),'<p class="legal-note">Turma arquivada: histórico disponível para consulta; novas práticas e matrículas estão bloqueadas.</p>');root.querySelectorAll('[data-action=practice-trail],[data-action=start-assessment],[data-action=open-assign]').forEach(b=>{b.disabled=true;b.title='Turma arquivada';});}
  }
  if(['dashboard','trails'].includes(s.view)&&teacher)for(const t of s.dashboard?.trails||[]){const menu=root.querySelector(`[data-action=delete-trail][data-id="${t.id}"]`)?.parentElement;if(menu)add(menu,control('Editar trilha','trail-edit',`data-id="${t.id}"`,'btn-text')+control(t.archived_at?'Restaurar':'Arquivar','trail-archive',`data-id="${t.id}" data-revision="${t.revision}" data-restore="${!!t.archived_at}"`,'btn-text'));}
  if(s.view==='trail-create'&&s.editingTrail){const t=s.editingTrail;root.querySelector('.page-title').textContent='Editar trilha';const f=root.querySelector('[data-form=trail-create]');f.elements.name.value=t.name;f.elements.description.value=t.description;f.elements.area.value=t.area;f.querySelector('[data-step-panel="2"]').innerHTML='<h2>Confirmar alterações</h2><p>As atribuições existentes serão mantidas. Palavras com prática ou avaliação vinculada não podem ser removidas.</p>';f.querySelector('[data-step="2"]').innerHTML='<b>3</b>Confirmar';f.querySelector('[type=submit]').textContent='Salvar alterações';}
  if(s.view==='collections')for(const c of s.collections){const card=root.querySelector(`[data-action=open-collection][data-id="${c.id}"]`)?.closest('article');if(card)add(card.querySelector('.collection-menu-content')||card,control('Renomear','collection-edit',`data-id="${c.id}"`,'btn-text'));}
  if(s.view==='collection')add(heading,control('Renomear coleção','collection-edit',`data-id="${s.collection.id}"`));
  if(s.view==='explore')add(heading,control('Meus termos','terms'));
  if(s.view==='account'&&s.accountTab==='seguranca'){const panel=document.createElement('section');panel.className='card crud-sessions';panel.textContent='Consultando acessos…';root.querySelector('#account-tabpanel').append(panel);accountSessions(panel);}
  if(s.view==='account'&&s.accountTab==='privacidade'&&s.account){
   const panel=document.createElement('section');panel.className='card account-danger';panel.innerHTML=`<div class="danger-heading"><span class="danger-mark">${icon('triangle-alert')}</span><div><span class="eyebrow">Área sensível</span><h2>Excluir minha conta</h2></div></div><p>A exclusão encerra todos os seus acessos e remove seus dados pessoais da LISE. Esta ação não pode ser desfeita.</p><p class="account-danger-detail">Turmas, trilhas e avaliações compartilhadas podem ser arquivadas sem sua autoria para preservar atividades e notas de outras pessoas.</p><form data-crud-form="delete-account">${field('Confirme sua senha atual','password','','password',128)}${field('Digite EXCLUIR para confirmar','confirmation','','text',7)}<label class="check-row"><input type="checkbox" name="preserve" required><span>Entendo que perderei o acesso e que o histórico educacional compartilhado será preservado sem vínculo com a minha conta.</span></label><button type="submit" class="btn btn-danger">Excluir minha conta definitivamente</button></form>`;
   root.querySelector('#account-tabpanel').append(panel);
   panel.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;if(form.dataset.pending)return;if(!await confirm('Excluir conta definitivamente','Seus dados pessoais e todos os acessos à LISE serão removidos. Esta ação não pode ser desfeita.',form.querySelector('[type=submit]')))return;form.dataset.pending='1';const end=ui().busy(form.querySelector('[type=submit]'),'Excluindo…');try{const data=new FormData(form),d=await send('/account',{password:data.get('password'),confirmation:data.get('confirmation'),preserve_shared_history:data.has('preserve')},'DELETE',undefined,{silentNotice:true});hooks.forget();ui().notify(d.message,d.auth_pending?'warning':'success',{duration:8000,title:d.auth_pending?'Conta removida da LISE':'Conta excluída'});}catch(error){ui().notify(error.message,'error',{title:'Não foi possível excluir a conta'});}finally{delete form.dataset.pending;end();}};
   root.querySelectorAll('.privacy-request').forEach((node,index)=>{const item=s.account.requests[index];if(item?.status==='pendente')add(node,control('Cancelar pedido','request-cancel',`data-id="${esc(item.id)}"`,'btn-text'));});
  }
 }
 document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-crud]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();if(b.dataset.pending)return;b.dataset.pending='1';
  try{
   const action=b.dataset.crud,id=Number(b.dataset.id),s=state();
   if(action==='archive-view'){s.showArchived=!s.showArchived;await hooks.archiveView(s.showArchived);}
   else if(action==='class-edit'){const d=await classItem(id);formDialog('Renomear turma',field('Nome da turma','name',d.name),data=>send('/classes/'+id,{name:data.get('name'),revision:d.revision},'PATCH'),b);}
   else if(action==='class-enrollment'){const d=await classItem(id);if(await confirm(d.enrollment_open?'Fechar matrículas':'Abrir matrículas','Os alunos já matriculados continuam na turma.',b,true)){await send('/classes/'+id,{revision:d.revision,enrollment_open:!d.enrollment_open},'PATCH');await refresh();}}
   else if(action==='class-code'){const d=await classItem(id);if(await confirm('Gerar novo código','O código anterior deixará de funcionar imediatamente.',b,true)){await send('/classes/'+id+'/code',{revision:d.revision,confirm:true});await refresh();ui().notify('Novo código gerado.');}}
   else if(action==='class-archive'){const d=await classItem(id),restore=b.dataset.restore==='true';if(await confirm(restore?'Restaurar turma':'Arquivar turma',restore?'A turma voltará à lista ativa. As matrículas continuarão fechadas até você reabri-las.':'A turma sai da lista ativa e não aceita novas práticas. Notas e vínculos permanecem guardados.',b,true)){await send('/classes/'+id+(restore?'/restore':'/archive'),{revision:d.revision});await refresh();}}
   else if(action==='class-delete'){const d=await classItem(id);formDialog('Excluir turma definitivamente',`<p>Somente turmas arquivadas e sem vínculos ou histórico podem ser excluídas. Digite <strong>${esc(d.name)}</strong>.</p>${field('Nome exato da turma','confirmation')}`,data=>send('/classes/'+id,{revision:d.revision,confirmation:data.get('confirmation')},'DELETE'),b,'Excluir definitivamente');}
   else if(action==='class-leave'){if(await confirm('Sair da turma','Você deixará de acessar os conteúdos da turma. Suas atividades anteriores serão preservadas.',b,true)){await send('/classes/'+id+'/leave',{confirm:true});await refresh();}}
   else if(action==='student-remove'){if(await confirm('Remover aluno da turma','O acesso à turma será encerrado. As atividades e notas anteriores não serão apagadas.',b)){await send(`/classes/${b.dataset.class}/students/${encodeURIComponent(b.dataset.user)}`,{confirm:true},'DELETE');await refresh();}}
   else if(action==='trail-edit'){await editTrail(id);}
   else if(action==='trail-archive'){const restore=b.dataset.restore==='true';if(await confirm(restore?'Restaurar trilha':'Arquivar trilha','As atribuições e o histórico são preservados. Uma trilha arquivada não inicia novas práticas.',b,true)){await send('/trails/'+id+(restore?'/restore':'/archive'),{revision:Number(b.dataset.revision)});await refresh();}}
   else if(action==='assignment-archive'){const klass=b.dataset.class,assignment=b.dataset.assignment,rev=Number(b.dataset.revision);ui().delayedRemoval(`archive:${klass}:${assignment}`,b.closest('article'),async()=>{await send(`/classes/${klass}/assignments/${assignment}/archive`,{revision:rev});await refresh();});}
   else if(action==='assignment-date'){const t=s.classDetail.trails.find(t=>String(t.assignment_id)===b.dataset.assignment);formDialog('Editar prazo',`<p>Quando há BioQuiz agendado, o prazo segue seu encerramento.</p><div class="field"><label for="crud-due">Prazo (opcional)</label><input id="crud-due" name="due_date" type="date" value="${esc(t.due_date?.slice(0,10)||'')}"></div>`,data=>send(`/classes/${s.classId}/assignments/${t.assignment_id}`,{revision:t.assignment_revision,due_date:data.get('due_date')||null},'PATCH'),b);}
   else if(action==='assignments-archived'){const d=await api(`/classes/${s.classId}/assignments/archived`);ui().dialog('Atribuições arquivadas',d.assignments.length?d.assignments.map(t=>`<div class="crud-list-item"><strong>${esc(t.name)}</strong>${control('Restaurar','assignment-restore',`data-id="${t.id}" data-revision="${t.revision}"`)}</div>`).join(''):'<p>Nenhuma atribuição arquivada.</p>',b);}
   else if(action==='assignment-restore'){await send(`/classes/${s.classId}/assignments/${id}/restore`,{revision:Number(b.dataset.revision)});b.closest('dialog').close();await refresh();}
   else if(action==='assessment-life'){
    const t=s.classDetail.trails.find(t=>String(t.assignment_id)===b.dataset.assignment),a=t.assessment,kind=b.dataset.kind,path=`/classes/${s.classId}/assignments/${t.assignment_id}/assessment/${kind}`;
    if(kind==='reopen'){formDialog('Reabrir janela de BioQuiz',`<p>Notas anteriores permanecem registradas. A nova janela não altera questões ou nota mínima.</p>${field('Abertura (Brasília)','opens_at','','datetime-local')}${field('Encerramento (Brasília)','closes_at','','datetime-local')}`,data=>send(path,{revision:a.revision,opens_at:data.get('opens_at'),closes_at:data.get('closes_at')}),b,'Reabrir');}
    else if(await confirm(kind==='cancel'?'Cancelar agendamento':'Encerrar avaliação agora',kind==='cancel'?'O horário será removido. Avaliações com tentativas são protegidas.':'Novas respostas nesta janela serão bloqueadas. Notas concluídas permanecem disponíveis.',b)){await send(path,{revision:a.revision});await refresh();}
   }
   else if(action==='collection-edit'){const d=await api('/collections/'+id);formDialog('Renomear coleção',field('Nome','name',d.collection.name,'text',100),data=>send('/collections/'+id,{revision:d.collection.revision,name:data.get('name')},'PATCH'),b);}
   else if(action==='terms'){await termsManager(document.querySelector('[data-crud=terms]')||b);}
   else if(action==='terms-toggle'){b.closest('dialog').close();await termsManager(b,b.dataset.archived==='true');}
   else if(action==='term-new'){formDialog('Criar termo',field('Nome','name','','text',200)+'<div class="field"><label for="crud-definition">Definição</label><textarea id="crud-definition" name="definition" maxlength="5000" required></textarea></div>',async (data,el,key)=>{await send(s.user.role==='Professor'?'/terms':'/me/terms',{context:'personal',name:data.get('name'),definition:data.get('definition')},'POST',key);},b);}
   else if(action==='term-edit'){const d=(await api('/my-terms/'+id)).item,used=Object.values(d.usage).some(Boolean);formDialog('Editar termo',field('Nome','name',d.name,'text',200)+`<div class="field"><label for="crud-definition">Definição</label><textarea id="crud-definition" name="definition" maxlength="5000" required>${esc(d.definition)}</textarea></div>${used?'<label class="check-row"><input name="impact" type="checkbox" required><span>Entendo que a mudança vale para todos os vínculos deste termo. Questões já geradas mantêm seu conteúdo original.</span></label>':''}`,data=>send('/my-terms/'+id,{revision:d.revision,name:data.get('name'),definition:data.get('definition'),confirm_impact:data.has('impact')},'PATCH'),b);}
   else if(action==='term-duplicate'){await send('/my-terms/'+id+'/duplicate',{},'POST',b.dataset.operationKey||(b.dataset.operationKey=operation()));b.closest('dialog')?.close();await termsManager(document.querySelector('[data-crud=terms]')||b);}
   else if(action==='term-archive'){await send('/my-terms/'+id+(b.dataset.restore==='true'?'/restore':'/archive'),{revision:Number(b.dataset.revision)});b.closest('dialog')?.close();await termsManager(document.querySelector('[data-crud=terms]')||b);await refresh();}
   else if(action==='term-delete'){if(await confirm('Excluir termo','Termos em uso serão protegidos pelo servidor. A exclusão de um termo sem vínculos é definitiva.',b)){await send('/my-terms/'+id,{revision:Number(b.dataset.revision)},'DELETE');b.closest('dialog')?.close();await termsManager(document.querySelector('[data-crud=terms]')||b);await refresh();}}
   else if(action==='session-revoke'){if(await confirm('Encerrar acesso','Este dispositivo precisará entrar novamente.',b,true)){const d=await send('/account/sessions/'+encodeURIComponent(b.dataset.id),{},'DELETE');if(d.current)hooks.forget();else await refresh();}}
   else if(action==='request-cancel'){await send('/account/requests/'+encodeURIComponent(b.dataset.id)+'/cancel',{});await refresh();ui().notify('Pedido cancelado.');}
  }catch(error){ui().notify(error.message,'error');}finally{delete b.dataset.pending;}
 },true);
 window.LiseCrud={configure:value=>hooks=value,mount};
})();
