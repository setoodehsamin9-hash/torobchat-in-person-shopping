import { createHash } from 'node:crypto';
import { query } from '../db/client';
import { productDocument,type EmbeddingConfig } from './core';
import { createEmbeddings } from './client';
import { createEmbeddingIndex,registerSpace,saveProductEmbedding } from './store';
import type { Product } from '../contracts';
type Row=Pick<Product,'product_id'|'persian_title'|'brand_name'|'model'|'category_name'|'specs'>;
export type IndexOptions={execute:boolean;limit:number;batchSize:number;maxRequests:number;category?:string;onProgress?:(progress:{scanned:number;embedded:number;skipped:number;requests:number;input_units:number})=>void};
export async function indexProducts(config:EmbeddingConfig,options:IndexOptions){
  if(!Number.isInteger(options.limit)||options.limit<1||options.limit>300000||!Number.isInteger(options.batchSize)||options.batchSize<1||options.batchSize>32||!Number.isInteger(options.maxRequests)||options.maxRequests<1||options.maxRequests>1000)throw new Error('index_options');
  await registerSpace(config);if(options.execute&&!config.enabled)throw new Error('embedding_not_configured');
  const job=createHash('sha256').update(config.space+'|'+(options.category??'all')).digest('hex');
  let cursor='',scanned=0,embedded=0,skipped=0,requests=0,input_units=0;
  if(options.execute){const jobs=await query<{cursor:string;completed:boolean}>('SELECT cursor,completed FROM embedding_index_jobs WHERE job=$1',[job]);if(jobs[0]&&!jobs[0].completed)cursor=jobs[0].cursor;}
  const checkpoint=async(value:string,completed=false)=>{if(options.execute)await query('INSERT INTO embedding_index_jobs(job,cursor,completed) VALUES ($1,$2,$3) ON CONFLICT(job) DO UPDATE SET cursor=EXCLUDED.cursor,completed=EXCLUDED.completed,updated_at=now()',[job,value,completed]);};
  while(scanned<options.limit){const rows=await query<Row&{document_hash:string|null}>(`SELECT p.product_id,p.persian_title,p.brand_name,p.model,p.category_name,p.specs,e.document_hash FROM products p LEFT JOIN product_embeddings e ON e.product_id=p.product_id AND e.space=$1 WHERE p.product_id>$2 AND ($3::text IS NULL OR p.category_name=$3) ORDER BY p.product_id LIMIT $4`,[config.space,cursor,options.category??null,Math.min(100,options.limit-scanned)]);if(!rows.length){await checkpoint(cursor,true);break;}
    const pending:{row:Row;document:ReturnType<typeof productDocument>}[]=[];
    for(const row of rows){scanned++;cursor=row.product_id;const document=productDocument(row);if(!document.text||document.hash===row.document_hash){skipped++;continue;}pending.push({row,document});}
    for(let offset=0;offset<pending.length;offset+=options.batchSize){const batch=pending.slice(offset,offset+options.batchSize);if(options.execute&&requests>=options.maxRequests){options.onProgress?.({scanned,embedded,skipped,requests,input_units});return {scanned,embedded,skipped,requests,input_units,stopped:'request_limit',dry_run:false};}
      const texts=batch.map(p=>p.document.text);const units=texts.reduce((n,t)=>n+Buffer.byteLength(t),0);
      if(options.execute){const vectors=await createEmbeddings(texts,config);requests++;for(let i=0;i<batch.length;i++)await saveProductEmbedding(config,batch[i].row.product_id,batch[i].document.hash,vectors[i]);await checkpoint(batch[batch.length-1].row.product_id);}
      embedded+=batch.length;input_units+=units;
    }
    await checkpoint(cursor);
    options.onProgress?.({scanned,embedded,skipped,requests,input_units});
  }
  return {scanned,embedded,skipped,requests,input_units,stopped:'complete',dry_run:!options.execute};
}
export { createEmbeddingIndex };
