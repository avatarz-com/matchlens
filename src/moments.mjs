import { createScene } from './scene.mjs';
export const MOMENTS=Object.freeze({
  trap:{id:'trap',minute:'42:18',title:'The pass through the middle',short:'The intercepted pass',receiver:'A3',scenario:'trap',result:'Pass intercepted',resultKind:'intercepted',description:'Nino tried to find Sami through the middle. Coral cut out the pass.'},
  switch:{id:'switch',minute:'67:42',title:'The window on the wing',short:'The wide release',receiver:'A2',scenario:'switch',result:'Pass completed',resultKind:'completed',description:'Nino switched wide to Leo. The pass reached its target.'},
  delayed:{id:'delayed',minute:'81:05',title:'The decision under pressure',short:'Under pressure',receiver:'A3',scenario:'delayed',result:'Pass intercepted',resultKind:'intercepted',description:'The outcome is known after the action; its delayed availability remains traceable.'},
  missing:{id:'missing',minute:'89:12',title:'The missing piece',short:'Missing position',receiver:'A3',scenario:'missing',result:'Pass intercepted',resultKind:'intercepted',description:'One position is missing at the decision. Model estimates remain unavailable.'}
});
export const PEOPLE=Object.freeze({A1:{name:'Nino',number:8},A2:{name:'Leo',number:11,action:'Find the wide option',color:'blue'},A3:{name:'Sami',number:9,action:'Break the central line',color:'purple'},A4:{name:'Noah',number:6,action:'Recycle and support',color:'orange'}});
export function createMoment(id='trap',receiverId=null){
  const moment=MOMENTS[id];if(!moment)throw new Error('Unknown moment');
  const transform=p=>p?{x:Math.min(104,(id==='switch'?45:id==='delayed'?55:50)+p.x*(id==='switch'?.60:id==='delayed'?.48:.57)),y:34+(p.y-34)*.8*(id==='switch'?-1:1)}:p;
  const chosen=receiverId??moment.receiver,scene=createScene(moment.scenario,42,chosen);
  for(const frame of scene.frames){frame.positions=Object.fromEntries(Object.entries(frame.positions).map(([key,p])=>[key,transform(p)]));frame.ball=transform(frame.ball);}
  for(const event of scene.events)for(const key of ['from','target','position'])if(event[key])event[key]=transform(event[key]);
  const isAlternative=chosen!==moment.receiver;
  // A hypothetical direct shot is an authored continuation, never a measured match fact.
  // It does not affect the pre-action feature packet or the recorded scene.
  if(isAlternative&&chosen!=='A3'){
    const shotStartMs=9600,endMs=11600,startFrame=scene.frames.find(f=>f.tMs===shotStartMs),from=startFrame.positions[chosen],target={x:104.5,y:chosen==='A2'?34:40.5};
    for(const frame of scene.frames)if(frame.tMs>=shotStartMs){const k=Math.min(1,(frame.tMs-shotStartMs)/(endMs-shotStartMs));frame.ball={x:from.x+(target.x-from.x)*k,y:from.y+(target.y-from.y)*k};frame.ballHeightM=.18+Math.sin(k*Math.PI)*1.4;}
    scene.events.push({id:'hypothetical-shot-release',type:'neutral',tMs:shotStartMs,availableAtMs:shotStartMs,reason:'hypothetical-shot-flight'});
    scene.hypotheticalShot={fromMs:shotStartMs,toMs:endMs,from,target,kind:'authored-counterfactual',result:chosen==='A2'?'illustrative-goal':'illustrative-wide'};
  }
  scene.id=`matchlens-retrospective-${id}`;scene.moment={...moment};scene.replayKind=isAlternative?'hypothetical':'recorded-synthetic';
  scene.limitations.push('The shot in an alternative is illustrative, not a prediction or a real match result.');
  return scene;
}
