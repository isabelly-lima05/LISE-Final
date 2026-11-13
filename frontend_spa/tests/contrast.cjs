const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'styles/tokens.css'),'utf8');
const tokens=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2]]));
function luminance(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c.reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
const pairs={texto:[tokens.ink,tokens.cream],secundario:[tokens.muted,tokens.cream],botao:['#ffffff',tokens.green],prefixo:[tokens.prefix,tokens['prefix-wash']],radical:[tokens.root,tokens['root-wash']],sufixo:[tokens.suffix,tokens['suffix-wash']],destaque:[tokens.gold,tokens.cream],codigo:['#365039','#edf2e4']};
const result={};for(const [name,colors]of Object.entries(pairs)){const a=luminance(colors[0]),b=luminance(colors[1]);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${name}: ${ratio}`);result[name]=Number(ratio.toFixed(2));}
fs.writeFileSync(path.join(root,'../validacao_local/naturalista-contraste.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS: contrastes dos tokens e código de turma >= 4.5:1.',result);
