// DOM test with measured sizes supplied explicitly; not a browser layout test.
// Install the test-only dependency: npm install --no-save linkedom
const {parseHTML}=require('linkedom'),fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {window}=parseHTML('<html><body><div id="app"></div></body></html>'),document=window.document;
window.innerHeight=900;window.scrollY=0;const root=document.getElementById('app');
window.HTMLElement.prototype.getBoundingClientRect=function(){return this.matches('.specimen-grid,.class-grid')?{top:300,width:960,height:800}:this.matches('article')?{top:300,width:300,height:220}:{top:100,width:960,height:50};};
const ctx={window,document,MutationObserver:window.MutationObserver,getComputedStyle:()=>({columnGap:'20px'}),clearTimeout,setTimeout};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../compact.js'),'utf8'),ctx);
const cards=n=>Array.from({length:n},(_,i)=>`<article data-term="${i+1}">Palavra ${i+1}</article>`).join('');
const markup=n=>`<main class="content"><div class="class-grid">${cards(n)}</div></main>`;
const state={view:'classes',user:{email:'teste@example.invalid'}};
root.innerHTML=markup(15);window.LiseCompact.mount(root,state);
const visible=()=>[...root.querySelectorAll('article')].filter(n=>!n.hidden).map(n=>Number(n.dataset.term));
assert.deepEqual(visible(),[1,2,3,4,5,6]);let seen=[...visible()];
root.querySelector('.compact-pagination button:last-child').click();seen.push(...visible());root.querySelector('.compact-pagination button:last-child').click();seen.push(...visible());
assert.deepEqual(seen,Array.from({length:15},(_,i)=>i+1),'Every record remains reachable once, in order');
root.innerHTML=markup(15);window.LiseCompact.mount(root,state);assert.deepEqual(visible(),[13,14,15],'Page survives render');
root.innerHTML=markup(5);window.LiseCompact.mount(root,state);assert.deepEqual(visible(),[1,2,3,4,5],'Filter never leaves an empty stale page');
root.innerHTML=`<main class="content"><div class="section-heading">Início</div><section class="discovery-sheet">Descoberta</section><section class="growth-strip">Progresso</section><div class="home-columns"><section class="dashboard-section">Turmas</section><section class="dashboard-section">Coleções</section></div></main>`;
window.LiseCompact.mount(root,{view:'dashboard',user:state.user,dashboard:{classes:[{},{}]},collections:[{}]});const nav=root.querySelector('.compact-section-nav');assert.equal(nav.children.length,3);assert.equal(nav.children[1].textContent,'Turmas 2');assert.equal(nav.children[2].textContent,'Coleções 1');
nav.children[1].click();assert.ok(root.querySelector('.discovery-sheet').hidden);assert.equal(root.querySelectorAll('.dashboard-section')[0].hidden,false);assert.equal(root.querySelectorAll('.dashboard-section')[1].hidden,true);
assert.equal(nav.children[1].getAttribute('aria-pressed'),'true');
root.innerHTML='<main class="content"><div class="specimen-grid">'+cards(35)+'</div><div class="games-grid">'+cards(8)+'</div></main>';window.LiseCompact.mount(root,{view:'explore',user:state.user});assert.equal(root.querySelectorAll('[hidden]').length,0);assert.equal(root.querySelector('.compact-pagination'),null,'Explorador and games are not paginated');
root.innerHTML='<main class="content"><div class="table-wrap"><table class="student-table"><tbody>'+Array.from({length:18},(_,i)=>`<tr data-student-row="${i+1}"><td>Aluno ${i+1}</td></tr>`).join('')+'</tbody></table></div></main>';
window.LiseCompact.mount(root,{view:'class',classTab:'students',classId:1,user:state.user});
assert.equal(root.querySelectorAll('.student-table tbody tr[hidden]').length,0,'A turma mostra todos os alunos na mesma página');
assert.equal(root.querySelector('.compact-pagination'),null,'A tabela de alunos não recebe paginação compacta');
const p=window.LiseCompact.plan(30,200,300,250,1);assert.equal(p.size,1);assert.equal(p.pages,30,'Small screens keep every record accessible');
console.log('PASS: pagination, all records reachable, state restoration, filters, dashboard sections and tiny-screen fallback.');
