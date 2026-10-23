import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseMessageSession } from '../src/lib/agent/orchestrator';
import { chatInputSchema, toolSchemas } from '../src/lib/agent/schemas';

describe('agent input safety', () => {
  it('preserves Persian budget and installment constraints across followups', () => {
    const session = parseMessageSession('هدفون انکر تا ۲ میلیون تومان با اقساط', {lat:35.7,lng:51.4,radiusKm:3});
    expect(session.maxPrice).toBe(2_000_000);
    expect(session.installmentOnly).toBe(true);
    expect(session.radiusKm).toBe(3);
    expect(session.query).toContain('هدفون');
  });
  it('recognizes the reported conversational credit-laptop store request',()=>{
    const s=parseMessageSession('توی تهران لپتاپ هارو کجا به صورت خرید اعتباری میدن',{});
    expect(s.installmentOnly).toBe(true);expect(s.intent).toBe('stores');expect(s.query).toBe('لپ تاپ');
  });
  it('recognizes a category map request without confusing shop categories with inventory',()=>{
    const s=parseMessageSession('فروشگاه‌هایی که کفش دارن رو روی نقشه نشون بده',{});
    expect(s.intent).toBe('store_map');expect(s.query).toBe('کفش');
    expect(parseMessageSession('فروشگاه همین کالا رو روی نقشه نشون بده',{product_id:'p1'}).product_id).toBe('p1');
  });
  it('does not interpret model numbers as budgets', () => {
    expect(parseMessageSession('شارژر اپل ۲۰ وات', {}).maxPrice).toBeUndefined();
  });
  it('reads fractional Persian budgets without multiplying the wrong amount',()=>{
    expect(parseMessageSession('هدفون تا ۱٫۵ میلیون تومان',{}).maxPrice).toBe(1_500_000);
  });
  it('keeps the chosen model when the followup only edits financing or asks its price',()=>{
    expect(parseMessageSession('با اقساط تا ۳ میلیون', {product_id:'p1',query:'هدفون'}).product_id).toBe('p1');
    expect(parseMessageSession('قیمتش چنده', {product_id:'p1',query:'هدفون'}).product_id).toBe('p1');
  });
  it('cannot forge seller verification or mix simulation provenance', () => {
    expect(toolSchemas.recordInquiryStatus.safeParse({offerId:'o1',status:'available',channel:'simulation',provenance:'user_reported'}).success).toBe(false);
    expect(toolSchemas.recordInquiryStatus.safeParse({offerId:'o1',status:'seller_confirmed',channel:'user_entered',provenance:'user_reported'}).success).toBe(false);
  });
  it('rejects malformed coordinates, unbounded limits, and unknown fields', () => {
    expect(toolSchemas.getProductOffers.safeParse({productId:'p',filters:{lat:91,lng:0}}).success).toBe(false);
    expect(toolSchemas.searchProducts.safeParse({query:'x',limit:10000}).success).toBe(false);
    expect(toolSchemas.getProductDetails.safeParse({productId:'p',price:1}).success).toBe(false);
  });
});

const fake=vi.hoisted(()=>({getProduct:vi.fn(),getOffer:vi.fn(),getProductOffers:vi.fn(),searchProducts:vi.fn(),getShop:vi.fn(),query:vi.fn()}));
vi.mock('../src/lib/catalog',()=>fake);
vi.mock('../src/lib/db/client',()=>({query:fake.query}));
import { runTool } from '../src/lib/agent/tools';
import { orchestrateChat } from '../src/lib/agent/orchestrator';
import { readSafeJson } from '../src/lib/agent/http';
import type { Product, Shop, EnrichedOffer } from '../src/lib/contracts';
const prod:Product={product_id:'p1',persian_title:'محصول آزمون',brand_name:null,category_name:'آزمون',model:null,image_urls:[],specs:[],min_price_toman:null,max_price_toman:null,offer_count:1};
const seller:Shop={shop_id:'s1',name:null,address:null,location_label:null,lat:null,lon:null,weekly_hours:{},payment_options:[],category_names:[],website_url:null,instagram:null,supports_fast_delivery:null,identity_verified:false};
const linked:EnrichedOffer={offer_id:'o1',product_id:'p1',shop_id:'s1',price_toman:null,last_price_changed_at:null,seller_title:null,warranty:null,description:null,source:'torob_hackathon_dataset',price_status:'recorded',stock_status:'unknown',verification_status:'unknown',shop:seller,distance_km:null,installment_eligible:false,payment_notes:[],freshness:{age_days:null,status:'unknown'},hours:{state:'unknown',label:'نامشخص',schedule_status:'unknown'},score:0,reasons:[]};
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('validated real-record tools',()=>{
  it.each(['gpt-6-luna','openai/gpt-6-luna'])('uses completion budget and function-compatible reasoning for BoxAPI %s without rejected legacy parameters',async model=>{
    vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('AI_PROVIDER','boxapi');vi.stubEnv('AI_MODEL',model);vi.stubEnv('AI_BASE_URL','https://ai.boxapi.ir/ai/v1');vi.stubEnv('EMBEDDING_ENABLED','false');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:'سلام! چه کالایی برای خرید حضوری می‌خواهی؟'}}]})));
    const r=await orchestrateChat({message:'سلام',session:{}});
    const payload=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.max_completion_tokens).toBe(800);expect(payload).not.toHaveProperty('max_tokens');expect(payload).not.toHaveProperty('temperature');expect(payload.reasoning_effort).toBe('none');expect(r.mode).toBe('provider');
  });
  it('preserves the actual model greeting instead of replacing it with a fixed reply',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');vi.stubEnv('EMBEDDING_ENABLED','false');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    const message='سلام! برای خرید حضوری دنبال چه کالایی هستی؟';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:message}}]})));
    const r=await orchestrateChat({message:'سلام',session:{}});
    expect(r.mode).toBe('provider');expect(r.reply).toBe(message);expect(r.agent?.provider_requests).toBe(1);
  });
  it('keeps only final model guidance after a tool review',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');vi.stubEnv('EMBEDDING_ENABLED','false');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.getProduct.mockResolvedValue(prod);fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    const message='بیایید پیشنهادها را برای مراجعه حضوری بررسی کنیم.';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'a',type:'function',function:{name:'getProductOffers',arguments:JSON.stringify({productId:'p1',assistant_message:'بیایید بررسی کنیم.'})}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish',type:'function',function:{name:'finishShoppingTurn',arguments:JSON.stringify({question:'none',message})}}]}}]})));
    const r=await orchestrateChat({message:'فروشگاه همین کالا',session:{product_id:'p1'}});
    expect(r.reply).toBe(message);expect(r.mode).toBe('provider');expect(r.agent?.provider_requests).toBe(2);
    expect(r.blocks).toMatchObject([{type:'offers',offers:[{offer_id:'o1',stock_status:'unknown'}]}]);
  });
  it('streams validated evidence before the canonical response is finished',async()=>{
    vi.stubEnv('AI_API_KEY','');vi.stubEnv('EMBEDDING_ENABLED','false');
    fake.getProduct.mockResolvedValue(prod);fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    const events:{type:string}[]=[];
    const r=await orchestrateChat({message:'فروشگاه‌ها',interaction:'show_stores',session:{product_id:'p1'}},undefined,undefined,event=>events.push(event));
    expect(events[0].type).toBe('status');expect(events.some(e=>e.type==='tool')).toBe(true);expect(events.some(e=>e.type==='block')).toBe(true);
    expect(r.blocks).toHaveLength(1);
  });
  it('never turns unknown price into zero in an inquiry draft',async()=>{
    fake.getOffer.mockResolvedValue(linked);fake.getProduct.mockResolvedValue(prod);
    const result=await runTool('buildInquiryDraft',{offerId:'o1'});
    expect(result.blocks[0]).toMatchObject({type:'inquiry',offer_id:'o1'});
    expect(JSON.stringify(result.result)).toContain('نامشخص');
    expect(JSON.stringify(result.result)).toContain('آزمایشی');
    expect(JSON.stringify(result.result)).not.toContain('0 تومان');
  });
  it('rejects comparison across distinct product IDs',async()=>{
    fake.getProduct.mockResolvedValue(prod);fake.getOffer.mockImplementation((id:string)=>Promise.resolve({...linked,offer_id:id,product_id:id==='o2'?'p2':'p1'}));
    await expect(runTool('compareOffers',{productId:'p1',offerIds:['o1','o2']})).rejects.toThrow('یک محصول');
  });
  it('records user reports as unknown rather than seller confirmed',async()=>{
    fake.getOffer.mockResolvedValue(linked);fake.query.mockResolvedValue([]);
    const r=await runTool('recordInquiryStatus',{offerId:'o1',status:'available',channel:'user_entered',provenance:'user_reported'});
    expect(r.result).toMatchObject({verification_status:'unknown',provenance:'user_reported'});
  });
  it('disables simulated contacts in production unless explicitly enabled',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('DEMO_CONTACT_MODE','false');fake.getOffer.mockResolvedValue(linked);
    await expect(runTool('recordInquiryStatus',{offerId:'o1',status:'available',channel:'simulation',provenance:'simulation'})).rejects.toThrow('غیرفعال');
    expect(fake.query).not.toHaveBeenCalled();
  });
  it('excludes failed offers and never relaxes alternative constraints',async()=>{
    fake.getProduct.mockResolvedValue(prod);fake.searchProducts.mockResolvedValue({data:[],total:0,page:1,limit:16});
    fake.getProductOffers.mockResolvedValue({data:[linked,{...linked,offer_id:'o2'}],total:2,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
    const r=await runTool('findAlternatives',{productId:'p1',constraints:{maxPrice:500,lat:35.7,lng:51.4,radiusKm:2,installmentOnly:true},excludeOfferIds:['o1'],reason:'unanswered'});
    expect(r.result).toMatchObject({same_product:[{offer_id:'o2'}]});
    expect(fake.getProductOffers).toHaveBeenCalledWith('p1',expect.objectContaining({maxPrice:500,radiusKm:2,installmentOnly:true}));
  });
  it('runs a functional no-key flow with recorded tool events',async()=>{
    vi.stubEnv('AI_API_KEY','');fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:12});
    const r=await orchestrateChat({message:'هدفون تا ۲ میلیون',session:{}});
    expect(r.mode).toBe('deterministic');expect(r.events).toMatchObject([{tool:'searchProducts',status:'complete'}]);expect(r.blocks).toMatchObject([{type:'products',products:[{product_id:'p1'}]}]);expect(r.session.maxPrice).toBe(2_000_000);
  });
  it('keeps products without eligible linked offers out of strict installment discovery',async()=>{
    vi.stubEnv('AI_API_KEY','');fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:24});
    fake.getProductOffers.mockResolvedValue({data:[],total:0,page:1,limit:1,product:prod,disclaimer:'ثبت‌شده'});
    const r=await orchestrateChat({message:'هدفون اقساط',session:{lat:35.7,lng:51.4,radiusKm:2}});
    expect(r.blocks).toMatchObject([{type:'products',products:[]}]);
  });
  it('answers a store-discovery request with linked offers and keeps strict installment filters',async()=>{
    vi.stubEnv('AI_API_KEY','');fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:24});
    fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:2,product:prod,disclaimer:'ثبت‌شده'});
    const r=await orchestrateChat({message:'توی تهران لپتاپ هارو کجا به صورت خرید اعتباری میدن',session:{}});
    expect(r.blocks.some(b=>b.type==='offers')).toBe(true);
    expect(fake.searchProducts).toHaveBeenCalledWith(expect.objectContaining({category:'لپ تاپ و نوت بوک'}));
    expect(fake.getProductOffers).toHaveBeenCalledWith('p1',expect.objectContaining({installmentOnly:true}));
  });
  it('reviews linked store evidence after model-directed discovery',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:3});
    fake.getProductOffers.mockResolvedValue({data:[{...linked,installment_eligible:true}],total:1,page:1,limit:2,product:prod,disclaimer:'ثبت‌شده'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'search1',type:'function',function:{name:'searchProducts',arguments:JSON.stringify({query:'لپ تاپ'})}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none","offer_ids":["o1"]}'}}]}}]})));
    const r=await orchestrateChat({message:'توی تهران لپتاپ هارو کجا به صورت خرید اعتباری میدن',session:{}});
    expect(r.mode).toBe('provider');expect(r.agent?.provider_requests).toBe(2);expect(r.agent?.fallback_reason).toBeUndefined();
    expect(r.blocks.some(b=>b.type==='store_discovery'&&b.matches.some(m=>m.offer.offer_id==='o1'&&m.offer.installment_eligible))).toBe(true);
  });
  it('reviews selected-product offers before finishing',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'offers1',type:'function',function:{name:'getProductOffers',arguments:'{"productId":"p1"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none","offer_ids":["o1"]}'}}]}}]})));
    const r=await orchestrateChat({message:'قیمتش چنده',session:{product_id:'p1'}});
    expect(r.mode).toBe('provider');expect(r.agent?.provider_requests).toBe(2);expect(r.agent?.fallback_reason).toBeUndefined();
    expect(r.blocks).toMatchObject([{type:'offers',offers:[{offer_id:'o1',stock_status:'unknown'}]}]);
  });
  it.each(['لپتاپ کجا بخرم و فروشگاه‌ها را مقایسه کن','لپتاپ کجا بخرم و فروشگاه‌ها را مقايسه کن'])('continues comparison reasoning for compound store request: %s',async(message)=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:3});
    fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:2,product:prod,disclaimer:'ثبت‌شده'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'search1',type:'function',function:{name:'searchProducts',arguments:'{"query":"لپ تاپ"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish1',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"select_offers"}'}}]}}]})));
    const r=await orchestrateChat({message,session:{}});
    expect(r.agent?.provider_requests).toBe(2);expect(r.agent?.fallback_reason).toBeUndefined();
  });
  it('accepts only documented direct interactions',()=>{
    expect(chatInputSchema.safeParse({message:'فروشگاه‌ها',interaction:'show_stores'}).success).toBe(true);
    expect(chatInputSchema.safeParse({message:'تماس',interaction:'contact_seller'}).success).toBe(false);
  });
  it.each(['show_stores','nearby_stores','credit_stores'] as const)('executes explicit %s without model or embedding requests and preserves the exact selection',async interaction=>{
    vi.stubEnv('AI_API_KEY','unused-model-key');vi.stubEnv('EMBEDDING_ENABLED','true');vi.stubEnv('EMBEDDING_API_KEY','unused-embedding-key');
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('No paid API requests allowed')));
    fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    const session={product_id:'p1',selected_product_ids:['p1'],selected_offer_ids:['o1'],query:'هدفون',minPrice:10,maxPrice:500,lat:35.7,lng:51.4,radiusKm:2,region:'مرکز',installmentOnly:false,visitAt:'2026-10-24T12:00:00+03:30',sort:'price' as const};
    const r=await orchestrateChat({message:'محصول دیگری تا ۱ تومان نقدی',interaction,session});
    expect(r.mode).toBe('deterministic');expect(r.agent).toMatchObject({provider_requests:0,retrieval:{mode:'skipped'}});
    expect(r.session).toMatchObject({...session,intent:'offers',sort:interaction==='nearby_stores'?'distance':'price',installmentOnly:interaction==='credit_stores'});
    expect(r.blocks).toMatchObject([{type:'offers',product:{product_id:'p1'}}]);
    expect(fake.getProductOffers).toHaveBeenCalledWith('p1',expect.objectContaining({minPrice:10,maxPrice:500,lat:35.7,lng:51.4,radiusKm:2,region:'مرکز',installmentOnly:interaction==='credit_stores',sort:interaction==='nearby_stores'?'distance':'price',visitAt:session.visitAt}));
    expect(fetch).not.toHaveBeenCalled();expect(fake.query).not.toHaveBeenCalled();
    expect(r.agent?.phases.join(' ')).not.toContain('تشخیص درخواست');
  });
  it('asks for location before an explicit nearby lookup without provider or data calls',async()=>{
    vi.stubEnv('AI_API_KEY','unused-model-key');vi.stubEnv('EMBEDDING_ENABLED','true');vi.stubEnv('EMBEDDING_API_KEY','unused-embedding-key');vi.stubGlobal('fetch',vi.fn());
    const r=await orchestrateChat({message:'نزدیک من',interaction:'nearby_stores',session:{product_id:'p1',maxPrice:500,installmentOnly:true}});
    expect(r.reply).toContain('محله');expect(r.blocks).toEqual([]);expect(r.events).toEqual([]);
    expect(r.session).toMatchObject({product_id:'p1',maxPrice:500,installmentOnly:true});
    expect(r.agent).toMatchObject({provider_requests:0,retrieval:{mode:'skipped'}});
    expect(fetch).not.toHaveBeenCalled();expect(fake.getProductOffers).not.toHaveBeenCalled();
  });
  it('discovers linked real offers with lexical search for an explicit action without a selection',async()=>{
    vi.stubEnv('AI_API_KEY','unused-model-key');vi.stubEnv('EMBEDDING_ENABLED','true');vi.stubEnv('EMBEDDING_API_KEY','unused-embedding-key');vi.stubGlobal('fetch',vi.fn());
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:3});fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:2,product:prod,disclaimer:'ثبت‌شده'});
    const r=await orchestrateChat({message:'فروشگاه‌های هدفون',interaction:'show_stores',session:{query:'هدفون',maxPrice:500}});
    expect(r.mode).toBe('deterministic');expect(r.blocks.some(b=>b.type==='offers')).toBe(true);
    expect(fake.searchProducts).toHaveBeenCalledWith(expect.objectContaining({query:'هدفون',maxPrice:500}));
    expect(fake.getProductOffers).toHaveBeenCalledWith('p1',expect.objectContaining({maxPrice:500}));
    expect(fake.query).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{message:'قیمتش چنده',session:{product_id:'p1'},allowed:['getProductOffers','finishShoppingTurn']},{message:'لپتاپ کجا بخرم',session:{},allowed:['searchStoreOffers','searchProducts','getProductOffers','finishShoppingTurn']}])('only advertises needed read-only tools for simple lookup: $message',async({message,session,allowed})=>{
    vi.stubEnv('AI_API_KEY','test-only-key');fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[],total:0,page:1,limit:3});fake.getProductOffers.mockResolvedValue({data:[],total:0,page:1,limit:2,product:prod,disclaimer:'ثبت‌شده'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{tool_calls:[{id:'f',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"select_product"}'}}]}}]})));
    await orchestrateChat({message,session});
    const payload=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.tools.map((t:{function:{name:string}})=>t.function.name)).toEqual(allowed);
  });
  it('keeps multi-step store detail tools and reasoning available for a compound lookup',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'o',type:'function',function:{name:'getProductOffers',arguments:'{"productId":"p1"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'f',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none"}'}}]}}]})));
    const r=await orchestrateChat({message:'فروشگاهش را پیدا کن و ساعت کارش را بگو',session:{product_id:'p1'}});
    const payload=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.tools.map((t:{function:{name:string}})=>t.function.name)).toContain('getStoreHours');
    expect(r.agent?.provider_requests).toBe(2);
  });
  it('identifies a model timeout without claiming that the remaining quota is exhausted',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:12});
    const controller=new AbortController();vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{controller.abort();throw new Error('aborted');}));
    const r=await orchestrateChat({message:'هدفون',session:{}});
    expect(r.agent?.fallback_reason).toBe('timeout');expect(r.reply).toContain('زمان انتظار');expect(r.reply).not.toContain('سقف مصرف');expect(r.reply).not.toContain('سقف روزانه');
  });
  it.each([{status:401,reason:'provider_auth',copy:'مجوز'},{status:429,reason:'provider_limit',copy:'محدودیت مصرف'},{status:503,reason:'provider_unavailable',copy:'در دسترس نبود'}])('reports provider failure $reason accurately',async({status,reason,copy})=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:12});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status})));
    const r=await orchestrateChat({message:'هدفون',session:{}});
    expect(r.agent?.fallback_reason).toBe(reason);expect(r.reply).toContain(copy);expect(r.reply).not.toContain('یا به سقف مصرف رسید');
  });
  it('distinguishes the local daily request budget from upstream provider failure',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');fake.query.mockResolvedValue([]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:12});
    const r=await orchestrateChat({message:'هدفون',session:{}});
    expect(r.agent?.fallback_reason).toBe('daily_limit');expect(r.reply).toContain('سقف روزانه');expect(r.reply).not.toContain('در دسترس نبود');
  });
  it('rejects cross-origin requests before parsing or saving',async()=>{
    await expect(readSafeJson(new Request('http://localhost:3100/api/tools',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'}))).rejects.toThrow('مبدأ');
  });
  it('allows only the explicitly configured production origin behind a reverse proxy',async()=>{
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://demo.example');
    await expect(readSafeJson(new Request('http://internal:3100/api/tools',{method:'POST',headers:{origin:'https://demo.example','content-type':'application/json'},body:'{}'}))).resolves.toEqual({});
  });
  it('accepts development loopback aliases with the same protocol and port',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('NEXT_PUBLIC_APP_URL','http://localhost:3100');
    await expect(readSafeJson(new Request('http://localhost:3100/api/chat',{method:'POST',headers:{origin:'http://127.0.0.1:3100','sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'}))).resolves.toEqual({});
  });
  it('keeps the development alias exception limited to the same port and trusted loopback names',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('NEXT_PUBLIC_APP_URL','');
    for(const origin of ['http://127.0.0.1:3200','http://localhost.evil.invalid:3100','https://127.0.0.1:3100'])await expect(readSafeJson(new Request('http://localhost:3100/api/chat',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}))).rejects.toThrow('مبدأ');
  });
  it('rejects a browser cross-site request even when both hostnames are loopback aliases',async()=>{
    vi.stubEnv('NODE_ENV','development');
    await expect(readSafeJson(new Request('http://localhost:3100/api/chat',{method:'POST',headers:{origin:'http://127.0.0.1:3100','sec-fetch-site':'cross-site','content-type':'application/json'},body:'{}'}))).rejects.toThrow('بین‌سایتی');
  });
  it('does not allow development loopback aliases in production without explicit configuration',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_APP_URL','');
    await expect(readSafeJson(new Request('http://localhost:3100/api/chat',{method:'POST',headers:{origin:'http://127.0.0.1:3100','content-type':'application/json'},body:'{}'}))).rejects.toThrow('مبدأ');
  });
  it('falls back honestly when the provider tries to record an unsolicited status',async()=>{
    vi.stubEnv('AI_API_KEY','test-only-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{tool_calls:[{id:'call1',type:'function',function:{name:'recordInquiryStatus',arguments:'{}'}}]}}]})));
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:12});
    const r=await orchestrateChat({message:'هدفون',session:{}});
    expect(r.mode).toBe('deterministic');expect(r.reply).toContain('در دسترس نبود');expect(fetch).toHaveBeenCalledTimes(1);expect(fake.query.mock.calls.some(([sql])=>String(sql).includes('INSERT INTO inquiry_records'))).toBe(false);
    vi.unstubAllGlobals();
  });
  it('rejects oversized streamed JSON even without content-length',async()=>{
    await expect(readSafeJson(new Request('http://localhost:3100/api/tools',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'x'.repeat(33000)})}))).rejects.toThrow('حجم');
  });
});

describe('focused LLM replies',()=>{
  it('shows only the actual model guidance instead of appending a canned dataset explanation',async()=>{
    vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.getProduct.mockResolvedValue(prod);fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:12,product:prod,disclaimer:'ثبت‌شده'});
    const message='بیایید پیشنهادها را برای مراجعه حضوری بررسی کنیم.';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'a',type:'function',function:{name:'getProductOffers',arguments:JSON.stringify({productId:'p1',assistant_message:'بیایید بررسی کنیم.'})}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish',type:'function',function:{name:'finishShoppingTurn',arguments:JSON.stringify({question:'none',message})}}]}}]})));
    const r=await orchestrateChat({message:'فروشگاه همین کالا',session:{product_id:'p1'}});
    expect(r.reply).toBe(message);expect(r.blocks).toHaveLength(1);
  });
  it('does not run or render an unsolicited pre-model embedding retrieval',async()=>{
    vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','true');vi.stubEnv('EMBEDDING_API_KEY','offline-embedding-key');
    fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
    fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:5});
    const message='برای خرید حضوری دنبال چه کالایی هستی؟';
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:message}}]})));
    const streamed:{type:string;block?:unknown}[]=[];
    const r=await orchestrateChat({message:'برای خرید راهنمایی کن',session:{}},undefined,undefined,e=>streamed.push(e));
    expect(r.reply).toBe(message);expect(r.blocks).toEqual([]);
    expect(streamed.filter(e=>e.type==='block')).toEqual([]);
    expect(r.events.map(e=>e.tool)).not.toContain('retrieveProducts');
    expect(fake.searchProducts).not.toHaveBeenCalled();
    expect(fake.query.mock.calls.some(([sql])=>String(sql).includes('product_embeddings'))).toBe(false);
  });
});

describe('bounded presentation independent from internal model searches',()=>{
 it('never leaks intermediate product candidates when real linked sellers follow',async()=>{
  vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
  fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
  fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:5});
  fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'a',type:'function',function:{name:'searchProducts',arguments:'{"query":"هدفون"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'b',type:'function',function:{name:'getProductOffers',arguments:'{"productId":"p1"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'c',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none"}'}}]}}]})));
  const emitted:{type:string;block?:{type:string}}[]=[];
  const r=await orchestrateChat({message:'هدفون پیدا کن و بعد فروشگاهش را بررسی کن',session:{}},undefined,undefined,event=>emitted.push(event));
  expect(r.blocks.map(b=>b.type)).toEqual(['offers']);
  expect(emitted.filter(e=>e.type==='block').map(e=>e.block?.type)).toEqual(['offers']);
 });
 it('enforces five recommendations and different shops in final and streamed results',async()=>{
  vi.stubEnv('AI_API_KEY','');vi.stubEnv('EMBEDDING_ENABLED','false');
  const data=Array.from({length:12},(_,i)=>({...linked,offer_id:`o${i}`,shop_id:`s${Math.floor(i/2)}`,shop:{...seller,shop_id:`s${Math.floor(i/2)}`}}));
  fake.getProductOffers.mockResolvedValue({data,total:12,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
  const streamed:{type:string;block?:{type:string;offers?:EnrichedOffer[]}}[]=[];
  const r=await orchestrateChat({message:'فروشگاه‌ها',interaction:'show_stores',session:{product_id:'p1'}},undefined,undefined,e=>streamed.push(e));
  const block=r.blocks.find(b=>b.type==='offers');expect(block?.type).toBe('offers');
  if(block?.type!=='offers')throw new Error('offers missing');
  expect(block.offers).toHaveLength(5);expect(new Set(block.offers.map(o=>o.shop_id)).size).toBe(5);
  expect(streamed.filter(e=>e.type==='block').flatMap(e=>e.block?.offers??[]).map(o=>o.offer_id)).toEqual(block.offers.map(o=>o.offer_id));
 });
});

it('does not turn an acknowledgement of a failed data tool into a successful empty provider response',async()=>{
 vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');vi.stubEnv('AI_MAX_REQUESTS_PER_TURN','1');
 fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
 fake.getProductOffers.mockRejectedValueOnce(new Error('temporary lookup failure')).mockResolvedValue({data:[linked],total:1,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{tool_calls:[{id:'a',type:'function',function:{name:'getProductOffers',arguments:JSON.stringify({productId:'p1',assistant_message:'بیایید پیشنهادها را بررسی کنیم.'})}}]}}]})));
 const r=await orchestrateChat({message:'فروشگاه همین کالا',session:{product_id:'p1'}});
 expect(r.agent?.fallback_reason).toBe('no_valid_tool');expect(r.mode).toBe('deterministic');expect(r.blocks).toMatchObject([{type:'offers',offers:[{offer_id:'o1'}]}]);
});

it('turns model-chosen product discovery into at most five real product-shop recommendations',async()=>{
 vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
 fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
 fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:5});fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({choices:[{message:{tool_calls:[{id:'a',type:'function',function:{name:'searchProducts',arguments:JSON.stringify({query:'هدفون',assistant_message:'بیایید پیشنهادها را بررسی کنیم.'})}},{id:'b',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none"}'}}]}}]})));
 const r=await orchestrateChat({message:'هدفون',session:{}});
 expect(r.blocks.map(b=>b.type)).toEqual(['store_discovery']);
 expect(r.blocks[0]).toMatchObject({matches:[{product:{product_id:'p1'},offer:{offer_id:'o1',shop_id:'s1'}}]});
});


describe('model reviews dataset before publishing one final result',()=>{
 const toolReply=(name:string,args:unknown)=>Response.json({choices:[{message:{tool_calls:[{id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
 function setup(){
  fake.getProduct.mockResolvedValue(prod);
  vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
  fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
  fake.getProductOffers.mockResolvedValue({data:[linked,{...linked,offer_id:'o2',shop_id:'s2',shop:{...seller,shop_id:'s2'}}],total:2,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
 }
 it('sends real tool evidence back to the model and only publishes its final selection',async()=>{
  setup();const events:{type:string}[]=[];
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(toolReply('getProductOffers',{productId:'p1'})).mockImplementationOnce(async(_url,init)=>{
   const payload=JSON.parse(String(init.body));
   expect(payload.messages.some((m:{role:string;content?:string})=>m.role==='tool'&&m.content?.includes('o2'))).toBe(true);
   expect(events.filter(e=>e.type==='block')).toEqual([]);
   return toolReply('finishShoppingTurn',{question:'none',offer_ids:['o2'],message:'بیایید پیشنهادها را بررسی کنیم.'});
  }));
  const r=await orchestrateChat({message:'فروشگاه همین کالا',session:{product_id:'p1'}},undefined,undefined,e=>events.push(e));
  expect(r.agent?.provider_requests).toBe(2);expect(r.agent?.fallback_reason).toBeUndefined();expect(r.mode).toBe('provider');
  expect(r.blocks).toMatchObject([{type:'offers',offers:[{offer_id:'o2',shop_id:'s2'}]}]);
  expect(r.blocks[0].type==='offers'&&r.blocks[0].offers).toHaveLength(1);
 });
 it('does not let finish in the same tool batch pretend that new evidence was read',async()=>{
  setup();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[
   {id:'read',type:'function',function:{name:'getProductOffers',arguments:'{"productId":"p1"}'}},
   {id:'early',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none"}'}}
  ]}}]})).mockResolvedValueOnce(toolReply('finishShoppingTurn',{question:'none',offer_ids:['o1']})));
  const r=await orchestrateChat({message:'قیمتش چنده',session:{product_id:'p1'}});
  expect(r.agent?.provider_requests).toBe(2);expect(r.agent?.fallback_reason).toBeUndefined();
 });
 it('labels a turn with unread evidence as fallback when the request budget ends',async()=>{
  setup();vi.stubEnv('AI_MAX_REQUESTS_PER_TURN','1');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(toolReply('getProductOffers',{productId:'p1'})));
  const r=await orchestrateChat({message:'قیمتش چنده',session:{product_id:'p1'}});
  expect(r.mode).toBe('deterministic');expect(r.agent?.fallback_reason).toBe('review_incomplete');
  expect(r.reply).toContain('بررسی نهایی');
 });
 it('rejects invented recommendation IDs instead of rendering model-authored records',async()=>{
  setup();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(toolReply('getProductOffers',{productId:'p1'})).mockResolvedValue(toolReply('finishShoppingTurn',{question:'none',offer_ids:['invented-offer']})));
  const r=await orchestrateChat({message:'قیمتش چنده',session:{product_id:'p1'}});
  expect(r.agent?.fallback_reason).toBeDefined();expect(r.mode).toBe('deterministic');expect(JSON.stringify(r.blocks)).not.toContain('invented-offer');
 });
});

it('does not discard the sourced final answer when final model prose is rejected',async()=>{
 vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
 fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
 fake.getProduct.mockResolvedValue(prod);fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'read',type:'function',function:{name:'getProductOffers',arguments:'{"productId":"p1"}'}}]}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'finish',type:'function',function:{name:'finishShoppingTurn',arguments:'{"question":"none","message":"قیمت امروز قطعی است."}'}}]}}]})));
 const result=await orchestrateChat({message:'فروشگاه همین کالا',session:{product_id:'p1'}});
 expect(result.mode).toBe('provider');expect(result.reply).toContain('ثبت‌شده');expect(result.reply).not.toContain('قطعی است');
});

it.each(['لامپ میخوام','لامپ'])('searches before an optional location question for a named product: %s',async message=>{
 vi.stubEnv('AI_API_KEY','offline-test-key');vi.stubEnv('EMBEDDING_ENABLED','false');
 fake.query.mockImplementation(async(sql:string)=>sql.includes('RETURNING requests')?[{requests:1}]:[]);
 fake.searchProducts.mockResolvedValue({data:[prod],total:1,page:1,limit:5});fake.getProductOffers.mockResolvedValue({data:[linked],total:1,page:1,limit:40,product:prod,disclaimer:'ثبت‌شده'});
 const reply=(name:string,args:unknown)=>Response.json({choices:[{message:{tool_calls:[{id:crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply('finishShoppingTurn',{question:'location',message:'کدام محدوده را ترجیح می‌دهی؟'})).mockResolvedValueOnce(reply('searchStoreOffers',{query:'لامپ'})).mockResolvedValueOnce(reply('finishShoppingTurn',{question:'none',offer_ids:['o1']})));
 const result=await orchestrateChat({message,session:{}});
 expect(result.agent?.provider_requests).toBe(3);expect(result.agent?.fallback_reason).toBeUndefined();expect(result.blocks).toMatchObject([{type:'store_discovery',matches:[{offer:{offer_id:'o1'}}]}]);expect(result.reply).not.toContain('نقطه‌ای روی نقشه انتخاب');
});
