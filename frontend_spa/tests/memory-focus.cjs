const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');let harness=fs.readFileSync(path.join(root,'tests/games.cjs'),'utf8').split('(async()=>')[0];
harness=harness.replace('rememberRoute,startPractice','rememberRoute,handleClick,startPractice');
harness+='\nglobalThis.qa={ctx,t:ctx.window.test,node};';
const sandbox={require,console,URL,URLSearchParams,structuredClone,clearTimeout,setTimeout,__dirname:path.join(root,'tests')};vm.createContext(sandbox);vm.runInContext(harness,sandbox);
const {ctx,t,node}=sandbox.qa,s=t.state;node.close=()=>{};s.user={role:'Aluno',name:'Teste',avatar:'owl'};
s.view='game';s.gameFeedback=null;s.memorySelected=[];s.memoryMatched=new Set();s.memoryPairs=[];s.memoryAttempts=0;s.memoryStartedAt=Date.now();
for(const count of [4,6,10,12]){
 const cards=Array.from({length:count},(_,i)=>({id:'c'+i,text:'Definição longa '.repeat(30)}));
 s.gameSession={session_id:'test',game:'memoria',questions:[{id:'q',mode:'termo_definicao',cards}]};s.gameIndex=0;
 const html=t.renderGameQuestion();
 assert.equal((html.match(/data-action="memory-card"/g)||[]).length,count,'Nenhuma carta pode desaparecer do tabuleiro');
 assert.match(html,new RegExp('--mem-rows-small:'+Math.ceil(count/3)));
 assert.equal((html.match(/data-action="memory-read"/g)||[]).length,0,'Leitura não revela cartas fechadas');
 s.memoryPreview=true;
 const preview=t.renderGameQuestion();
 assert.match(preview,/memory-session memory-preview/,'A partida deve identificar a prévia de memorização');
 assert.equal((preview.match(/class="memory-card[^>]+disabled/g)||[]).length,count,'A onda inicial não pode aceitar palpites antes de fechar');
 s.memoryPreview=false;
 s.memorySelected=['c0'];
 assert.equal((t.renderGameQuestion().match(/data-action="memory-read"/g)||[]).length,2,'Carta virada pode ser lida pelo corpo ou pelo ícone');
 s.memorySelected=[];
}
(async()=>{
 let reads=[];ctx.window.LiseInteractions={dialog(title,body){reads.push(body);return {classList:{add(){}}};}};
 const button={tagName:'BUTTON',dataset:{action:'memory-read',card:'c0'},setAttribute(){},removeAttribute(){}};
 await t.handleClick({target:{closest:()=>button}});assert.equal(reads.length,0,'Carta fechada não pode ser aberta pela ação de leitura');
 s.gameSession.questions[0].cards[0].text='<script>alert(1)</script>';s.memorySelected=['c0'];
 await t.handleClick({target:{closest:()=>button}});assert.equal(reads.length,1);assert.ok(reads[0].includes('&lt;script&gt;'));assert.ok(!reads[0].includes('<script>'));
 assert.equal(s.memorySelected.length,1,'Ler não pode alterar o par selecionado');
 console.log('PASS: todos os cards preservados, modos reduzidos, leitura apenas de cartas viradas, escape e estado da partida.');
})().catch(e=>{console.error(e);process.exitCode=1});
