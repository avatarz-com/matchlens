import{staticHostConfig}from'./static-host-config.mjs';
import{readFile,writeFile,mkdir,rm}from'node:fs/promises';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import path from'node:path';
const project=process.env.MATCHLENS_PROJECT_ROOT??fileURLToPath(new URL('..',import.meta.url)),source=process.env.MATCHLENS_ASSET_ROOT??project,dist=path.join(project,'dist'),manifest=JSON.parse(await readFile(path.join(source,'public-manifest.json'),'utf8'));
for(const[file,expected]of Object.entries(manifest.files)){const bytes=await readFile(path.join(source,file));if(bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error('Incomplete or modified source: '+file+'. Run npm run prepare:preview after intentional edits.');const target=path.join(dist,file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
const config=staticHostConfig({target:process.env.MATCHLENS_DEPLOY_TARGET??'netlify',apiBase:process.env.MATCHLENS_AZURE_API_BASE??''});
await writeFile(path.join(dist,'SOURCES.md'),await readFile(path.join(project,'SOURCES.md')));
await writeFile(path.join(dist,'src/cloud-api.mjs'),config.runtime);
if(config.azure){
 await writeFile(path.join(dist,'staticwebapp.config.json'),JSON.stringify(config.azure,null,2)+'\n');
 await rm(path.join(dist,'_headers'),{force:true});
}else{
 await writeFile(path.join(dist,'_headers'),"/*\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: "+config.csp+"\n");
 await rm(path.join(dist,'staticwebapp.config.json'),{force:true});
}
if(config.redirects)await writeFile(path.join(dist,'_redirects'),config.redirects);else await rm(path.join(dist,'_redirects'),{force:true});
console.log('Built '+(config.azure?'Azure Static Web Apps':'Netlify-compatible')+' workspace: '+dist+'. No deployment performed.');
