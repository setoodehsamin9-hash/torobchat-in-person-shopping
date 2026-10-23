// Explicit opt-in connectivity check: one short paid embedding request, no bulk indexing.
import { embeddingConfig } from '../src/lib/retrieval/core';
import { createEmbeddings } from '../src/lib/retrieval/client';
import { closeDatabase } from '../src/lib/db/client';
async function main(){const config=embeddingConfig();const vectors=await createEmbeddings(['خرید لپ تاپ'],config);console.log(JSON.stringify({ok:true,host:config.base.host,model:config.model,dimensions:vectors[0].length,requests:1,index_created:false}));}
main().catch(error=>{console.error(JSON.stringify({ok:false,error:error instanceof Error&&/^embedding_/.test(error.message)?error.message:'embedding_connection_failed'}));process.exitCode=1;}).finally(closeDatabase);
