// Comparisons reuse the actual, fixed-cutoff model outputs. No prose invents a ratio.
export function compareChoices(rows,selectedId,referenceId){
 const selected=rows.find(r=>r.receiverId===selectedId),reference=rows.find(r=>r.receiverId===referenceId);
 const missing=[...new Set([...(selected?.sequence?.missing??[]),...(reference?.sequence?.missing??[])])];
 const usable=r=>r&&['xPass','xG','sequence'].every(k=>Number.isFinite(r[k]?.value)&&r[k].value>=0&&r[k].value<=1&&!r[k].missing?.length&&r[k].asOfMs===r.xPass.asOfMs);
 if(!usable(selected)||!usable(reference)||selected.xPass.asOfMs!==reference.xPass.asOfMs)return{status:'unavailable',selectedId,referenceId,missing:missing.length?missing:['Comparable expected metrics at the same cutoff'],claims:[],asOfMs:selected?.xPass?.asOfMs??null};
 const sources=[...new Set(['xPass','xG','sequence'].flatMap(k=>[...selected[k].sources,...reference[k].sources]))],asOfMs=selected.xPass.asOfMs;
 const pair=k=>({selected:selected[k].value,reference:reference[k].value});
 const claim=(id,value,unit,formula,inputs)=>({id,value,unit,formula,inputs,asOfMs,sources,kind:'derived-synthetic-comparison',missing:[]});
 const claims=[
  claim('passDeltaPp',(selected.xPass.value-reference.xPass.value)*100,'percentage points','100 × (selected xPass − reference xPass)',pair('xPass')),
  claim('shotRatio',reference.xG.value>0?selected.xG.value/reference.xG.value:null,'ratio','selected hypothetical-shot xG / reference hypothetical-shot xG',pair('xG')),
  claim('evDelta',selected.sequence.value-reference.sequence.value,'illustrative expected goals','selected (xPass × xG) − reference (xPass × xG)',pair('sequence')),
  claim('evRatio',reference.sequence.value>0?selected.sequence.value/reference.sequence.value:null,'ratio','selected (xPass × xG) / reference (xPass × xG)',pair('sequence')),
  claim('evChangePct',reference.sequence.value>0?(selected.sequence.value/reference.sequence.value-1)*100:null,'%','100 × (selected illustrative EV / reference illustrative EV − 1)',pair('sequence'))
 ];
 const byId=Object.fromEntries(claims.map(c=>[c.id,c.value]));
 return{status:'available',selectedId,referenceId,asOfMs,sources,missing:[],claims,values:byId,selected:{xPass:selected.xPass.value,xG:selected.xG.value,ev:selected.sequence.value},reference:{xPass:reference.xPass.value,xG:reference.xG.value,ev:reference.sequence.value},assumptions:'Synthetic demo models only. Both options assume a completed pass followed by an immediate shot from the decision-time receiver position. No causal claim or real-match calibration.'};
}
export function rankChoices(rows){const valid=rows.filter(r=>Number.isFinite(r.sequence?.value)&&!r.sequence.missing?.length);if(valid.length!==rows.length||!valid.length||valid.some(r=>r.sequence.asOfMs!==valid[0].sequence.asOfMs))return{status:'unavailable',ids:[],bestId:null};const sorted=[...valid].sort((a,b)=>b.sequence.value-a.sequence.value||a.receiverId.localeCompare(b.receiverId));return{status:'available',ids:sorted.map(r=>r.receiverId),bestId:sorted[0].receiverId,asOfMs:sorted[0].sequence.asOfMs};}
export function comparisonReference(rows,selectedId,playedId){
 if(selectedId!==playedId)return playedId;
 const others=rows.filter(r=>r.receiverId!==selectedId&&Number.isFinite(r.xPass?.value));
 return others.sort((a,b)=>b.xPass.value-a.xPass.value||a.receiverId.localeCompare(b.receiverId))[0]?.receiverId??rows.find(r=>r.receiverId!==selectedId)?.receiverId??null;
}
export function decodeChoice(comparison,names){
 if(comparison.status!=='available')return{title:'Missing data. No verdict.',text:'A required position is missing. The model cannot fairly compare these choices, so the ratios and ranking are withheld.',conclusion:'No expected-value claim is available.'};
 const c=comparison,v=c.values,a=names[c.selectedId]??c.selectedId,b=names[c.referenceId]??c.referenceId,percent=n=>(n*100).toFixed(0)+'%',ratio=n=>n==null?'unavailable':n.toFixed(1)+'×';
 const pass=v.passDeltaPp<-.05?`riskier in the demo (${percent(c.selected.xPass)} completion versus ${percent(c.reference.xPass)})`:v.passDeltaPp>.05?`safer in the demo (${percent(c.selected.xPass)} versus ${percent(c.reference.xPass)})`:'equally likely to complete in the demo';
 const conjunction=v.shotRatio!=null&&v.passDeltaPp*(v.shotRatio-1)<0?'but':'and';
 const shot=v.shotRatio==null?'cannot be expressed as a ratio':v.shotRatio>=1?`${ratio(v.shotRatio)} the hypothetical-shot xG`:`${((1-v.shotRatio)*100).toFixed(0)}% lower hypothetical-shot xG`;
 const title=v.evDelta>1e-9?'More potential, under explicit assumptions.':v.evDelta< -1e-9?'A trade-off, not a free upgrade.':'Different paths. Equal model value.';
 const result=v.evChangePct==null?'The relative change is undefined because the reference value is zero.':`${Math.abs(v.evChangePct).toFixed(0)}% ${v.evDelta>=0?'higher':'lower'} illustrative expected value`;
 return{title,text:`A pass to ${a} is ${pass} than a pass to ${b}, ${conjunction} offers ${shot}. Combining completion and the assumed shot gives ${result}: ${c.selected.ev.toFixed(3)} versus ${c.reference.ev.toFixed(3)}.`,conclusion:'Illustrative EV = xPass × hypothetical-shot xG. It assumes an immediate shot after a successful pass; it does not predict what would actually happen.'};
}
