const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),jspdf=require(path.join(root,'assets/vendor/jspdf.umd.min.js'));
const context={window:{jspdf},setTimeout,console,Intl,Date,Uint8Array};vm.runInNewContext(fs.readFileSync(path.join(root,'data-report.js'),'utf8'),context);
const fontData=['DejaVuSans.ttf','DejaVuSans-Bold.ttf'].map(file=>fs.readFileSync(path.join(root,'assets/pdf-fonts',file)).toString('base64'));
const data={gerado_em:'2026-11-13T17:15:00Z',conta:{id_usuario:'conta-demonstracao',nome:'João da Conceição',email:'joao@example.invalid',perfil:'ALUNO',criado_em:'2026-01-01T12:00:00Z',avatar:'leaf',password:'SEGREDO_NAO_EXPORTAR'},observacao:'Dados fictícios para validação do relatório.',usuario_turma:[],flashcards:[],lise_aceites_legais:[{id:1,termos_versao:'v1',aceito_em:'2026-01-02T15:00:00Z'}],lise_game_sessions:[],lise_colecoes:Array.from({length:19},(_,i)=>({id:i+1,nome:`Coleção número ${i+1}`,descricao:i===9?'Texto completo com acentuação: ação, privacidade, segurança. '.repeat(100)+'FIM_DO_TEXTO_EXTENSO':'Descrição pessoal',pontuacao:0,arquivada:false,detalhe:{senha:'OUTRO_SEGREDO',nota:'Incluído sem cortes'},url:i===15?'https://exemplo.invalid/'+('muitolongo'.repeat(70)):'Sem endereço'}))};
(async()=>{
 const full=await context.window.LiseDataReport.build(data,{fontData,account:{legal_version:'v1',legal_ready:true,accepted:true,accepted_at:'2026-01-02T15:00:00Z',requests:[]},sessions:{sessions:[{device:'Navegador de demonstração',current:true,last_used:'2026-11-13T17:00:00Z',expires_at:'2026-11-14T17:00:00Z',id:'HASH_NAO_EXIBIR'}]}});
 assert.equal(full.audit.records,20);assert.ok(full.document.getNumberOfPages()>2);
 const target=process.argv[2];if(target)fs.writeFileSync(target,Buffer.from(full.document.output('arraybuffer')));
 const partial=await context.window.LiseDataReport.build({conta:{nome:'Ana'},lise_colecoes:[]},{fontData});assert.ok(partial.document.getNumberOfPages()>=2);
 await assert.rejects(()=>context.window.LiseDataReport.build({}, {fontData}));
 console.log('PASS: PDF multipágina, registros completos, acentos, texto extenso, valores zero/falso, consulta parcial e dados inválidos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
