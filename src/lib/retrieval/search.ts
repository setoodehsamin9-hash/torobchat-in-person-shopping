import { getProduct,getProductOffers,searchProducts } from '../catalog';
import type { OfferFilters,PageResult,Product,SearchInput,RetrievalInfo } from '../contracts';
import { embeddingConfig,reciprocalRankFusion } from './core';
import { queryEmbedding } from './client';
import { embeddingCount,nearestProducts } from './store';
export async function hybridSearch(input:SearchInput,filters:OfferFilters={},signal?:AbortSignal):Promise<PageResult<Product>&{retrieval:RetrievalInfo}>{
  const start=performance.now(),requested=Math.min(40,Math.max(1,input.limit??12));
  const lexical=await searchProducts({...input,filters,page:1,limit:24});
  let mode:RetrievalInfo['mode']='disabled',indexed=0,semanticIds:string[]=[];
  try{const config=embeddingConfig();if(config.enabled&&input.query?.trim()){
    indexed=await embeddingCount(config);
    if(indexed===0)mode='index_empty';else{const vector=await queryEmbedding(input.query,config,signal);const semantic=await nearestProducts(config,vector);semanticIds=semantic.map(r=>r.product_id);mode='hybrid';}
  }}catch{mode='lexical_fallback';}
  const ranked=reciprocalRankFusion(lexical.data.map(p=>p.product_id),semanticIds),products=new Map(lexical.data.map(p=>[p.product_id,p]));
  const data:Product[]=[];const hard=filters.minPrice!==undefined||filters.maxPrice!==undefined||input.minPrice!==undefined||input.maxPrice!==undefined||filters.installmentOnly||filters.lat!==undefined||Boolean(filters.region);
  for(const id of ranked){if(signal?.aborted)break;const product=products.get(id)??await getProduct(id);if(!product||(input.category&&product.category_name!==input.category))continue;
    if(hard){const linked=await getProductOffers(id,{...filters,minPrice:filters.minPrice??input.minPrice,maxPrice:filters.maxPrice??input.maxPrice,page:1,limit:1});if(!linked.data.length)continue;}
    data.push({...product,reasons:[...(product.reasons??[]),...(semanticIds.includes(id)?['بازیابی شباهت معنایی؛ تناسب و موجودی قطعی نیست']:[]),...(hard?['دارای پیشنهاد واقعی مطابق محدودیت‌های فعلی']:[])]});
    if(data.length>=requested)break;
  }
  return {data,total:data.length,page:1,limit:requested,timing_ms:Math.round(performance.now()-start),retrieval:{mode,indexed_products:indexed,candidates:data.length,limited:true,duration_ms:Math.round(performance.now()-start)}};
}
