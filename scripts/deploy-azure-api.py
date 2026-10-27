"""Deploy only the dedicated MatchLens demo backend after explicit budget confirmation.
Uses the current Azure CLI login; never reads or prints model API keys.
"""
from pathlib import Path
import argparse,subprocess,json,hashlib,zipfile
p=argparse.ArgumentParser()
p.add_argument('--subscription',required=True)
p.add_argument('--foundry-group',required=True)
p.add_argument('--foundry-account',required=True)
p.add_argument('--region',default='northeurope')
p.add_argument('--group',default='rg-matchlens-demo')
p.add_argument('--confirm-budget-eur',type=float,required=True)
p.add_argument('--az',default='az')
a=p.parse_args()
if not 0<a.confirm_budget_eur<=10:p.error('This demo script only supports a confirmed sprint budget up to EUR 10.')
root=Path(__file__).resolve().parents[1]
def run(*args,read=False):
 print('Azure:', ' '.join(args[:3]), flush=True)
 cmd=[a.az,*args,'--only-show-errors','--output','json' if read else 'none']
 r=subprocess.run(cmd,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Azure operation failed: '+args[0]+' '+args[1]+'\n'+r.stderr[:1500])
 return json.loads(r.stdout) if read and r.stdout.strip() else None
account=run('account','show',read=True)
if account.get('id')!=a.subscription or account.get('state')!='Enabled':raise RuntimeError('Select the confirmed active subscription with az account set first.')
resource=run('cognitiveservices','account','show','--resource-group',a.foundry_group,'--name',a.foundry_account,'--query','{id:id,endpoint:properties.endpoint}',read=True)
deployment=run('cognitiveservices','account','deployment','show','--resource-group',a.foundry_group,'--name',a.foundry_account,'--deployment-name','matchlens-explainer','--query','{sku:sku.name,capacity:sku.capacity}',read=True)
if deployment.get('sku')!='GlobalStandard' or deployment.get('capacity',999)>5:raise RuntimeError('Expected the reviewed pay-per-use model with quota <= 5,000 TPM.')
suffix=hashlib.sha256(a.subscription.encode()).hexdigest()[:10]
app_name='matchlens-api-'+suffix;storage_name='ml'+suffix+'demo'
print('Deploying dedicated demo:',a.group,app_name,'in',a.region,flush=True)
for namespace in ['Microsoft.Storage','Microsoft.Web','Microsoft.Insights','Microsoft.OperationalInsights']:
 state=run('provider','show','--namespace',namespace,'--query','registrationState',read=True)
 if state!='Registered':run('provider','register','--namespace',namespace,'--wait')
run('group','create','--name',a.group,'--location',a.region,'--tags','project=MatchLens','environment=demo')
run('storage','account','create','--name',storage_name,'--resource-group',a.group,'--location',a.region,'--sku','Standard_LRS','--kind','StorageV2','--min-tls-version','TLS1_2','--allow-blob-public-access','false','--https-only','true')
run('functionapp','create','--resource-group',a.group,'--name',app_name,'--storage-account',storage_name,'--flexconsumption-location',a.region,'--runtime','node','--runtime-version','22','--instance-memory','512','--maximum-instance-count','40','--https-only','true','--assign-identity','[system]','--tags','project=MatchLens','environment=demo')
function=run('resource','show','--resource-group',a.group,'--resource-type','Microsoft.Web/sites','--name',app_name,'--api-version','2024-04-01','--query','{principal:identity.principalId,host:properties.defaultHostName}',read=True)
if not function.get('principal'):raise RuntimeError('Function managed identity not available.')
for role,scope in [('Cognitive Services OpenAI User',resource['id']),('Storage Blob Data Contributor',f'/subscriptions/{a.subscription}/resourceGroups/{a.group}/providers/Microsoft.Storage/storageAccounts/{storage_name}')]:
 existing=run('role','assignment','list','--assignee',function['principal'],'--scope',scope,'--query',"[?roleDefinitionName=='"+role+"'].id",read=True)
 if not existing:run('role','assignment','create','--assignee-object-id',function['principal'],'--assignee-principal-type','ServicePrincipal','--role',role,'--scope',scope)
endpoint='https://'+a.foundry_account+'.openai.azure.com'
run('functionapp','config','appsettings','set','--resource-group',a.group,'--name',app_name,'--settings','MATCHLENS_AI_ENABLED=false','FOUNDRY_ENDPOINT='+endpoint,'FOUNDRY_DEPLOYMENT=matchlens-explainer','MATCHLENS_STORAGE_ACCOUNT='+storage_name,'FUNCTIONS_REQUEST_BODY_SIZE_LIMIT=4096')
subprocess.run(['node','scripts/build-azure-api.mjs'],cwd=root,check=True)
subprocess.run(['npm','ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],cwd=root/'.azure-dist',check=True)
archive=root/'.azure-dist.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for f in (root/'.azure-dist').rglob('*'):
  if f.is_file() and f.name not in ['local.settings.json','.env','.DS_Store']:z.write(f,f.relative_to(root/'.azure-dist'))
run('functionapp','deployment','source','config-zip','--resource-group',a.group,'--name',app_name,'--src',str(archive),'--build-remote','false','--timeout','300')
run('functionapp','config','appsettings','set','--resource-group',a.group,'--name',app_name,'--settings','MATCHLENS_AI_ENABLED=true')
state={'apiBase':'https://'+function['host']+'/api','group':a.group,'app':app_name,'storage':storage_name,'foundryDeployment':'matchlens-explainer','inferenceAllowance':250,'planningBudgetUsd':5,'maximumOutputTokens':1024,'region':a.region,'status':'deployed; end-to-end verification still required'}
(root/'work').mkdir(exist_ok=True);(root/'work/azure-deployment.json').write_text(json.dumps(state,indent=2)+'\n')
print(json.dumps(state,indent=2));print('Role propagation can take time. Verify health and a bounded synthetic request before reporting the API as connected.')
