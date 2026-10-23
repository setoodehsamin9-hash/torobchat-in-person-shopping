import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Product } from '../contracts';
export const DOCUMENT_VERSION='product-v1';
export function embeddingConfig(env:Record<string,string|undefined>=process.env){
  const base=new URL(env.EMBEDDING_BASE_URL||'https://ai.boxapi.ir/ai/v1');
  if(base.username||base.password||base.search||base.hash||!(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw new Error('embedding_config');
  const model=z.enum(['text-embedding-3-small','text-embedding-3-large']).parse(env.EMBEDDING_MODEL||'text-embedding-3-small');
  const dimensions=z.coerce.number().int().min(1).max(model==='text-embedding-3-small'?1536:3072).parse(env.EMBEDDING_DIMENSIONS||(model==='text-embedding-3-small'?1536:3072));
  const integer=(name:string,fallback:number,min:number,max:number)=>z.coerce.number().int().min(min).max(max).parse(env[name]??fallback);
  const apiKey=env.EMBEDDING_API_KEY||env.BOXAPI_API_KEY||'';
  const space=createHash('sha256').update(JSON.stringify([base.href.replace(/\/$/,''),model,dimensions,DOCUMENT_VERSION])).digest('hex');
  return {base,model,dimensions,apiKey,space,configured:Boolean(apiKey),enabled:env.EMBEDDING_ENABLED!=='false'&&Boolean(apiKey),
    dailyRequests:integer('EMBEDDING_DAILY_REQUEST_LIMIT',100,1,10000),dailyInputUnits:integer('EMBEDDING_DAILY_INPUT_LIMIT',200000,1,10000000),
    timeoutMs:integer('EMBEDDING_TIMEOUT_MS',8000,1000,30000),topK:integer('EMBEDDING_TOP_K',24,6,60),minSimilarity:z.coerce.number().min(0).max(1).parse(env.EMBEDDING_MIN_SIMILARITY??0.25)};
}
export type EmbeddingConfig=ReturnType<typeof embeddingConfig>;
export function boundedText(value:string,maxBytes:number){let text='',size=0;for(const c of value){const n=Buffer.byteLength(c);if(size+n>maxBytes)break;text+=c;size+=n;}return text;}
export function productDocument(p:Pick<Product,'persian_title'|'brand_name'|'model'|'category_name'|'specs'>){
  const text=boundedText([p.persian_title,p.brand_name,p.model,p.category_name,...p.specs.slice(0,12).map(s=>`${s.key.slice(0,80)}: ${s.value.slice(0,200)}`)].filter(Boolean).join('\n').normalize('NFC'),2400).trim();
  return {text,hash:createHash('sha256').update(DOCUMENT_VERSION+'\n'+text).digest('hex')};
}
export function decodeEmbeddings(raw:unknown,count:number,dimensions:number):number[][]{
  const parsed=z.object({data:z.array(z.object({index:z.number().int().nonnegative(),embedding:z.array(z.number().finite()).length(dimensions)})).length(count)}).parse(raw);
  const output:number[][]=new Array(count);
  for(const item of parsed.data){if(item.index>=count||output[item.index])throw new Error('embedding_invalid_response');const norm=Math.hypot(...item.embedding);if(!Number.isFinite(norm)||norm===0)throw new Error('embedding_invalid_response');output[item.index]=item.embedding.map(v=>v/norm);}
  return output;
}
export function reciprocalRankFusion(lexical:string[],semantic:string[]){const score=new Map<string,number>();for(const [list,weight] of [[lexical,1.15],[semantic,1]] as const){list.forEach((id,index)=>score.set(id,(score.get(id)??0)+weight/(60+index+1)));}return [...score].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([id])=>id);}
