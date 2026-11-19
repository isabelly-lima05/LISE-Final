/* Pronunciation uses the browser's speech engine and never starts automatically. */
(() => {
 'use strict';
 const synth=window.speechSynthesis;
 const available=!!(synth&&window.SpeechSynthesisUtterance);
 let voices=[],active=null;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const soundIcon=stopping=>stopping?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
 function refresh(){try{voices=synth?.getVoices?.()||[];}catch(_){voices=[];}}
 function notify(message){window.LiseInteractions?.notify(message,'error');}
 function restore(item){if(!item)return;const b=item.button;if(b?.isConnected){b.innerHTML=item.html;b.classList.remove('is-speaking');b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`Ouvir a palavra ${item.word}`);window.LiseInteractions?.icons();}}
 function stop(){const old=active;active=null;if(available&&old){try{synth.cancel();}catch(_){}}restore(old);}
 function speak(word,button){
  if(!available){notify('Este navegador não oferece leitura em voz alta. Tente em outro navegador ou dispositivo.');return false;}
  word=String(word??'').trim();if(!word)return false;
  if(active?.button===button){stop();return false;}
  stop();refresh();
  const utterance=new window.SpeechSynthesisUtterance(word);
  const selected=voices.find(v=>/^pt[-_]BR$/i.test(v.lang)&&v.localService)||voices.find(v=>/^pt[-_]BR$/i.test(v.lang))||voices.find(v=>/^pt([_-]|$)/i.test(v.lang));
  utterance.lang=selected?.lang||'pt-BR';if(selected)utterance.voice=selected;
  utterance.rate=.86;utterance.pitch=1;utterance.volume=1;
  const item={button,word,utterance,html:button?.innerHTML||''};active=item;
  if(button){button.classList.add('is-speaking');button.setAttribute('aria-pressed','true');button.setAttribute('aria-label',`Parar leitura da palavra ${word}`);button.innerHTML=soundIcon(true);}
  const finish=()=>{if(active===item){active=null;restore(item);}};
  utterance.onend=finish;
  utterance.onerror=e=>{if(active!==item)return;finish();if(!['canceled','interrupted'].includes(e.error))notify('Não foi possível reproduzir a palavra. Confira o áudio do dispositivo e a disponibilidade de uma voz em português.');};
  try{synth.speak(utterance);return true;}catch(_){finish();notify('Não foi possível iniciar a leitura neste dispositivo.');return false;}
 }
 window.LiseSpeech={speak,stop,available,button:word=>`<button type="button" class="pronounce-button" data-speech-text="${esc(word)}" aria-label="Ouvir a palavra ${esc(word)}" title="Ouvir palavra" aria-pressed="false">${soundIcon(false)}</button>`};
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-speech-text]');if(b){event.preventDefault();speak(b.dataset.speechText,b);}});
 window.addEventListener('pagehide',stop);window.addEventListener('hashchange',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 synth?.addEventListener?.('voiceschanged',refresh);refresh();
})();
