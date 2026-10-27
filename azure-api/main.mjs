import{app}from'@azure/functions';
import{DefaultAzureCredential}from'@azure/identity';
import{BlobServiceClient}from'@azure/storage-blob';
import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{normalizeCloudRequest,syntheticCloudFacts,historicalCloudFacts,narrativeSchema,NARRATIVE_INSTRUCTIONS,validateNarrative,deterministicCloudFallback}from'../src/cloud-facts.mjs';
import{reserveInference,inferenceReservation}from'./budget.mjs';
const credential=new DefaultAzureCredential(),model=process.env.FOUNDRY_DEPLOYMENT??'matchlens-explainer';
let service;
function container(){
 const name=process.env.MATCHLENS_STORAGE_ACCOUNT;if(!/^[a-z0-9]{3,24}$/.test(name??''))throw new Error('Storage is not configured');
 service??=new BlobServiceClient(`https://${name}.blob.core.windows.net`,credential,{retryOptions:{maxTries:2}});
 return service.getContainerClient('matchlens-ai');
}
async function readBlob(blob){try{const r=await blob.download();const chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));return{value:JSON.parse(Buffer.concat(chunks).toString('utf8')),etag:r.etag};}catch(e){if(e.statusCode===404)return null;throw e;}}
function budgetStore(c){const b=c.getBlockBlobClient('sprint-budget.json');return{read:()=>readBlob(b),async write(value,etag){const body=JSON.stringify(value);try{await b.upload(body,Buffer.byteLength(body),{conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:'application/json'}});return true;}catch(e){if([409,412].includes(e.statusCode))return false;throw e;}}};}
function headers(request){const origin=request.headers.get('origin'),allowed=(process.env.MATCHLENS_ALLOWED_ORIGINS??'http://127.0.0.1:4317,http://localhost:4317').split(',').map(x=>x.trim());return{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{})};}
function json(request,status,body){return{status,headers:headers(request),jsonBody:body};}
async function factsFor(r){
 if(r.source==='synthetic')return syntheticCloudFacts(r);
 let match;try{match=JSON.parse(await readFile(new URL(`../data/matches/${r.matchId}.json`,import.meta.url),'utf8'));}catch{throw new Error('Historical match is not part of this deployment');}
 return historicalCloudFacts(r,match);
}
async function insight(request,context){
 if(request.method==='OPTIONS')return{status:204,headers:headers(request)};
 if(process.env.MATCHLENS_AI_ENABLED!=='true')return json(request,503,{error:'Microsoft AI is not enabled for this deployment.'});
 const length=Number(request.headers.get('content-length')??0);if(length>4096)return json(request,413,{error:'Request too large'});
 let r,facts;try{const raw=await request.text();if(Buffer.byteLength(raw)>4096)return json(request,413,{error:'Request too large'});r=normalizeCloudRequest(JSON.parse(raw));facts=await factsFor(r);}catch(e){return json(request,400,{error:e.message});}
 const fallback=deterministicCloudFallback(facts);
 const payload={model,store:false,instructions:NARRATIVE_INSTRUCTIONS,input:JSON.stringify({FACTS:facts}),max_output_tokens:1024,reasoning:{effort:'minimal'},text:{format:{type:'json_schema',name:'matchlens_explanation',strict:true,schema:narrativeSchema(facts)}}};
 let costMicroUsd;try{costMicroUsd=inferenceReservation(payload);}catch{return json(request,200,{provider:'local',narrative:fallback,facts,reason:'Fact pack exceeds the cloud demo allowance.'});}
 if(facts.supported===false)return json(request,200,{provider:'local',narrative:fallback,facts,reason:'Question outside supported statistics'});
 let c,cache,slot;const factId=createHash('sha256').update(JSON.stringify({model,instructions:NARRATIVE_INSTRUCTIONS,facts})).digest('hex');
 try{
  c=container();await c.createIfNotExists();cache=c.getBlockBlobClient('responses/'+factId+'.json');const previous=await readBlob(cache);
  if(previous)return json(request,200,{...previous.value,cached:true,remainingInferences:null});
  slot=await reserveInference(budgetStore(c),{limit:250,costMicroUsd});
  if(!slot)return json(request,429,{error:'The AI demo allowance has been reached.',code:'demo_allowance_exhausted',provider:'local',narrative:fallback,facts});
 }catch{context.warn('AI budget store unavailable; no inference attempted.');return json(request,503,{error:'AI usage control is temporarily unavailable.',provider:'local',narrative:fallback,facts});}
 const start=Date.now();let result,phase='configuration',httpStatus=null;
 try{
  const endpoint=new URL(process.env.FOUNDRY_ENDPOINT??'');
  if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.openai.azure.com')||endpoint.username||endpoint.password)throw new Error('Invalid configured endpoint');
  endpoint.pathname='/openai/v1/responses';endpoint.search='';endpoint.hash='';
  phase='identity';const token=await credential.getToken('https://cognitiveservices.azure.com/.default');
  phase='model-request';const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token.token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
  httpStatus=response.status;if(!response.ok)throw new Error('Model request failed');
  phase='response';const body=await response.json();if(body.status!=='completed')throw new Error('Incomplete model response');
  const text=body.output?.filter(x=>x.type==='message').flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join('')??'';
  phase='evidence-check';const narrative=validateNarrative(JSON.parse(text),facts);
  result={provider:'microsoft-foundry',model,narrative,facts,factId,latencyMs:Date.now()-start,usage:{inputTokens:body.usage?.input_tokens??null,outputTokens:body.usage?.output_tokens??null},remainingInferences:slot.remaining,generatedAt:new Date().toISOString()};
 }catch(e){const allowed=['Invalid narrative shape','Invalid narrative text','Unsupported evidence reference','Missing evidence reference','Unsupported numeric claim','Future outcome asserted'];const validationCode=phase==='evidence-check'&&allowed.includes(e.message)?e.message:null;context.warn(JSON.stringify({event:'matchlens-cloud-fallback',phase,httpStatus,validationCode}));result={provider:'local',narrative:fallback,facts,factId,reason:'The cloud response was unavailable or failed evidence checks.',remainingInferences:slot.remaining};}
 context.log(JSON.stringify({event:'matchlens-insight',provider:result.provider,source:r.source,slot:slot.slot,latencyMs:Date.now()-start,usage:result.usage??null}));
 if(result.provider==='microsoft-foundry')try{const b=JSON.stringify(result);await cache.upload(b,Buffer.byteLength(b),{blobHTTPHeaders:{blobContentType:'application/json'}});}catch{context.warn('AI response cache write failed.');}
 return json(request,200,result);
}
app.http('insight',{route:'insight',methods:['POST','OPTIONS'],authLevel:'anonymous',handler:insight});
app.http('health',{route:'health',methods:['GET'],authLevel:'anonymous',handler:async request=>json(request,200,{service:'MatchLens Azure API',enabled:process.env.MATCHLENS_AI_ENABLED==='true',provider:'microsoft-foundry',model,sourceTypes:['synthetic','historical'],inferenceAllowance:250,planningBudgetUsd:5})});
