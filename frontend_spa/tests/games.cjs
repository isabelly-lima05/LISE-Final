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
source=source.replace("init().catch(error=>{renderAuth();toast(error.message,'error');});",'window.test={api,routeSnapshots,state,init,renderClassTrails,renderAssessmentConfig,sourceLink,renderProfile,renderDashboard,renderGames,rememberRoute,startPractice,renderGameQuestion,completeMemory,renderNotFound};');
vm.runInContext(source,ctx);
(async()=>{
 const t=ctx.window.test; t.state.user=user;
 // A new Decifrador session must not inherit letters from the previous round.
 t.state.decipherSlots=[1,0]; t.state.decipherSelectedLetter=1;
 ctx.fetch=async()=>({ok:true,json:async()=>({session_id:'new',game:'decifrador',questions:[{id:'q',letters:['A','B'],clue:'Teste'}]})});
 await t.startPractice('decifrador',{type:'area',area:'Teste'});
 assert.deepEqual(Array.from(t.state.decipherSlots),[null,null]);
 assert.equal(t.state.decipherSelectedLetter,null);
 // Session creation failure returns to a usable configuration screen.
 ctx.fetch=async()=>({ok:false,status:503,json:async()=>({error:'API indisponível'})});
 await assert.rejects(()=>t.startPractice('decifrador',{type:'area',area:'Teste'}));
 assert.equal(t.state.view,'game-config');
 // Saving the final memory pair can be retried after a temporary network error.
 t.state.gameSession={session_id:'memory',game:'memoria',questions:[{id:'m',cards:[{id:'a',text:'A'},{id:'b',text:'B'}]}]};
 t.state.gameIndex=0;t.state.view='game'; t.state.memoryMatched=new Set(['a','b']);t.state.memoryPairs=[['a','b']];
 await t.completeMemory();
 assert.match(t.state.memoryCompletionError,/indisponível/);
 assert.match(t.renderGameQuestion(),/memory-complete/);
 ctx.fetch=async()=>({ok:true,json:async()=>({correct:true,xp:10,feedback:{}})});
 await t.completeMemory();assert.equal(t.state.gameFeedback.correct,true);assert.equal(t.state.memoryCompleting,false);
 t.renderNotFound();assert.match(node.innerHTML,/404/);
 console.log('PASS: reinício do Decifrador, falha ao iniciar, repetição ao salvar memória e página 404.');
})().catch(e=>{console.error(e);process.exitCode=1});
