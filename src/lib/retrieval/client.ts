import { consumeEmbeddingBudget } from './budget';
import { boundedText,decodeEmbeddings,embeddingConfig,type EmbeddingConfig } from './core';
import { reserveEmbeddingUsage,recordEmbeddingTokens } from './store';
export async function createEmbeddings(texts:string[],config:EmbeddingConfig=embeddingConfig(),signal?:AbortSignal){
  if(!config.enabled||!config.apiKey)throw new Error('embedding_not_configured');
  if(texts.length<1||texts.length>32||texts.some(t=>!t.trim()||Buffer.byteLength(t)>2400))throw new Error('embedding_input_limit');
  const timeout=AbortSignal.timeout(config.timeoutMs),combined=signal?AbortSignal.any([timeout,signal]):timeout;if(combined.aborted)throw new Error('embedding_timeout');
  consumeEmbeddingBudget();
  const day=await reserveEmbeddingUsage(config,texts.reduce((n,t)=>n+Buffer.byteLength(t),0));
  const url=new URL(config.base);url.pathname=url.pathname.replace(/\/$/,'')+'/embeddings';
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model,input:texts,dimensions:config.dimensions,encoding_format:'float'}),signal:combined,redirect:'error'});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'embedding_auth':response.status===429?'embedding_rate_limit':'embedding_unavailable');
  const raw=await response.json();const vectors=decodeEmbeddings(raw,texts.length,config.dimensions);const tokens=raw?.usage?.total_tokens;if(Number.isSafeInteger(tokens)&&tokens>=0)await recordEmbeddingTokens(day,tokens);return vectors;
}
// Exact query cache stays in memory only. No user messages or vectors are written to the DB.
const cache=new Map<string,{expires:number;vector:number[]}>();
const pending=new Map<string,Promise<number[]>>();
export async function queryEmbedding(text:string,config:EmbeddingConfig,signal?:AbortSignal){const redacted=text.replace(/(?:\+?98|۰|0)[۰-۹٠-٩0-9 -]{9,14}/g,'[شماره حذف شد]').replace(/-?\d{1,3}\.\d{4,}\s*[,،]\s*-?\d{1,3}\.\d{4,}/g,'[مختصات حذف شد]');const query=boundedText(redacted,2400).trim();const key=config.space+':'+query;const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.vector;const active=pending.get(key);if(active)return active;const request=createEmbeddings([query],config,signal).then(vectors=>{if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+300000,vector:vectors[0]});return vectors[0];}).finally(()=>pending.delete(key));pending.set(key,request);return request;}
