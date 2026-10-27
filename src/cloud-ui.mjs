import{showDemoAccessNotice}from'./demo-access.mjs';
// Optional cloud enhancement. No model request occurs until the user clicks.
export async function initCloudUI(getRequest){
 const access=document.getElementById('demo-access-open');if(access)access.onclick=()=>{document.getElementById('about-dialog')?.close();showDemoAccessNotice();};
 let health;try{const r=await fetch('/api/health',{signal:AbortSignal.timeout(12000)});if(!r.ok)return;health=await r.json();if(health.enabled!==true)return;}catch{return;}
 document.getElementById('home-cloud-status')?.replaceChildren(document.createTextNode('CONNECTED DEMO'));
 document.getElementById('home-cloud-note')?.replaceChildren(document.createTextNode('Foundry + Functions + private Storage · Connected for this demo. AI Search and additional agent workflows remain future extensions.'));
 document.getElementById('about-cloud-status')?.replaceChildren(document.createTextNode('Connected demo'));
 const status=document.querySelector('.ml-local-status');if(status)status.innerHTML='<i></i> Microsoft AI available';
 for(const [source,id]of[['historical','intelligence-card'],['synthetic','view-studio']]){
  const parent=document.getElementById(id);if(!parent)continue;
  const card=document.createElement('section');card.className='ml-cloud-card';card.setAttribute('aria-label','Microsoft AI explanation');
  const eyebrow=document.createElement('span');eyebrow.className='ml-cloud-eyebrow';eyebrow.textContent='MICROSOFT FOUNDRY';
  const title=document.createElement('h3');title.textContent=source==='synthetic'?'Understand this decision.':'A clearer reading of the evidence.';
  const intro=document.createElement('p');intro.textContent=source==='synthetic'?'Ask AI to explain the current fictional scene using the facts available at this moment.':'Ask a match question above, then get an AI interpretation of its calculated answer.';
  const button=document.createElement('button');button.type='button';button.className='ml-button ml-button-dark';button.textContent='Explain with Microsoft AI ↗';
  const result=document.createElement('div');result.className='ml-cloud-result';result.setAttribute('aria-live','polite');
  card.append(eyebrow,title,intro,button,result);parent.append(card);
  button.addEventListener('click',async()=>{
   let request;try{request=getRequest(source);if(!request)throw new Error(source==='historical'?'Ask a supported question about a bundled historical match first.':'Open a synthetic replay scene first.');}catch(e){result.textContent=e.message;return;}
   const identity=JSON.stringify(request);button.disabled=true;result.textContent='Finding the evidence and preparing an explanation…';
   try{
    const r=await fetch('/api/insight',{method:'POST',headers:{'Content-Type':'application/json'},body:identity,signal:AbortSignal.timeout(45000)}),data=await r.json();
    const current=getRequest(source,false);if(!current||JSON.stringify(current)!==identity){result.textContent='The selection changed. Request a new explanation for the current view.';return;}
    if(data.code==='demo_allowance_exhausted')showDemoAccessNotice({exhausted:true});
    if(!data.narrative)throw new Error(data.error??'The cloud explanation is temporarily unavailable.');
    // Never replace the displayed local statistics or replay snapshot with model output.
    result.replaceChildren();
    const label=document.createElement('small');label.textContent=data.provider==='microsoft-foundry'?'AI interpretation · Microsoft Foundry'+(data.cached?' · cached':''):data.code==='demo_allowance_exhausted'?'Local explanation · AI demo allowance reached':'Local explanation · cloud unavailable or evidence checks not passed';
    const h=document.createElement('h4');h.textContent=data.narrative.title;
    const text=document.createElement('p');text.textContent=data.narrative.explanation;
    const limit=document.createElement('p');limit.className='ml-cloud-limitation';limit.textContent=data.narrative.limitation;
    const scope=document.createElement('small');scope.textContent=data.facts.source==='synthetic'?`Fictional replay · ${request.momentId} · cutoff ${(request.timeMs/1000).toFixed(1)} s · ${request.mode} view`:`Historical match ${request.matchId} · ${data.facts.scope?.label??request.period} · ${request.mode} view`;
    const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect the evidence';pre.textContent=JSON.stringify(data.facts,null,2);details.append(summary,pre);
    result.append(label,h,text,limit,scope,details);
   }catch{result.textContent='Microsoft AI could not respond. The local calculations and explanations remain available.';}
   finally{button.disabled=false;}
  });
 }
}
