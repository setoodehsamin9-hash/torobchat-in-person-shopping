import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
const [profile,action='dev']=process.argv.slice(2);
if(!['optimized','boxapi'].includes(profile)||!['dev','build','start','check-ai'].includes(action)){
 console.error('Usage: node scripts/run-profile.mjs optimized|boxapi dev|build|start|check-ai');process.exit(1);
}
// Separate private files prevent sending another provider's key to BoxAPI.
const privateFile=profile==='boxapi'?'.env.boxapi.local':'.env.local';
const local=existsSync(privateFile)?parseEnv(readFileSync(privateFile,'utf8')):{};
const env={...local,...process.env};
if(profile==='boxapi'){
 env.AI_PROVIDER='boxapi';env.AI_BASE_URL='https://ai.boxapi.ir/ai/v1';
 env.AI_MODEL=env.BOXAPI_MODEL||local.AI_MODEL||'gpt-6-luna';
 env.AI_API_KEY=env.BOXAPI_API_KEY||local.AI_API_KEY||'';
 env.EMBEDDING_API_KEY=local.EMBEDDING_API_KEY||'';
 env.EMBEDDING_ENABLED=local.EMBEDDING_ENABLED||'false';
}
env.NEXT_BUILD_DIR=env.NEXT_BUILD_DIR||`.next-${profile}`;
env.PORT=env.PORT||(profile==='boxapi'?'3101':'3100');
env.NEXT_PUBLIC_APP_URL=env.NEXT_PUBLIC_APP_URL||`http://localhost:${env.PORT}`;
if(action==='check-ai'){
 if(!env.AI_API_KEY){console.error(`Set AI_API_KEY in ${privateFile} first. No API request was sent.`);process.exit(1);}
}else if(!env.AI_API_KEY&&action!=='build')console.log(`No model key in ${privateFile}; transparent database fallback is active.`);
const next=path.join(root,'node_modules/next/dist/bin/next');
const args=action==='check-ai'?['--import','tsx','scripts/check-ai-connection.ts']:action==='build'?[next,'build','--webpack']:[next,action,...(action==='dev'?['--webpack']:[]),'--hostname',action==='dev'?'127.0.0.1':'0.0.0.0','--port',env.PORT];
const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code??1;});
