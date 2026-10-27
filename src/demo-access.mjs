// Contact is optional: no email or personal information is collected by this demo.
export const DEMO_CONTACT_EMAIL='contact@avatarz.com';
export function showDemoAccessNotice({exhausted=false}={}){
 let dialog=document.getElementById('demo-access-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='demo-access-dialog';dialog.className='ml-demo-dialog';dialog.setAttribute('aria-labelledby','demo-access-title');
  const close=document.createElement('button');close.type='button';close.className='dialog-close icon-button';close.setAttribute('aria-label','Close demo access notice');close.textContent='×';close.onclick=()=>dialog.close();
  const kicker=document.createElement('span');kicker.className='ml-kicker';kicker.textContent='MATCHLENS · DEMO ACCESS';
  const title=document.createElement('h2');title.id='demo-access-title';
  const intro=document.createElement('p');intro.id='demo-access-intro';
  const detail=document.createElement('p');detail.className='ml-cloud-limitation';detail.textContent='The match library, statistics, replay tools and cached AI explanations remain available. Judges can request an extension from the AVATARZ team. No payment is required from visitors.';
  const actions=document.createElement('div');actions.className='ml-demo-actions';
  const request=document.createElement(DEMO_CONTACT_EMAIL?'a':'button');request.className='ml-button ml-button-purple';request.textContent='Request a demo extension ↗';
  const message='Hello AVATARZ, I am reviewing MatchLens and would like an extension of the AI demo allowance. Please let me know when access is available. Thank you.';
  const confirmation=document.createElement('small');confirmation.setAttribute('role','status');
  if(DEMO_CONTACT_EMAIL){request.href='mailto:'+DEMO_CONTACT_EMAIL+'?subject='+encodeURIComponent('MatchLens — demo extension request')+'&body='+encodeURIComponent(message);confirmation.textContent='Your email app will open. Review and send the request to AVATARZ.';}
  else{request.type='button';request.onclick=async()=>{try{await navigator.clipboard.writeText(message);confirmation.textContent='Request copied. Send it to the AVATARZ contact included with the submission.';}catch{confirmation.textContent=message;}};confirmation.textContent='Copy a request to send to the AVATARZ contact included with the submission.';}
  const keep=document.createElement('button');keep.type='button';keep.className='ml-button';keep.textContent='Continue exploring';keep.onclick=()=>dialog.close();
  actions.append(request,keep);dialog.append(close,kicker,title,intro,detail,actions,confirmation);document.body.append(dialog);
 }
 dialog.querySelector('#demo-access-title').textContent=exhausted?'More to explore. Let’s extend the demo.':'Need more time with MatchLens?';
 dialog.querySelector('#demo-access-intro').textContent=exhausted?'The shared AI allowance for this demonstration has been reached. New AI generation is paused until the team extends access.':'This demonstration includes 250 shared AI calls. The AVATARZ team can arrange additional access for your review.';
 if(!dialog.open)dialog.showModal();
}
