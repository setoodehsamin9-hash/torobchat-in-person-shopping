import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3100';
async function json(path: string, init?:RequestInit) { const r=await fetch(`${base}${path}`,{...init,signal:AbortSignal.timeout(60000)});assert.equal(r.ok,true,`${path}: HTTP ${r.status}`);return r.json(); }
async function main(){
 const health=await json('/api/health');assert.equal(health.ok,true);console.log('PASS health',health);
 const search=await json('/api/products?query='+encodeURIComponent('هدفون انکر R50i')+'&limit=12');assert.ok(search.data.length>0);console.log('PASS real search',search.data[0].product_id,search.total);
 const id='product_7cc2f9aa4265d40d8ec72d6e';
 const all=await json(`/api/products/${id}/offers?limit=60`);assert.ok(all.data.length>0);assert.ok(all.data.every((o:{product_id:string;stock_status:string;source:string})=>o.product_id===id&&o.stock_status==='unknown'&&o.source==='torob_hackathon_dataset'));
 const strict=await json(`/api/products/${id}/offers?installmentOnly=true&limit=60`);assert.ok(strict.data.length>0);assert.ok(strict.data.every((o:{installment_eligible:boolean;shop:{payment_options:{channel:string}[]}})=>o.installment_eligible&&o.shop.payment_options.some(p=>p.channel==='in_person')));assert.ok(strict.total<all.total);console.log('PASS exact offers and strict channel',all.total,strict.total);
 const budget=await json(`/api/products/${id}/offers?maxPrice=2000000&limit=60`);assert.ok(budget.data.every((o:{price_toman:number|null})=>o.price_toman!==null&&o.price_toman<=2000000));console.log('PASS budget',budget.total);
 const nearby=await json(`/api/products/${id}/offers?lat=35.6952&lng=51.4068&radiusKm=0.1&limit=60`);assert.ok(nearby.data.every((o:{distance_km:number|null})=>o.distance_km!==null&&o.distance_km<=.1));console.log('PASS radius',nearby.total);
 const invalid=await fetch(`${base}/api/products/${id}/offers?lat=100&lng=51`);assert.equal(invalid.status,400);console.log('PASS invalid location');
 const chat=await json('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'هدفون انکر R50i',session:{}})});assert.ok(chat.blocks.length>0);assert.ok(chat.events.length>0);console.log('PASS typed chat tools',chat.mode,chat.events.map((x:{tool:string})=>x.tool));
 const tool=async(name:string,input:unknown)=>json('/api/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:name,input})});
 const draft=await tool('buildInquiryDraft',{offerId:all.data[0].offer_id});assert.ok(draft.result.draft.includes(id));assert.ok(draft.result.draft.includes('قیمت ثبت'));console.log('PASS inquiry draft, no outreach');
 const recorded=await tool('recordInquiryStatus',{offerId:all.data[0].offer_id,status:'not_available',channel:'simulation',provenance:'simulation'});assert.equal(recorded.result.verification_status,'simulated');assert.equal(recorded.result.provenance,'simulation');console.log('PASS explicit persisted simulation');
 const alternatives=await tool('findAlternatives',{productId:id,constraints:{maxPrice:2000000,installmentOnly:true},reason:'not_available',excludeOfferIds:[all.data[0].offer_id]});assert.ok(alternatives.result.same_product.every((o:{offer_id:string;product_id:string;price_toman:number;installment_eligible:boolean})=>o.product_id===id&&o.offer_id!==all.data[0].offer_id&&o.price_toman<=2000000&&o.installment_eligible));assert.ok(alternatives.blocks[0].type==='alternatives');console.log('PASS constrained alternatives',alternatives.result.same_product.length,alternatives.result.similar_products.length);
 const compared=await tool('compareOffers',{productId:id,offerIds:all.data.slice(0,2).map((o:{offer_id:string})=>o.offer_id)});assert.equal(compared.result.offers.length,2);console.log('PASS seller comparison');
 const plan=await tool('buildVisitPlan',{offerIds:[all.data[0].offer_id],day:'2026-10-22'});assert.equal(plan.blocks[0].type,'visit_plan');assert.ok(plan.result.checklist.length>0);console.log('PASS visit plan');
 const forbidden=await fetch(base+'/api/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'recordInquiryStatus',input:{offerId:all.data[0].offer_id,status:'available',channel:'simulation',provenance:'seller_confirmed'}})});assert.equal(forbidden.status,400);console.log('PASS forged seller confirmation rejected');
 for(const path of ['/','/chat',`/products/${id}`,`/shops/${all.data[0].shop_id}`,'/compare','/visit-plan','/settings']){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.ok((await r.text()).includes('dir="rtl"'));console.log('PASS route',path);}
 console.log('All smoke checks passed. No third-party outreach performed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
