import { embeddingConfig } from '../src/lib/retrieval/core';
import { indexProducts,createEmbeddingIndex } from '../src/lib/retrieval/ingest';
import { closeDatabase } from '../src/lib/db/client';
async function main(){const args=process.argv.slice(2),value=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);const config=embeddingConfig();
  // Default is a bounded dry-run. No API call occurs without --execute.
  const execute=args.includes('--execute');const options={execute,limit:Number(value('limit')??100),batchSize:Number(value('batch-size')??16),maxRequests:Number(value('max-requests')??1),category:value('category')};
  console.log(JSON.stringify({mode:execute?'execute_paid_embeddings':'dry_run_no_api',model:config.model,dimensions:config.dimensions,space:config.space,...options}));
  if(args.includes('--create-index')){await createEmbeddingIndex(config);console.log('Vector index ready. No embeddings requested.');return;}
  const result=await indexProducts(config,options);console.log(JSON.stringify({...result,note:execute?'Only this bounded job ran. Restarting rechecks source hashes.':'embedded means pending documents in this dry-run; no API calls made. input_units are UTF-8 bytes, not provider token counts or dollars.'},null,2));}
main().catch(()=>{console.error('ساخت ایندکس متوقف شد؛ تنظیمات، اعتبار، سقف مصرف یا دسترسی دیتابیس را بررسی کنید. هیچ retry خودکاری انجام نشد.');process.exitCode=1;}).finally(closeDatabase);
