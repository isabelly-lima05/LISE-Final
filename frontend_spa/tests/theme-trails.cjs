const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
// CSS imports must precede every style rule; otherwise browsers ignore themes.
const stylesheet=fs.readFileSync(path.join(root,'app.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const importBlock=stylesheet.match(/^(?:\s*@import[^;]+;)+/)[0];
assert.ok(importBlock.includes('/styles/themes.css'));assert.ok(importBlock.includes('/styles/access.css'));assert.ok(importBlock.includes('/styles/palette.css'));
assert.ok(!stylesheet.slice(importBlock.length).includes('@import'));
for(const reference of importBlock.matchAll(/url\('([^'?]+)(?:\?[^']*)?'\)/g))assert.ok(fs.existsSync(path.join(root,reference[1])),reference[1]);
let clickTheme,systemChange,storageChange,saved=null;const html={dataset:{},style:{}};
const attrs={};const toggle={setAttribute:(k,v)=>attrs[k]=v,closest:s=>s==='[data-theme-toggle]'?toggle:null};
const media={matches:true,addEventListener:(name,fn)=>systemChange=fn};
const themeCtx={window:{matchMedia:()=>media,addEventListener:(name,fn)=>storageChange=fn},document:{documentElement:html,querySelector:()=>null,querySelectorAll:()=>[toggle],addEventListener:(name,fn)=>clickTheme=fn},localStorage:{getItem:()=>null,setItem:(k,v)=>saved=v}};
vm.runInNewContext(fs.readFileSync(path.join(root,'theme.js'),'utf8'),themeCtx);
assert.equal(html.dataset.theme,'dark');assert.equal(attrs['aria-checked'],'true');clickTheme({target:toggle});assert.equal(html.dataset.theme,'light');assert.equal(saved,'light');systemChange();assert.equal(html.dataset.theme,'light','Explicit choice survives OS changes');clickTheme({target:toggle});assert.equal(html.dataset.theme,'dark');assert.equal(saved,'dark');assert.equal(attrs['aria-checked'],'true');storageChange({key:'lise_theme',newValue:null});media.matches=false;systemChange();assert.equal(html.dataset.theme,'light');
assert.match(themeCtx.window.LiseTheme.control(),/role="switch"/);assert.ok(!themeCtx.window.LiseTheme.control().includes('<select'));
// Storage denial must not block login or toggling.
const blocked={...themeCtx,localStorage:{getItem(){throw Error()},setItem(){throw Error()}}};vm.runInNewContext(fs.readFileSync(path.join(root,'theme.js'),'utf8'),blocked);clickTheme({target:toggle});assert.equal(html.dataset.theme,'dark');
function luminance(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
for(const [fg,bg] of [['233a30','ffffff'],['52665b','f6f7f3'],['ffffff','315b45'],['edf4ef','1c2b24'],['b8cbc0','121d19'],['10251a','a5d8b5']]){const a=luminance(fg),b=luminance(bg);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg}/${bg}`);}
let harness=fs.readFileSync(path.join(root,'tests/games.cjs'),'utf8').split('(async()=>')[0].replace('rememberRoute,startPractice','rememberRoute,handleClick,renderAuth,startPractice');harness+='\nglobalThis.qa={ctx,t:ctx.window.test,node};';
const box={require,console,URL,URLSearchParams,structuredClone,clearTimeout,setTimeout,__dirname:path.join(root,'tests')};vm.createContext(box);vm.runInContext(harness,box);
const {ctx,t}=box.qa;box.qa.node.close=()=>{};const s=t.state;const button={tagName:'BUTTON',dataset:{action:'delete-trail',id:'4'},setAttribute(){},removeAttribute(){}};
const click=()=>t.handleClick({target:{closest:()=>button}});
// Every mode keeps the same access component and the original API form contracts.
ctx.window.LiseTheme=themeCtx.window.LiseTheme;
s.legalVersion='test';const originalQuery=box.qa.node.querySelector;box.qa.node.querySelector=selector=>selector==='[type=submit]'?{isConnected:false}:null;
for(const [mode,form] of [['login','login'],['register','register'],['recovery','recovery']]){
 s.authMode=mode;t.renderAuth();const markup=box.qa.node.innerHTML;
 assert.ok(markup.includes('class="access-panel '));assert.ok(markup.includes('data-form="'+form+'"'));assert.ok(markup.includes('data-theme-toggle'));assert.ok(!markup.includes('<select'));assert.ok(markup.includes('id="auth-email"'));
 if(mode==='register'){assert.ok(markup.includes('name="accept_terms"'));assert.ok(markup.includes('value="PROFESSOR"'));assert.ok(markup.includes('value="ALUNO"'));}
}
// Switching either direction must attach the animation hook; a fresh login must not.
const transitions=[];
for(const [wasRegister,mode] of [[false,'register'],[true,'login']]){
 box.qa.node.querySelector=selector=>selector==='[type=submit]'?{isConnected:false}:selector==='.access-panel'?{classList:{contains:()=>wasRegister,add:name=>transitions.push(name)}}:null;
 s.authMode=mode;t.renderAuth();
}
assert.deepEqual(transitions,['access-changing','access-changing']);
const accessCSS=fs.readFileSync(path.join(root,'styles/access.css'),'utf8');
assert.ok(accessCSS.includes("url('/assets/auth-organic.webp')"));assert.ok(!accessCSS.includes('auth-panorama.webp'));
assert.match(accessCSS,/access-changing\.access-register \.access-story\{animation:access-story-to-register/);
assert.match(accessCSS,/access-changing:not\(\.access-register\) \.access-story\{animation:access-story-to-login/);
box.qa.node.querySelector=originalQuery;
(async()=>{
 s.user={name:'Professor',role:'Professor',avatar:'leaf'};s.view='trails';let calls=[],confirmations=0;ctx.window.LiseInteractions={notify:()=>{},busy:()=>()=>{},confirm:async()=>{confirmations++;return true;}};
 let conflict=false;
 ctx.fetch=async(url,opts)=>{const endpoint=url.split('/api/v1')[1];calls.push([endpoint,opts.method,opts.body]);if(endpoint==='/trails/4'&&opts.method==='DELETE')return {ok:!conflict,status:conflict?409:200,json:async()=>conflict?{error:'Trilha atribuída a turmas'}:{message:'Apagada'}};if(endpoint==='/trails/4')return {ok:true,json:async()=>({trail:{revision:7}})};return {ok:true,json:async()=>({role:'Professor',classes:[],trails:[]})};};
 await click();assert.equal(s.view,'trails');assert.deepEqual(calls.map(x=>x[0]),['/trails/4','/dashboard']);
 calls=[];conflict=true;await click();assert.equal(confirmations,3);assert.equal(s.view,'trails');assert.ok(calls.some(x=>x[0]==='/trails/4/archive'&&x[1]==='POST'&&JSON.parse(x[2]).revision===7));
 calls=[];ctx.window.LiseInteractions.confirm=async()=>false;await click();assert.equal(calls.length,0,'Cancel makes no request');
 console.log('PASS: system/manual theme, denied storage, palette contrast, trail deletion, conflict/archive with fresh revision, cancellation and route preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
