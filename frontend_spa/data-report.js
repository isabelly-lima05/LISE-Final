/* Personal data report: text-only PDF, local fonts, no remote conversion service. */
(() => {
 'use strict';
 const names={usuarios:'Perfil',usuario_turma:'Matrículas em turmas',usuario_trilha_termo:'Progresso nas trilhas',flashcards:'Flashcards',lise_flashcards:'Flashcards',lise_recompensas:'Recompensas',lise_conquistas:'Conquistas',lise_aceites_legais:'Aceites de documentos',lise_pedidos_privacidade:'Pedidos de privacidade',lise_favoritos_termos:'Termos favoritos',lise_favoritos_radicais:'Elementos favoritos',lise_colecoes:'Coleções',lise_colecao_termos:'Palavras nas coleções',lise_game_sessions:'Sessões de jogos',lise_game_session_questions:'Questões das sessões de jogos',lise_partidas:'Partidas e respostas',lise_avaliacao_sessoes:'Sessões de avaliação',lise_avaliacao_questoes:'Questões de avaliação',turmas:'Turmas criadas',trilhas:'Trilhas criadas',termos_criados:'Termos criados'};
 const explanations={usuario_turma:'Seus vínculos de matrícula e a pontuação registrada em cada turma.',usuario_trilha_termo:'Registros de prática por palavra e trilha, com conclusão e acertos.',lise_game_sessions:'Resumo de cada sessão de jogo: conteúdo, resultados, pontuação e datas.',lise_game_session_questions:'Vínculos e respostas das questões. Gabaritos internos não fazem parte da cópia.',lise_partidas:'Histórico individual de partidas disponibilizado pela aplicação.',lise_avaliacao_sessoes:'Resultados e datas das avaliações realizadas.',lise_pedidos_privacidade:'Solicitações sobre seus dados e as respostas registradas.',lise_aceites_legais:'Versões dos documentos e datas de aceite registradas na aplicação.'};
 const labels={id:'Identificador',id_usuario:'Identificador da conta',nome:'Nome',name:'Nome',email:'E-mail',perfil:'Perfil',role:'Perfil',avatar:'Avatar escolhido',criado_em:'Criado em',criada_em:'Criada em',created_at:'Criado em',ultimo_acesso_em:'Último acesso',ultima_revisao:'Última revisão',fk_usuario:'Conta vinculada',fk_turma:'Turma vinculada',fk_professor:'Professor responsável',fk_trilha:'Trilha vinculada',fk_turma_trilha:'Atribuição de trilha vinculada',fk_termo:'Termo vinculado',fk_radical:'Elemento vinculado',fk_colecao:'Coleção vinculada',fk_sessao:'Sessão vinculada',fk_avaliacao:'Avaliação vinculada',pontuacao:'Pontuação',xp:'XP',data_ingresso:'Data de ingresso',data_conclusao:'Data de conclusão',acertou:'Acertou',correto:'Resposta correta',corretas:'Respostas corretas',respondida:'Questão respondida',jogado:'Já praticado',total:'Total de questões',finalizada_em:'Finalizada em',device:'Dispositivo informado',last_used:'Último uso',expires_at:'Expira em',current:'Este acesso',legal_version:'Versão atual dos documentos',accepted:'Aceite da versão atual',accepted_at:'Data do aceite',legal_ready:'Documentos publicados',terms_version:'Versão dos termos',termos_versao:'Versão dos termos',privacidade_versao:'Versão da política de privacidade',aceito_em:'Aceito em',tipo:'Tipo',type:'Tipo',status:'Situação',detalhes:'Detalhes',details:'Detalhes',resposta:'Resposta registrada',response:'Resposta da equipe',respondido_em:'Respondido em',solicitado_em:'Solicitado em',arquivada_em:'Arquivada em',arquivado_em:'Arquivado em',descricao:'Descrição',definicao:'Definição',area:'Área',codigo:'Código',matriculas_abertas:'Matrículas abertas',revisao:'Revisão',ordem:'Ordem',jogo:'Jogo',source_type:'Origem do conteúdo',source_id:'Identificador da origem',nota_minima:'Nota mínima',aprovada:'Aprovada',posicao:'Posição',answer:'Resposta enviada',acertos:'Acertos',tentativas:'Tentativas',novo_flashcard:'Novo flashcard',desvinculada_em:'Desvinculada em',janela_versao:'Versão da janela',concluida_em:'Concluída em'};
 const forbidden=key=>/password|senha|token|secret|credential|credencial|hash|resposta_esperada|^payload$/i.test(key);
 const label=key=>labels[key]||names[key]||String(key).replace(/^lise_/,'').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
 const date=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)+' (Brasília)';};
 const text=(value,key='')=>{
  if(value===null||value===undefined)return 'Não informado';if(value===true)return 'Sim';if(value===false)return 'Não';if(value==='')return 'Campo vazio';
  if(typeof value==='string'&&/(_em|_at|^data_|last_used|expires_at)$/.test(key)&&/^\d{4}-\d{2}-\d{2}/.test(value))return date(value);
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 };
 function flatten(value,prefix='',out=[]){
  if(value&&typeof value==='object'){
   const entries=Object.entries(value).filter(([k])=>!forbidden(k));
   if(!entries.length)out.push([prefix||'Dados','Nenhum item']);
   for(const [key,v] of entries){const part=Array.isArray(value)?`Item ${Number(key)+1}`:label(key);const title=prefix?prefix+' / '+part:part;if(v&&typeof v==='object')flatten(v,title,out);else out.push([title,text(v,key)]);}
  }else out.push([prefix||'Valor',text(value)]);
  return out;
 }
 let fontPromise;
 const base64=bytes=>{let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);};
 function fonts(){if(!fontPromise)fontPromise=Promise.all(['DejaVuSans.ttf','DejaVuSans-Bold.ttf'].map(async name=>{const response=await fetch('/assets/pdf-fonts/'+name);if(!response.ok)throw new Error('Não foi possível carregar as fontes do relatório. Tente novamente.');return base64(new Uint8Array(await response.arrayBuffer()));})).catch(e=>{fontPromise=null;throw e;});return fontPromise;}
 async function build(data,options={}){
  if(!data||typeof data!=='object'||Array.isArray(data)||!data.conta||typeof data.conta!=='object'||Array.isArray(data.conta))throw new Error('Não foi possível obter os dados da conta para o relatório.');
  const PDF=window.jspdf?.jsPDF;if(!PDF)throw new Error('O gerador de PDF não carregou. Atualize a página e tente novamente.');
  const fontData=options.fontData||await fonts();
  const doc=new PDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  doc.addFileToVFS('LISE-Regular.ttf',fontData[0]);doc.addFont('LISE-Regular.ttf','LISE','normal');doc.addFileToVFS('LISE-Bold.ttf',fontData[1]);doc.addFont('LISE-Bold.ttf','LISE','bold');
  doc.setProperties({title:'LISE - Relatório dos meus dados',subject:'Perfil, segurança, privacidade e registros pessoais',author:'LISE',creator:'LISE - exportação local'});
  const W=210,M=19,BOTTOM=274;let y=23,section='Seus dados',recordContext='';const audit={records:0,fields:0};
  const font=(size=10,bold=false,color='#263e31')=>{doc.setFont('LISE',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);};
  function next(){doc.addPage();font(9,true,'#48644d');doc.text('LISE / '+section+(recordContext?' / '+recordContext:''),M,15);doc.setDrawColor('#d9e3d8');doc.line(M,19,W-M,19);y=28;}
  function ensure(h){if(y+h>BOTTOM)next();}
  function paragraph(value,size=9.5,color='#526557'){
   font(size,false,color);const lines=doc.splitTextToSize(text(value),W-2*M);const lh=size*.48;
   for(const line of lines){ensure(lh);doc.text(line,M,y);y+=lh;}y+=4;
  }
  function heading(title,description){section=title;recordContext='';ensure(27);y+=5;font(17,true);doc.text(title,M,y);y+=10;if(description)paragraph(description);}
  function row(title,value){
   font(8.5,true,'#526557');const left=doc.splitTextToSize(title,49);font(9.5);const right=doc.splitTextToSize(text(value),116);const n=Math.max(left.length,right.length);
   for(let i=0;i<n;i++){ensure(5.2);if(left[i]){font(8.5,true,'#526557');doc.text(left[i],M+2,y);}if(right[i]){font(9.5);doc.text(right[i],M+55,y);}y+=5.2;}
   doc.setDrawColor('#e4eae1');doc.line(M,y-1,W-M,y-1);y+=3;audit.fields++;
  }
  font(11,true,'#48644d');doc.text('LISE / SEUS DADOS',M,y);y+=16;
  font(27,true);doc.text('Seus dados,',M,y);y+=12;doc.text('com clareza.',M,y);y+=11;
  paragraph('Uma cópia explicada das informações que a LISE disponibilizou sobre sua conta. Este relatório reúne perfil, segurança, privacidade e registros de aprendizagem.');
  row('Titular',data.conta.nome||options.user?.name||'Não informado');row('Gerado em',date(data.gerado_em||new Date().toISOString()));
  paragraph('Datas e horários são apresentados no fuso de Brasília. Os dados refletem o momento da consulta e podem mudar com novas atividades. Guarde este arquivo em um local de sua confiança.',9);
  heading('01 / Perfil','Dados de identificação e preferências registrados na aplicação. Campos não preenchidos aparecem como “Não informado”.');
  flatten(data.conta).forEach(([k,v])=>row(k,v));
  heading('02 / Segurança e acessos','Senhas, tokens e credenciais não são apresentados. O relatório não avalia a força da sua senha nem confirma configurações externas do serviço de autenticação.');
  paragraph('Para alterar sua senha ou encerrar acessos, abra Minha conta > Segurança na LISE. O nome do dispositivo é informado pelo navegador e não é uma identificação verificada.');
  if(Array.isArray(options.sessions?.sessions)){const sessions=options.sessions.sessions;row('Acessos ativos identificados',sessions.length);for(const [i,s] of sessions.entries()){ensure(16);font(11,true);doc.text(`Acesso ${i+1}${s.current?' - este dispositivo':''}`,M,y);y+=7;for(const key of ['device','current','last_used','expires_at'])if(key in s)row(label(key),text(s[key],key));}}
  else paragraph('A lista de acessos não pôde ser consultada nesta exportação. Isso não significa que sua conta esteja sem sessões ativas.');
  heading('03 / Privacidade e escolhas','Resumo do aceite dos documentos e dos pedidos sobre seus dados. O relatório é uma cópia informativa; a emissão não altera sua conta nem registra um novo aceite.');
  if(options.account){for(const key of ['legal_version','legal_ready','accepted','accepted_at'])row(label(key),text(options.account[key],key));row('Pedidos de privacidade registrados',options.account.requests?.length??null);}
  else paragraph('O resumo atual de privacidade não pôde ser consultado. Os registros retornados na exportação continuam incluídos nas seções seguintes.');
  paragraph('Você pode consultar os documentos e registrar solicitações em Minha conta > Privacidade. Para entender identificadores de vínculos: “Turma vinculada”, “Termo vinculado” e “Sessão vinculada” indicam referências a outros registros; não representam seus nomes completos.');
  if(data.observacao)paragraph(data.observacao);
  const datasets=Object.entries(data).filter(([key])=>!['conta','gerado_em','observacao'].includes(key)&&!forbidden(key));
  heading('04 / Mapa dos seus registros','Cada linha indica uma categoria disponibilizada pela aplicação. Zero registros significa que a categoria veio vazia nesta consulta.');
  for(const [key,value] of datasets)row(names[key]||label(key),Array.isArray(value)?`${value.length} registro(s)`:'Informação complementar');
  heading('05 / Registros detalhados','Todos os registros retornados estão organizados abaixo, sem limite de quantidade. Textos extensos continuam nas páginas seguintes. Campos confidenciais de autenticação e gabaritos internos são omitidos.');
  for(const [key,value] of datasets){
   heading(names[key]||label(key),explanations[key]);
   if(Array.isArray(value)){
    if(!value.length){paragraph('Nenhum registro disponibilizado nesta categoria.');continue;}
    for(const [i,record] of value.entries()){
     recordContext=`Registro ${i+1} de ${value.length}`;ensure(20);font(10.5,true,'#365c46');doc.text(recordContext,M,y);y+=8;
     flatten(record).forEach(([k,v])=>row(k,v));y+=4;audit.records++;
     if(audit.records%25===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
   }else flatten(value).forEach(([k,v])=>row(k,v));
  }
  const total=doc.getNumberOfPages();for(let i=1;i<=total;i++){doc.setPage(i);doc.setDrawColor('#d9e3d8');doc.line(M,282,W-M,282);font(8,false,'#526557');doc.text('LISE / Cópia pessoal de dados',M,288);doc.text(`${i} / ${total}`,W-M,288,{align:'right'});}
  return {document:doc,audit};
 }
 async function download(data,options={}){
  const result=await build(data,options);const blob=result.document.output('blob');const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='meus-dados-lise.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return result.audit;
 }
 window.LiseDataReport={build,download};
})();
