// Executar: node frontend_spa/tests/regression.cjs
// Testes de lógica/renderização em DOM mínimo; não substituem navegador real.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const node={innerHTML:'',addEventListener(){},querySelector(){return null},querySelectorAll(){return []},contains(){return false},classList:{add(){},remove(){}}};
const listeners={},location={pathname:'/',hash:'',search:''};
const history={state:null,pushes:0,replaceState(s,_,url){this.state=s;location.hash=url.includes('#')?'#'+url.split('#')[1]:''},pushState(s,_,url){this.pushes++;this.replaceState(s,_,url)}};
const requests=[];
const user={name:'Aluno Teste',email:'aluno@example.com',role:'Aluno',avatar:'leaf'};
const dashboard={role:'Aluno',classes:[],collections:[],stats:{},areas:[]};
const term={id:7,name:'Biologia',area:'Biologia',definition:'Estudo da vida',radical_list:[]};
const fixtures={
 '/auth/me':{user},'/dashboard':dashboard,'/collections':{collections:[]},
 '/explore/terms/7':{term,similar_terms:[]},
 '/collections/3':{collection:{id:3,name:'Coleção teste',terms:[],term_items:[]}},
 '/trails/4?assignment_id=5':{trail:{id:4,assignment_id:5,class_id:2,name:'Trilha teste',term_items:[]}},
 '/classes/2':{id:2,name:'Turma teste',role:'Aluno',trails:[],students:[],ranking:[]}
};
const ctx={console,URL,URLSearchParams,structuredClone,clearTimeout,setTimeout:()=>0,Date,Set,Map,location,history,localStorage:{getItem:k=>k==='lise_access_token'?'test-token':null,removeItem(){},setItem(){}},document:{getElementById:()=>node,activeElement:null,documentElement:{classList:{remove(){},add(){}}}},MutationObserver:class{observe(){}},fetch:async url=>{const key=url.split('/api/v1')[1];requests.push(key);assert.ok(key in fixtures,`API inesperada: ${key}`);return {ok:true,json:async()=>structuredClone(fixtures[key])}}};
ctx.window={matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},LISE_CONFIG:{API_BASE_URL:'https://example.test'},addEventListener:(name,cb)=>listeners[name]=cb};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'avatars.js'),'utf8'),ctx);
for(const file of ['components.js','navigation.js','activities.js','screens.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
let source=fs.readFileSync(path.join(root,'app.js'),'utf8');
source=source.replace("init().catch(error=>{renderAuth();toast(error.message,'error');});",'window.test={api,routeSnapshots,state,init,renderClassTrails,renderAssessmentConfig,sourceLink,renderProfile,renderDashboard,renderGames,rememberRoute};');
vm.runInContext(source,ctx);
(async()=>{
 const t=ctx.window.test;t.state.user=user;
 assert.equal(t.sourceLink('javascript:alert(1)'),'', 'Esquema executavel nao pode virar link');
 assert.equal(t.sourceLink('data:text/html,<script>alert(1)</script>'),'', 'Conteudo data nao pode virar link de referencia');
 assert.match(t.sourceLink('https://example.test/fonte'),/noopener noreferrer/);
 const before=requests.length;
 const [first,second]=await Promise.all([t.api('/dashboard'),t.api('/dashboard')]);
 assert.equal(requests.length-before,1,'Leituras simultâneas devem compartilhar uma requisição');
 first.areas.push('Mutação local');assert.equal(second.areas.length,0,'Resultados devem ser independentes');
 await t.api('/dashboard');assert.equal(requests.length-before,2,'Nova leitura deve buscar dados atuais');

 assert.match(t.renderProfile(),/data-ui="avatar"/,'Perfil abre seletor de avatar por acao explicita');
 assert.equal((t.renderProfile().match(/class="avatar-option /g)||[]).length,0,'Grade de avatares fica no dialogo');
 for (const avatar of ctx.window.LISE_AVATARS) assert.ok(fs.existsSync(path.join(root,avatar.image.replace(/^\//,''))),avatar.image);
 assert.ok(fs.existsSync(path.join(root,'assets/avatars/avatar-placeholder.svg')),'placeholder neutro existe');
 assert.equal(new Set(ctx.window.LISE_AVATARS.map(a=>a.id)).size,10);
 const currentUser=t.state.user;t.state.user={...currentUser,avatar:'placeholder'};
 assert.match(t.renderProfile(),/avatar-placeholder/,'Conta nova usa placeholder neutro');
 assert.match(t.renderProfile(),/Escolha seu companheiro/,'Perfil convida a escolher mascote');
 t.state.user=currentUser;

 const data={id:2,trails:[{id:4,assignment_id:5,name:'Trilha',terms:[],assessment:{can_start:true,opens_at:'2026-01-01',closes_at:'2027-01-01'}}]};
 assert.match(t.renderClassTrails(data,false),/data-action="start-assessment"/);
 assert.match(t.renderClassTrails(data,true),/data-action="configure-assessment"/);
 t.state.assessmentTarget={class_id:2,assignment_id:5,trail_name:'Trilha',assessment:null};
 const assessmentConfig=t.renderAssessmentConfig();
 assert.match(assessmentConfig,/data-form="assessment-config"/,'Configurar avaliacao deve abrir o formulario');
 assert.match(assessmentConfig,/data-action="back-to-class"/,'Voltar deve levar a turma da avaliacao');
 for(const [route,expected] of [['detail/term/7','detail'],['collection/3','collection'],['trail/4/5','trail'],['class/2','class']]) {
   const beforeDashboard=requests.filter(p=>p==='/dashboard').length;
   location.hash='#'+route;await t.init();assert.equal(requests.filter(p=>p==='/dashboard').length,beforeDashboard,'Link direto não deve carregar o painel');assert.equal(t.state.view,expected,route);assert.ok(location.hash.startsWith('#'+route));
 }
 t.state.view='dashboard';t.state.dashboard=dashboard;t.state.loading=false;t.rememberRoute();const count=history.pushes;
 t.state.detail={term:{id:99}};t.rememberRoute();assert.equal(history.pushes,count,'Estado de outra tela não deve criar histórico');
 t.state.discovery=term;assert.match(t.renderDashboard(),/Descoberta do dia/);assert.match(t.renderGames(),/EXPERIMENTO 04/);
 assert.ok(requests.includes('/explore/terms/7'));assert.ok(requests.includes('/trails/4?assignment_id=5'));
 for(let i=0;i<50;i++){t.state.view='class';t.state.classId=i;t.rememberRoute();}assert.ok(t.routeSnapshots.size<=20,'Histórico deve ter limite');
 console.log('PASS: 10 avatares, avaliação aluno/professor, quatro rotas após reload, histórico estável e painel/jogos.');
})().catch(e=>{console.error(e);process.exitCode=1});
