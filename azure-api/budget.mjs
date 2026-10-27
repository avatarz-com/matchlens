// Compare-and-swap reservations are persisted before inference. Storage errors fail closed.
// USD reservations deliberately overestimate gpt-5-mini usage; they are not Azure invoices.
export function inferenceReservation(payload){
 const bytes=Buffer.byteLength(JSON.stringify(payload),'utf8');
 if(bytes>14336)throw new Error('Model fact pack exceeds the demo input allowance');
 // Entire UTF-8 payload as an input-token upper bound, plus overhead;
 // conservative planning rates: $1/M input and $4/M output, max 1,024 output tokens.
 return bytes+1024+1024*4;
}
export async function reserveInference(store,{limit=250,attempts=8,costMicroUsd=20000,budgetMicroUsd=5000000}={}){
 if(!Number.isInteger(limit)||limit<1||limit>250||!Number.isInteger(costMicroUsd)||costMicroUsd<1||costMicroUsd>100000||!Number.isInteger(budgetMicroUsd)||budgetMicroUsd<1||budgetMicroUsd>5000000)throw new Error('Invalid inference allowance');
 for(let i=0;i<attempts;i++){
  const state=await store.read(),used=state?.value?.used??0;
  // Older count-only ledgers are conservatively charged; never reset prior usage.
  const reserved=state?.value?.reservedMicroUsd??used*20000;
  if(!Number.isInteger(used)||used<0||!Number.isInteger(reserved)||reserved<0)throw new Error('Invalid budget state');
  if(used>=limit||reserved+costMicroUsd>budgetMicroUsd)return null;
  const next={version:2,used:used+1,reservedMicroUsd:reserved+costMicroUsd};
  if(await store.write(next,state?.etag??null))return{slot:next.used,remaining:limit-next.used,reservedMicroUsd:next.reservedMicroUsd,remainingMicroUsd:budgetMicroUsd-next.reservedMicroUsd};
 }
 throw new Error('Budget counter is busy');
}
