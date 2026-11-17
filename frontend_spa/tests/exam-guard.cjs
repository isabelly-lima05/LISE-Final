const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const source=fs.readFileSync(path.join(__dirname,'../exam-guard.js'),'utf8');
function setup(storage=new Map()){
 const events={},docEvents={},calls=[],results=[],retry={hidden:true};let fail=false;
 const ctx={console,Date,JSON,setTimeout:()=>1,clearTimeout(){},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{hidden:false,querySelectorAll:()=>[],querySelector:()=>retry,addEventListener:(k,fn)=>docEvents[k]=fn},window:{location:{hash:'#assessment'},addEventListener:(k,fn)=>events[k]=fn,LiseInteractions:{notify(){}}},fetch:async(url,opts)=>{calls.push({url,...opts});return {ok:true,json:async()=>({score:0,reason:'saida',class_id:1})}}};
 vm.runInNewContext(source,ctx);const guard=ctx.window.LiseExamGuard;
 guard.configure({api:async(url,opts)=>{calls.push({url,...opts});if(fail)throw Error('Offline');return {score:33,reason:opts.body.reason,class_id:1}},getToken:()=> 'token',getUser:()=>({id:'pupil'}),base:'https://api.example.invalid',onResult:r=>results.push(r)});
 return {ctx,guard,calls,results,events,docEvents,retry,setFail:v=>fail=v,storage};
}
(async()=>{
 const x=setup();x.ctx.document.hidden=true;x.docEvents.visibilitychange();assert.equal(x.calls.length,0,'Training has no assigned-exam ticket');
 x.ctx.document.hidden=false;x.guard.start({id:'exam1',classId:1,closesAt:'2099-01-01'});await Promise.all([x.guard.leave(),x.guard.leave()]);assert.equal(x.calls.length,1,'Leaving is idempotent');assert.equal(x.guard.active(),false);assert.equal(x.results[0].reason,'saida');
 x.guard.start({id:'exam2',classId:1});x.ctx.document.hidden=true;x.docEvents.visibilitychange();await new Promise(setImmediate);assert.equal(x.calls.at(-1).keepalive,true);assert.equal(x.calls.at(-1).headers.Authorization,'Bearer token');assert.equal(x.guard.active(),false);
 x.ctx.document.hidden=false;x.guard.start({id:'exam3',classId:1});x.setFail(true);await x.guard.leave();assert.equal(x.guard.closing(),true);assert.equal(x.retry.hidden,false);const y=setup(x.storage);await y.guard.recover();assert.equal(y.calls.length,1,'Reload closes the old ticket instead of resuming');assert.equal(y.guard.active(),false);
 console.log('PASS: training unaffected, assigned exit closure, keepalive, duplicate events, offline lock, retry and reload recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
