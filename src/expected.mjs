import { distance,segmentDistance } from './engine.mjs';
import { comparison } from './experience.mjs';
import { predict } from './model-math.mjs';
import { DEMO_MODELS } from './demo-model.mjs';
export { DEMO_MODELS };
const clip=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function goalGeometry(point,attackDirection=1){
  const goalX=attackDirection===1?105:0,a={x:goalX-point.x,y:30.34-point.y},b={x:goalX-point.x,y:37.66-point.y};
  const divisor=Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y);
  return{goal:{x:goalX,y:34},distanceM:distance(point,{x:goalX,y:34}),openingRadians:divisor?Math.acos(clip((a.x*b.x+a.y*b.y)/divisor,-1,1)):null};
}
export function estimateOptions(snapshot){
  return comparison(snapshot).map(row=>{
    if(!row.available)return{...row,xPass:null,xG:null,sequence:null};
    const missing=[...new Set([...row.lane.missing,...snapshot.pressure.missing])],target=row.distance.inputs.target;
    const opponents=row.lane.inputs.opponentPositions??{};
    const geometry=target?goalGeometry(target,row.progression.inputs.attackDirection):null;
    const shotBlockers=geometry?Object.entries(opponents).filter(([,pos])=>{const p=segmentDistance(pos,target,geometry.goal);return p.fraction>0&&p.fraction<1&&p.distanceM<=2;}).map(([id])=>id):[];
    if(!geometry||geometry.openingRadians===null)missing.push('shot geometry');
    const sources=[...new Set([...row.distance.sources,...row.progression.sources,...row.lane.sources,...snapshot.pressure.sources])];
    const base={asOfMs:snapshot.asOfMs,sources,missing,domain:'synthetic demonstration only',status:missing.length?'unavailable':'available',calibration:'Validated only against a fictional generator; not calibrated on football matches.'};
    const passVector=missing.length?null:[1,row.distance.value/40,Math.max(0,row.progression.value)/40,clip(row.lane.inputs.blockers.length,0,3),row.clearance.value/15,clip(snapshot.pressure.value,0,3)/3];
    const shotVector=missing.length?null:[1,geometry.distanceM/25,geometry.openingRadians/1.2,clip(shotBlockers.length,0,3),row.clearance.value/15];
    const xPass={...base,value:passVector?predict(DEMO_MODELS.models.xPass,passVector):null,unit:'probability',kind:'synthetic-model-estimate',modelId:DEMO_MODELS.models.xPass.id,formula:'sigmoid(dot(weights, normalized pass features) / temperature)',inputs:{featureNames:DEMO_MODELS.models.xPass.featureNames,features:passVector,origin:row.distance.inputs.origin,target,blockers:row.lane.inputs.blockers,receiverClearanceM:row.clearance.value,passerPressureCount:snapshot.pressure.value},assumption:'Attempt a ground pass to the receiver at the decision snapshot.'};
    const xG={...base,value:shotVector?predict(DEMO_MODELS.models.xG,shotVector):null,unit:'expected goals per hypothetical shot',kind:'synthetic-model-estimate',modelId:DEMO_MODELS.models.xG.id,formula:'sigmoid(dot(weights, normalized shot features) / temperature)',inputs:{featureNames:DEMO_MODELS.models.xG.featureNames,features:shotVector,target,geometry,shotBlockers,receiverClearanceM:row.clearance.value},assumption:'Receiver attempts an immediate foot shot from their decision-time position; no actual shot is asserted.'};
    const sequence={...base,value:missing.length?null:xPass.value*xG.value,unit:'illustrative expected goals per pass-then-shot',kind:'derived-synthetic-estimate',modelId:'conditional-product-v1',formula:'xPass × xG_given_successful_pass_and_immediate_shot',inputs:{xPass:xPass.value,xG:xG.value},assumption:'Always shoot immediately if the pass is completed; ignores dribbles, later passes and defensive adaptation.'};
    return{...row,xPass,xG,sequence};
  });
}
export function reviewNarrative(moment,rows,selected,audience='fan'){
  const played=rows.find(o=>o.receiverId===moment.receiver),choice=rows.find(o=>o.receiverId===selected);
  if(!choice?.xPass||choice.xPass.value===null)return{title:'One missing position. No invented certainty.',text:'Known distances stay visible. xPass, xG and any ranking are withheld because a required position is missing.',best:null};
  const available=rows.filter(o=>o.sequence?.value!=null),best=available.reduce((a,b)=>a.sequence.value>b.sequence.value?a:b);
  const delta=choice.sequence.value-played.sequence.value;
  if(audience==='analyst')return{title:selected===moment.receiver?'Assess the decision, not just the outcome.':'Compare the trade-off at the same cutoff.',text:`At 6,000 ms: ${choice.distance.value.toFixed(1)} m pass, ${choice.progression.value>=0?'+':''}${choice.progression.value.toFixed(1)} m progress, ${choice.lane.inputs.blockers.length} static lane blocker(s), ${choice.clearance.value.toFixed(1)} m minimum receiver clearance. Demo xPass ${(choice.xPass.value*100).toFixed(1)}%; hypothetical-shot xG ${choice.xG.value.toFixed(3)}. Pass → shot changes ${delta>=0?'+':''}${delta.toFixed(3)} versus the recorded choice. Static features; no real-match calibration or causal claim.`,best:best.receiverId};
  if(selected===moment.receiver)return{title:moment.resultKind==='intercepted'?'The ambition was there. The lane wasn’t.':'The space was there. So was the pass.',text:`We know how it ended. ${played.lane.value==='obstructed'?'An opponent occupied the lane when Nino made his decision.':'The passing lane was open at the decision.'} The demo model compares potential before the action. One interception alone does not prove a poor decision.`,best:best.receiverId};
  return{title:delta>0?'A different route. A new possibility.':'A different pass. A different trade-off.',text:`This option ${choice.progression.value>=0?'gains':'gives back'} ${Math.abs(choice.progression.value).toFixed(1)} metres. ${choice.lane.value==='obstructed'?'Its static lane is still congested.':'Its static lane is more open.'} The alternative continuation and outcome are authored illustrations, not predictions.`,best:best.receiverId};
}
