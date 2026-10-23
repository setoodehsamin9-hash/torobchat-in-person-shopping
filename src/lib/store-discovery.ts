import { getProductOffers,searchProducts } from './catalog';
import { storeDiscoveryOutputSchema,toolSchemas } from './agent/schemas';
import type { OfferFilters,StoreDiscoveryResult } from './contracts';

/** A bounded first-page discovery, never a catalogue-wide inventory claim.
 * Candidate products and every returned offer use the authoritative catalogue
 * predicates. In particular, budget and payment must hold on the same offer.
 */
export async function searchStoreOffers(input:{query:string;filters?:OfferFilters;limit?:number}):Promise<StoreDiscoveryResult>{
  const {query,filters={},limit}=toolSchemas.searchStoreOffers.parse(input);
  const candidates=await searchProducts({query,filters,page:1,limit:24});
  const matches:StoreDiscoveryResult['matches']=[];
  const maximum=Math.min(limit,5),seenShops=new Set<string>();
  const queues:StoreDiscoveryResult['matches'][]=[];
  const products=candidates.data.slice(0,24),eligibleShops=new Set<string>();
  // Bound database fan-out and stop once enough distinct linked shops exist.
  // Queue order remains product relevance order, independent of query latency.
  for(let offset=0;offset<products.length;offset+=4){
    const batch=await Promise.all(products.slice(offset,offset+4).map(async product=>{
      const linked=await getProductOffers(product.product_id,{...filters,page:1,limit:40});
      return linked.data.filter(offer=>offer.product_id===product.product_id&&offer.shop_id===offer.shop.shop_id).map(offer=>({product,offer}));
    }));
    queues.push(...batch);batch.flat().forEach(match=>eligibleShops.add(match.offer.shop_id));
    if(eligibleShops.size>=maximum&&queues.filter(queue=>queue.length).length>=maximum)break;
  }
  // One recommendation per product on each pass, then fill remaining places
  // with additional sellers of those same products. Every shop appears once.
  while(matches.length<maximum){
    let added=false;
    for(const queue of queues){
      let match:StoreDiscoveryResult['matches'][number]|undefined;
      while(queue.length){const candidate=queue.shift()!;if(!seenShops.has(candidate.offer.shop_id)){match=candidate;break;}}
      if(!match)continue;
      seenShops.add(match.offer.shop_id);matches.push(match);added=true;
      if(matches.length===maximum)break;
    }
    if(!added)break;
  }
  return storeDiscoveryOutputSchema.parse({query,matches,limited:true});
}
