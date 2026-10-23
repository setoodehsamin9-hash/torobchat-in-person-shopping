import { afterEach,describe,expect,it,vi } from 'vitest';
const fake=vi.hoisted(()=>({searchStoreOffers:vi.fn()}));
vi.mock('../src/lib/store-discovery',()=>fake);
import { runTool } from '../src/lib/agent/tools';
import { outputSchemas,toolSchemas } from '../src/lib/agent/schemas';
import type { Product,EnrichedOffer,StoreDiscoveryResult } from '../src/lib/contracts';
const product:Product={product_id:'p1',persian_title:'کفش ثبت‌شده',brand_name:null,category_name:'کفش',model:null,image_urls:[],specs:[],min_price_toman:100,max_price_toman:100,offer_count:1};
const offer:EnrichedOffer={offer_id:'o1',product_id:'p1',shop_id:'s1',price_toman:100,last_price_changed_at:null,seller_title:null,warranty:null,description:null,source:'torob_hackathon_dataset',price_status:'recorded',stock_status:'unknown',verification_status:'unknown',shop:{shop_id:'s1',name:null,address:null,location_label:null,lat:null,lon:null,weekly_hours:{},payment_options:[],category_names:[],website_url:null,instagram:null,supports_fast_delivery:null,identity_verified:false},distance_km:null,installment_eligible:false,payment_notes:[],freshness:{age_days:null,status:'unknown'},hours:{state:'unknown',label:'نامشخص',schedule_status:'unknown'},score:0,reasons:[]};
const result:StoreDiscoveryResult={query:'کفش',matches:[{product,offer}],limited:true};
afterEach(()=>vi.clearAllMocks());
describe('store discovery tool boundary',()=>{
 it('renders a typed bounded discovery block with genuine IDs intact',async()=>{fake.searchStoreOffers.mockResolvedValue(result);const r=await runTool('searchStoreOffers',{query:'کفش',limit:12});expect(r.blocks).toEqual([{type:'store_discovery',title:expect.any(String),...result}]);expect(r.event).toMatchObject({tool:'searchStoreOffers',status:'complete'});});
 it('rejects output whose product and offer identities disagree',async()=>{fake.searchStoreOffers.mockResolvedValue({...result,matches:[{product,offer:{...offer,product_id:'other'}}]});await expect(runTool('searchStoreOffers',{query:'کفش'})).rejects.toThrow();});
 it('rejects output whose nested shop or traceability is forged',()=>{expect(outputSchemas.searchStoreOffers.safeParse({...result,matches:[{product,offer:{...offer,shop:{...offer.shop,shop_id:'other'}}}]}).success).toBe(false);expect(outputSchemas.searchStoreOffers.safeParse({...result,matches:[{product,offer:{...offer,stock_status:'available'}}]}).success).toBe(false);});
 it('rejects duplicate or oversized output and an unbounded input',()=>{expect(outputSchemas.searchStoreOffers.safeParse({...result,matches:[...result.matches,...result.matches]}).success).toBe(false);expect(outputSchemas.searchStoreOffers.safeParse({...result,matches:Array.from({length:13},(_,i)=>({product,offer:{...offer,offer_id:`o${i}`}}))}).success).toBe(false);expect(toolSchemas.searchStoreOffers.safeParse({query:'کفش',limit:13}).success).toBe(false);expect(toolSchemas.searchStoreOffers.safeParse({query:'کفش',filters:{lat:90}}).success).toBe(false);});
});

import { conversationContext } from '../src/lib/chat-context';
describe('discovery conversation evidence',()=>{
 it('carries exact matched product/offer/shop IDs into the next bounded turn',()=>{const r=conversationContext([{role:'assistant',text:'فروشگاه‌های مرتبط',blocks:[{type:'store_discovery',title:'فروشگاه‌ها',...result}]}]);expect(r.context.products).toEqual([{product_id:'p1',title:'کفش ثبت‌شده'}]);expect(r.context.offers).toEqual([{offer_id:'o1',product_id:'p1',shop_id:'s1'}]);});
 it('keeps discovery context bounded across successive result blocks',()=>{const r=conversationContext(Array.from({length:6},(_,i)=>({role:'assistant' as const,text:'متن'.repeat(500),blocks:[{type:'store_discovery' as const,title:'فروشگاه‌ها',query:'کفش',limited:true as const,matches:Array.from({length:12},(_,j)=>({product:{...product,product_id:`p${i}-${j}`},offer:{...offer,offer_id:`o${i}-${j}`,product_id:`p${i}-${j}`}}))}]})));expect(r.context.products).toHaveLength(12);expect(r.context.offers).toHaveLength(20);expect(r.history.every(m=>m.text.length<=800)).toBe(true);expect(r.context.products.every(p=>p.product_id.startsWith('p5-'))).toBe(true);});
});
