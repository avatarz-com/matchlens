from pathlib import Path
import json,re,subprocess,hashlib,concurrent.futures,math,datetime,sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import brier_score_loss,log_loss,roc_auc_score
from scipy.optimize import minimize_scalar
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'work/historical-source/raw';CACHE.mkdir(parents=True,exist_ok=True)
(ROOT/'evidence').mkdir(parents=True,exist_ok=True)
def fetch(url):
 r=subprocess.run(['curl','--fail','--silent','--show-error','--retry','2','--max-time','40',url],capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr.decode()[:250])
 return r.stdout
meta=json.loads(fetch('https://api.figshare.com/v2/articles/7770599'));assert meta['license']['name']=='CC BY 4.0'
(ROOT/'data').mkdir(exist_ok=True);(ROOT/'data/matches').mkdir(exist_ok=True)
(ROOT/'data/source-license.json').write_text(json.dumps({'title':meta['title'],'license':meta['license'],'doi':meta.get('doi'),'authors':[x['full_name'] for x in meta['authors']],'url':meta.get('url_public_html')},indent=2))
commit='ebc4c54c1093c420a81ce442c69e4186fab33bb4'
index_path=ROOT/'work/historical-source/index.md'
if not index_path.exists():index_path.write_bytes(fetch('https://raw.githubusercontent.com/koenvo/wyscout-soccer-match-event-dataset/'+commit+'/processed-v2/README.md'))
index=index_path.read_text();records=[]
for line in index.splitlines():
 m=re.match(r'\|\[(\d+)\]\(files/\d+\.json\)\|(.+?)\|(.+?)\|(matches_England|matches_World_Cup)\.json\|',line)
 if m: records.append({'id':int(m[1]),'label':m[2],'dateText':m[3],'competition':'Premier League' if m[4]=='matches_England' else 'World Cup','season':'2017/18' if m[4]=='matches_England' else '2018'})
epl=[r for r in records if r['competition']=='Premier League'];wc=[r for r in records if r['competition']=='World Cup']
featured={2499830,2500045,2499778,2499719,2058017,2058003,2058014,2057960}
selected={r['id']:r for r in wc}
for i in np.linspace(0,len(epl)-1,64).round().astype(int):selected[epl[i]['id']]=epl[i]
for r in records:
 if r['id'] in featured:selected[r['id']]=r
print('Downloading',len(selected),'historical matches from pinned revision',commit[:10],flush=True)
def dl(r):
 p=CACHE/(str(r['id'])+'.json');url=f'https://raw.githubusercontent.com/koenvo/wyscout-soccer-match-event-dataset/{commit}/processed-v2/files/{r["id"]}.json'
 if not p.exists(): p.write_bytes(fetch(url))
 b=p.read_bytes();s=json.loads(b);assert len(s.get('events',[]))>300
 return r,s,hashlib.sha256(b).hexdigest(),url
all_data=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for n,x in enumerate(pool.map(dl,selected.values()),1):
  all_data.append(x)
  if n%20==0:print('Loaded',n,flush=True)
def clean(s):
 # The public source contains doubly escaped names; decode Unicode escapes only.
 return re.sub(r'\\+u([0-9a-fA-F]{4})',lambda m:chr(int(m[1],16)),str(s or ''))
def period_offset(p):return {'1H':0,'2H':45,'E1':90,'E2':105,'P':120}.get(p,0)
PASS_NAMES=['start_x','centrality','cross','high_pass','launch','head_pass','hand_pass','smart_pass']
SHOT_NAMES=['distance_m','opening_radians','header','penalty','direct_free_kick']
def feats(e,kind):
 if e['x'] is None or e['y'] is None:return None
 x=e['x']*1.05;y=e['y']*.68
 if kind=='xPass':return [e['x']/100,abs(e['y']-50)/50,int(e['subtypeId']==80),int(e['subtypeId']==83),int(e['subtypeId']==84),int(e['subtypeId']==82),int(e['subtypeId']==81),int(e['subtypeId']==86)]
 dx=105-x;dy=34-y;angle=abs(math.atan2(3.66-dy,dx)-math.atan2(-3.66-dy,dx));angle=min(angle,2*math.pi-angle)
 return [math.hypot(dx,dy),angle,int(403 in e['tags']),int(e['subtypeId']==35),int(e['subtypeId']==33)]
normalized=[];samples={'xG':[],'xPass':[]}
for rec,s,digest,url in all_data:
 split='test' if rec['id'] in featured else ['train']*7+['calibration']+['test']*2
 if isinstance(split,list):split=split[int(hashlib.sha256(('matchlens-v6:'+str(rec['id'])).encode()).hexdigest()[:8],16)%10]
 teams=[{'id':int(k),'name':clean(v['team']['name'])} for k,v in s['teams'].items()]
 label=clean(rec['label']);m=re.match(r'(.+) - (.+), (\d+) - (\d+)',label);assert m,label
 home=next(t for t in teams if t['name']==m[1]);away=next(t for t in teams if t['name']==m[2])
 players={}
 for tid,ps in s['players'].items():
  for p in ps:
   p=p['player'];players[str(p['wyId'])]={'id':p['wyId'],'name':clean(p['shortName']),'fullName':clean(p['firstName']+' '+p['lastName']),'teamId':int(tid),'role':p.get('role',{}).get('code3','')}
 events=[]
 for e in s['events']:
  tags=[t['id'] for t in e.get('tags',[])];pos=e.get('positions',[]);start=pos[0] if pos else {};end=pos[1] if len(pos)>1 else {};xy=lambda p,k:p.get(k) if isinstance(p.get(k),(int,float)) and 0<=p[k]<=100 else None
  ispass=e['eventId']==8;shot=e['eventId']==10 or e['subEventId'] in [33,35]
  outcome='complete' if 1801 in tags and 1802 not in tags else 'incomplete' if 1802 in tags and 1801 not in tags else None
  if shot:outcome='goal' if 101 in tags else 'no_goal'
  n={'id':str(e['id']),'teamId':e['teamId'],'playerId':e['playerId'],'period':e['matchPeriod'],'seconds':round(e['eventSec'],3),'minute':round(period_offset(e['matchPeriod'])+e['eventSec']/60,3),'type':'pass' if ispass else 'shot' if shot else 'duel' if e['eventId']==1 else 'foul' if e['eventId']==2 else 'set_piece' if e['eventId']==3 else 'other','subtype':e['subEventName'],'subtypeId':int(e['subEventId'] or 0),'x':xy(start,'x'),'y':xy(start,'y'),'endX':xy(end,'x'),'endY':xy(end,'y'),'outcome':outcome,'tags':tags}
  events.append(n)
  if n['period']=='P':continue
  for kind,applies,target in [('xPass',ispass and outcome in ['complete','incomplete'],int(outcome=='complete')),('xG',shot and 102 not in tags,int(101 in tags))]:
   f=feats(n,kind)
   if applies and f is not None:samples[kind].append((f,target,split,rec['id']))
 date=datetime.datetime.strptime(rec['dateText'].split(' at ')[0],'%B %d, %Y').date().isoformat()
 match={**rec,'date':date,'home':home,'away':away,'score':[int(m[3]),int(m[4])],'split':split,'players':players,'events':events,'source':{'name':'Wyscout / Pappalardo et al.','doi':'10.6084/m9.figshare.c.4415000','license':'CC BY 4.0','url':url,'sha256':digest,'transformed':True,'coordinates':'action-executing team always attacks x=100; nominal 105×68 m for distance'}}
 normalized.append(match)
models={};validation={}
for kind,rows in samples.items():
 parts={k:[x for x in rows if x[2]==k] for k in ['train','calibration','test']}
 X=lambda k:np.array([x[0] for x in parts[k]],float);Y=lambda k:np.array([x[1] for x in parts[k]],int)
 scaler=StandardScaler().fit(X('train'));clf=LogisticRegression(C=1,max_iter=1000,random_state=42).fit(scaler.transform(X('train')),Y('train'))
 cal_logits=clf.decision_function(scaler.transform(X('calibration')))
 sig=lambda z:1/(1+np.exp(-np.clip(z,-35,35)))
 temp=minimize_scalar(lambda t:log_loss(Y('calibration'),sig(cal_logits/t),labels=[0,1]),bounds=(.5,3),method='bounded').x
 logits=clf.decision_function(scaler.transform(X('test')));pred=sig(logits/temp);truth=Y('test');prior=float(Y('train').mean());bins=[]
 for lo in np.linspace(0,.9,10):
  mask=(pred>=lo)&(pred<(lo+.1) if lo<.89 else pred<=1)
  if mask.any():bins.append({'lower':round(float(lo),2),'count':int(mask.sum()),'predicted':float(pred[mask].mean()),'observed':float(truth[mask].mean())})
 val={'n':len(truth),'positives':int(truth.sum()),'brier':float(brier_score_loss(truth,pred)),'baselineBrier':float(brier_score_loss(truth,np.full(len(truth),prior))),'logLoss':float(log_loss(truth,pred)),'auc':float(roc_auc_score(truth,pred)),'ece':sum(b['count']*abs(b['predicted']-b['observed']) for b in bins)/len(truth),'bins':bins}
 models[kind]={'id':'matchlens-wyscout-'+kind.lower()+'-v1','features':SHOT_NAMES if kind=='xG' else PASS_NAMES,'weights':clf.coef_[0].tolist(),'intercept':float(clf.intercept_[0]),'mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'temperature':float(temp),'prior':prior,'validation':val,'samples':{k:len(v) for k,v in parts.items()},'matches':{k:sorted({x[3] for x in v}) for k,v in parts.items()},'featureMin':X('train').min(axis=0).tolist(),'featureMax':X('train').max(axis=0).tolist()}
 print(kind,models[kind]['samples'],'Brier',round(val['brier'],4),'baseline',round(val['baselineBrier'],4),flush=True)
pack={'version':1,'dataset':'Wyscout public event data 2016–2018','revision':commit,'license':'CC BY 4.0','method':'Standardized L2 logistic regression; temperature fitted on calibration matches; disjoint match-level holdout','models':models,'limitations':['Research baselines, not professional or production-validated football models.','No player tracking, opponent pressure, intended pass recipient or counterfactual ground truth.','xPass uses origin and pass subtype only; logged end position and success tags are excluded from features.','Distances assume a nominal 105×68 m pitch.','Historical selected competitions only; no live feed.']}
(ROOT/'data/models.json').write_text(json.dumps(pack,separators=(',',':')))
def predict(e,kind):
 f=feats(e,kind)
 if f is None:return None
 model=models[kind];z=model['intercept']+sum(w*(v-mean)/scale for w,v,mean,scale in zip(model['weights'],f,model['mean'],model['scale']));return float(sig(z/model['temperature']))
index=[]
for match in normalized:
 for e in match['events']:
  if e['period']!='P' and e['type'] in ['pass','shot']:e['estimate']=predict(e,'xPass' if e['type']=='pass' else 'xG')
 summary={}
 for t in [match['home'],match['away']]:
  ev=[e for e in match['events'] if e['teamId']==t['id'] and e['period']!='P'];shots=[e for e in ev if e['type']=='shot'];ps=[e for e in ev if e['type']=='pass'];known=[e for e in ps if e['outcome'] is not None]
  summary[str(t['id'])]={'events':len(ev),'shots':len(shots),'xG':sum(e['estimate'] or 0 for e in shots),'passes':len(ps),'knownPasses':len(known),'completed':sum(e['outcome']=='complete' for e in known)}
 match['summary']=summary
 (ROOT/f'data/matches/{match["id"]}.json').write_text(json.dumps(match,ensure_ascii=False,separators=(',',':')))
 index.append({k:v for k,v in match.items() if k not in ['players','events','source']}|{'eventCount':len(match['events'])})
index.sort(key=lambda m:(m['id'] not in featured,m['date']),reverse=False)
(ROOT/'data/index.json').write_text(json.dumps({'version':1,'defaultMatchId':2499830,'matches':index,'counts':{'matches':len(index),'events':sum(m['eventCount'] for m in index),'shots':len(samples['xG']),'passes':len(samples['xPass'])},'source':{'name':'Wyscout public event data — Pappalardo & Massucco (2019)','doi':'https://doi.org/10.6084/m9.figshare.c.4415000','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','revision':commit,'processedRepository':'https://github.com/koenvo/wyscout-soccer-match-event-dataset','changes':'Selected, normalized and enriched with independently trained MatchLens research estimates; player metadata reduced to names, roles and IDs.'}},ensure_ascii=False,separators=(',',':')))
(ROOT/'evidence/v6-model-validation.json').write_text(json.dumps(pack,indent=2))
print('DONE',len(index),'matches',sum(m['eventCount'] for m in index),'events',flush=True)
