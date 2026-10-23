// Default: local, read-only checks. --live adds exactly one chat turn per scenario.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {demoScenarios} from '../src/lib/demo-scenarios';
import type {ChatResponse,OffersResult} from '../src/lib/contracts';

const base=process.env.DEMO_BASE_URL||'http://127.0.0.1:3101';
const live=process.argv.includes('--live');
async function read<T>(route:string,input?:unknown):Promise<T>{
 const response=await fetch(new URL(route,base),{signal:AbortSignal.timeout(45_000),...(input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
 assert.equal(response.status,200,`${route}: HTTP ${response.status}`);
 return response.json() as Promise<T>;
}
async function main(){
 const health=await read<{ok:boolean;counts:Record<string,number>}>('/api/health');
 assert.equal(health.ok,true);assert.deepEqual(health.counts,{products:225903,shops:6476,offers:331506});
 const results:Record<string,unknown>[]=[];let failed=false;
 for(const scenario of demoScenarios){
  const result:Record<string,unknown>={scenario:scenario.id};
  try{
   const filters=new URLSearchParams({limit:'3',maxPrice:String(scenario.session.maxPrice)});
   if(scenario.session.installmentOnly)filters.set('installmentOnly','true');
   const offers=await read<OffersResult>(`/api/products/${scenario.session.product_id}/offers?${filters}`);
   assert.ok(offers.data.length>0,'No eligible offer for this scenario');
   for(const offer of offers.data){
    assert.equal(offer.product_id,scenario.session.product_id);assert.equal(offer.shop_id,offer.shop.shop_id);
    assert.equal(offer.source,'torob_hackathon_dataset');assert.equal(offer.stock_status,'unknown');assert.equal(offer.price_status,'recorded');
    assert.ok(offer.price_toman!==null&&offer.price_toman<=scenario.session.maxPrice!);
    if(scenario.session.installmentOnly)assert.equal(offer.installment_eligible,true);
   }
   result.title=offers.product.persian_title;result.offers=offers.data.map(offer=>({offer_id:offer.offer_id,shop_id:offer.shop_id,price_toman:offer.price_toman,installment_eligible:offer.installment_eligible}));
   const tool=async(name:string,input:unknown)=>read('/api/tools',{tool:name,input});
   await tool('buildInquiryDraft',{offerId:offers.data[0].offer_id});
   await tool('buildVisitPlan',{offerIds:[offers.data[0].offer_id]});
   if(scenario.id==='headphone'){
    const sameProduct=offers.data.filter((offer,index,list)=>list.findIndex(other=>other.shop_id===offer.shop_id)===index).slice(0,2);
    assert.equal(sameProduct.length,2,'Need two distinct sellers for comparison');
    await tool('compareOffers',{productId:scenario.session.product_id,offerIds:sameProduct.map(offer=>offer.offer_id)});
    await tool('findAlternatives',{productId:scenario.session.product_id,constraints:{maxPrice:scenario.session.maxPrice},reason:'not_available',excludeOfferIds:[offers.data[0].offer_id]});
   }
   if(scenario.mapQuery){
    const map=await read<{total_shops:number;hubs:{name:string;shop_count:number}[]}>(`/api/bazaar?q=${encodeURIComponent(scenario.mapQuery)}`);
    assert.ok(map.hubs.length>0);result.bazaar={total_shops:map.total_shops,hubs:map.hubs.map(hub=>({name:hub.name,shop_count:hub.shop_count}))};
   }
   result.data='passed';
   if(live){
    const started=performance.now();
    const chat=await read<ChatResponse>('/api/chat',{message:scenario.prompt,session:scenario.session});
    result.chat={mode:chat.mode,agent:chat.agent,elapsed_ms:Math.round(performance.now()-started),block_types:chat.blocks.map(block=>block.type),reply:chat.reply};
    assert.equal(chat.mode,'provider','Chat used fallback instead of model');assert.ok(!chat.agent?.fallback_reason,`Incomplete model turn: ${chat.agent?.fallback_reason}`);
    const presented=chat.blocks.flatMap(block=>block.type==='offers'?block.offers:block.type==='store_discovery'?block.matches.map(match=>match.offer):[]);
    assert.ok(presented.length>0,'Chat did not present seller offers');
    for(const offer of presented){
     assert.equal(offer.product_id,scenario.session.product_id);assert.equal(offer.stock_status,'unknown');
     assert.ok(offer.price_toman!==null&&offer.price_toman<=scenario.session.maxPrice!);
     if(scenario.session.installmentOnly)assert.equal(offer.installment_eligible,true);
    }
    result.live='passed';
   }
  }catch(error){failed=true;result.error=error instanceof Error?error.message:'Check failed';}
  results.push(result);console.log(JSON.stringify(result,null,2));
 }
 await mkdir('logs',{recursive:true});
 await writeFile(`logs/demo-check-${live?'live':'data'}.json`,JSON.stringify({checked_at:new Date().toISOString(),base,live,health,results},null,2)+'\n');
 if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Demo check failed');process.exitCode=1;});
