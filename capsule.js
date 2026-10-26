window.FUTURE_LETTER = {
 title:'Письмо, которому предстоит подождать',
 paragraphs:[
  'Полагаю, теперь Вы уже догадались, кто скрывается за моими весьма скромными инициалами.',
  'За время работы над мемуарами я успел убедиться в одном: человеческая память — вещь удивительно ненадёжная.',
  'Вы забываете счастливые мелочи, важные слова и даже то, куда положили собственные вещи. Последнее, признаться, вызывает у меня особенное недоумение.',
  'Поэтому предлагаю сохранить кое-что действительно важное.',
  'Напишите письмо себе. Той, которой Вы станете ровно через год.',
  'Расскажите ей о том, что делает Вас счастливой сегодня, о чём мечтаете и что непременно хотите ей напомнить.',
  'Я позабочусь о том, чтобы письмо дождалось своего часа.',
  'С неизменным почтением,','Господин Б.'
 ],signatureParagraphs:[7,8]
};
window.createFutureCapsule = ({config,state,persist,isOpen,onAvailable,onOpenChapter}) => {
 const $=id=>document.getElementById(id),draftKey=config.STORAGE_KEY+'-capsule-draft';
 let submitting=false,checking=false,timer=null,widget=null,challenge='',loadPromise=null,announced=false;
 let draftStorageAvailable=true;
 let base='';try{const u=new URL(config.CAPSULE_API_URL);if(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))base=u.href.replace(/\/$/,'');}catch{}
 function saveDraft(){
  if(state.future_letter_saved||state.deleted)return;
  const draft=JSON.stringify({text:$('capsule-text').value,email:$('capsule-email').value});
  try{sessionStorage.setItem(draftKey,draft);if($('capsule-local').checked)localStorage.setItem(draftKey,draft);else localStorage.removeItem(draftKey);}catch{draftStorageAvailable=false;}
 }
 try{const local=localStorage.getItem(draftKey);const d=JSON.parse(sessionStorage.getItem(draftKey)||local||'null');if(d){$('capsule-text').value=d.text||'';$('capsule-email').value=d.email||'';$('capsule-local').checked=!!local;}}catch{}
 function clearDraft(){try{localStorage.removeItem(draftKey);sessionStorage.removeItem(draftKey);}catch{}$('capsule-text').value='';$('capsule-email').value='';}
 async function api(path,data){
  if(!base)throw new Error('not_configured');
  const r=await fetch(base+path,{method:'POST',credentials:'omit',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  const d=await r.json();if(!r.ok)throw new Error(d.code||'unavailable');return d;
 }
 function credentials(){
  if(!state.receiptToken){state.receiptToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>String.fromCharCode(b)).join('');state.receiptToken=btoa(state.receiptToken).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');state.letterId=crypto.randomUUID();persist();}
  return {token:state.receiptToken,id:state.letterId};
 }
 function accept(data){
  if(data.saved===true||data.deleted===true){state.future_letter_saved=data.saved===true;state.deleted=data.deleted===true;state.status=data.status;clearDraft();}
  // Availability is accepted only from an authenticated receipt response, never Date.now().
  if((data.saved||data.deleted)&&data.chapter4Available===true){state.chapter4_available=true;}
  persist();render();if(state.chapter4_available&&!announced){announced=true;onAvailable();}
 }
 function schedule(){clearTimeout(timer);if(isOpen()&&!document.hidden&&base&&(state.future_letter_saved||state.deleted))timer=setTimeout(refresh,60000);}
 async function refresh(){
  if(checking||submitting||!isOpen()||document.hidden||!state.receiptToken)return;
  checking=true;try{accept(await api('/receipt',{token:state.receiptToken}));$('capsule-error').textContent='';}
  catch(e){if(e.message!=='not_found')$('capsule-error').textContent='Сейчас не удаётся получить вести. Ваше письмо остаётся на своём месте. Попробуйте немного позже.';}
  finally{checking=false;schedule();}
 }
 function setupChallenge(){
  if(widget!==null||!config.CAPSULE_TURNSTILE_SITEKEY||state.future_letter_saved||state.deleted)return;
  if(!loadPromise)loadPromise=new Promise((resolve,reject)=>{
   if(window.turnstile){resolve();return;}
   const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=resolve;s.onerror=reject;document.head.append(s);
  });
  loadPromise.then(()=>{if(widget!==null)return;widget=window.turnstile.render('#capsule-verification',{sitekey:config.CAPSULE_TURNSTILE_SITEKEY,action:'capsule',theme:'light',size:'compact',callback:token=>{challenge=token;},'expired-callback':()=>{challenge='';},'error-callback':()=>{challenge='';$('capsule-error').textContent='Проверка пока не завершилась. Попробуйте ещё раз немного позже.';}});}).catch(()=>{loadPromise=null;$('capsule-error').textContent='Не удалось подготовить проверку. Письмо останется здесь; попробуйте позже.';});
 }
 function render(){
  const sealed=state.future_letter_saved||state.deleted;
  $('capsule-page').hidden=!isOpen();
  if(!isOpen()){clearTimeout(timer);return;}
  $('capsule-form').hidden=sealed;$('capsule-sealed').hidden=!sealed;$('capsule-locked').hidden=!sealed;
  $('prose').hidden=sealed;
  $('capsule-confirm-title').textContent=state.deleted?'Письмо удалено':'Письмо запечатано';
  $('capsule-confirm-text').hidden=state.deleted;
  $('capsule-delete').hidden=state.deleted||['sending','sent'].includes(state.status);
  $('capsule-open-chapter').hidden=!state.chapter4_available;
  $('capsule-lock-text').hidden=state.chapter4_available;
  $('capsule-clock').textContent=state.chapter4_available?'Последняя глава уже ждёт Вас.':'28 октября 2026 года, 00:00 · Санкт-Петербург';
  if(!sealed)setupChallenge();schedule();
 }
 $('capsule-text').addEventListener('input',saveDraft);$('capsule-email').addEventListener('input',saveDraft);$('capsule-local').addEventListener('change',saveDraft);
 $('capsule-form').addEventListener('submit',async event=>{
  event.preventDefault();if(submitting||!isOpen())return;
  if(!$('capsule-form').reportValidity()||!$('capsule-text').value.trim())return;
  if(!base||!config.CAPSULE_TURNSTILE_SITEKEY){$('capsule-error').textContent='Хранитель писем ещё готовится принять Ваше послание. Текст сохранён в этой вкладке; попробуйте позже.';saveDraft();return;}
  if(!challenge){$('capsule-error').textContent='Дождитесь завершения проверки под письмом и попробуйте ещё раз.';return;}
  saveDraft();submitting=true;$('capsule-submit').disabled=true;$('capsule-form').setAttribute('aria-busy','true');$('capsule-error').textContent='Бережно укладываем письмо в конверт…';
  $('capsule-text').readOnly=true;$('capsule-email').readOnly=true;$('capsule-consent').disabled=true;
  try{
   const data=await api('/letters',{...credentials(),text:$('capsule-text').value,email:$('capsule-email').value.trim(),consent:$('capsule-consent').checked,consentVersion:'2026-10-26',turnstileToken:challenge});
   if(data.saved!==true)throw new Error('unconfirmed');
   $('capsule-form').classList.add('capsule-folding');
   await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:650));
   accept(data);$('capsule-error').textContent='';$('capsule-sealed').classList.add('just-sealed');$('capsule-confirm-title').setAttribute('tabindex','-1');$('capsule-confirm-title').focus({preventScroll:true});$('capsule-sealed').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }catch{
   $('capsule-error').textContent='Не удалось подтвердить сохранение письма. Написанное осталось в поле — попробуйте ещё раз. Повторная попытка не создаст второе письмо.';
  }finally{submitting=false;$('capsule-submit').disabled=false;$('capsule-form').removeAttribute('aria-busy');$('capsule-form').classList.remove('capsule-folding');$('capsule-text').readOnly=false;$('capsule-email').readOnly=false;$('capsule-consent').disabled=false;challenge='';if(widget!==null)window.turnstile.reset(widget);schedule();}
 });
 $('capsule-refresh').addEventListener('click',refresh);
 $('capsule-open-chapter').addEventListener('click',()=>{if(state.chapter4_available)onOpenChapter();});
 $('capsule-delete').addEventListener('click',()=>{$('capsule-delete-confirm').hidden=false;});
 $('capsule-delete-no').addEventListener('click',()=>{$('capsule-delete-confirm').hidden=true;});
 $('capsule-delete-yes').addEventListener('click',async()=>{
  if(submitting)return;submitting=true;$('capsule-delete-yes').disabled=true;
  try{accept(await api('/delete',{token:state.receiptToken}));$('capsule-delete-confirm').hidden=true;$('capsule-error').textContent='Письмо и адрес удалены из хранилища.';}catch{$('capsule-error').textContent='Удаление пока не подтверждено. Пожалуйста, попробуйте ещё раз; если отправка уже началась, обратитесь к организатору.';}finally{submitting=false;$('capsule-delete-yes').disabled=false;}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else refresh();});window.addEventListener('online',refresh);
 return {render,refresh,suspend(){clearTimeout(timer);},draftStorageAvailable:()=>draftStorageAvailable};
};
