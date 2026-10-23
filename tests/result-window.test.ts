import { describe,expect,it } from 'vitest';
import type { EnrichedOffer,Product,UIBlock } from '../src/lib/contracts';
import { RecommendationWindow } from '../src/lib/agent/result-window';

const product=(product_id:string):Product=>({product_id,persian_title:'کالای ثبت‌شده',brand_name:null,category_name:'کفش',model:null,image_urls:[],specs:[],min_price_toman:100,max_price_toman:100,offer_count:1});
const offer=(offer_id:string,shop_id:string,product_id='p1'):EnrichedOffer=>({offer_id,product_id,shop_id,price_toman:100,last_price_changed_at:'2026-10-01',seller_title:null,warranty:null,description:null,source:'torob_hackathon_dataset',price_status:'recorded',stock_status:'unknown',verification_status:'unknown',shop:{shop_id,name:null,address:null,location_label:null,lat:null,lon:null,weekly_hours:{},payment_options:[],category_names:[],website_url:null,instagram:null,supports_fast_delivery:null,identity_verified:false},distance_km:null,installment_eligible:false,payment_notes:[],freshness:{age_days:null,status:'unknown'},hours:{state:'unknown',label:'نامشخص',schedule_status:'unknown'},score:0,reasons:[]});
const offers=(...items:EnrichedOffer[]):UIBlock=>({type:'offers',title:'پیشنهادها',product:product('p1'),offers:items});
const shown=(blocks:UIBlock[])=>blocks.flatMap(b=>b.type==='offers'?b.offers:b.type==='store_discovery'?b.matches.map(m=>m.offer):b.type==='alternatives'?b.same_product:[]);
const products=(blocks:UIBlock[])=>blocks.flatMap(b=>b.type==='products'?b.products:b.type==='alternatives'?b.similar_products:[]);

describe('one recommendation window across streamed tool calls',()=>{
 it('caps all linked recommendations at five and shares shop deduplication across block kinds',()=>{
  const window=new RecommendationWindow();
  const first=window.apply([offers(offer('o1','s1'),offer('o1-other','s1'),offer('o2','s2'))]);
  const second=window.apply([{type:'store_discovery',title:'فروشگاه‌ها',query:'کفش',limited:true,matches:[{product:product('p2'),offer:offer('o3','s2','p2')},{product:product('p2'),offer:offer('o4','s3','p2')},{product:product('p3'),offer:offer('o5','s4','p3')}]}]);
  const third=window.apply([{type:'alternatives',product:product('p1'),same_product:[offer('o6','s5'),offer('o7','s6')],similar_products:[product('p4')],explanation:'جایگزین'}]);
  expect(shown([...first,...second,...third]).map(o=>o.offer_id)).toEqual(['o1','o2','o4','o5','o6']);
  expect(products(third)).toEqual([]);
  expect(shown(window.apply([offers(offer('o8','s7'))]))).toEqual([]);
 });
 it('shares the total with product cards and does not repeat a product card in later blocks',()=>{
  const window=new RecommendationWindow();
  const first=window.apply([{type:'products',title:'کالاها',products:[product('p1'),product('p1'),product('p2')]}]);
  const second=window.apply([{type:'alternatives',product:product('p1'),same_product:[offer('o1','s1')],similar_products:[product('p2'),product('p3'),product('p4'),product('p5')],explanation:'جایگزین'}]);
  expect(products(first).map(p=>p.product_id)).toEqual(['p1','p2']);
  expect(shown(second).map(o=>o.offer_id)).toEqual(['o1']);
  expect(products(second).map(p=>p.product_id)).toEqual(['p3','p4']);
 });
 it('allows the exact selected product in different shops and keeps original evidence intact',()=>{
  const original=offer('real-offer','real-shop');original.price_toman=250;original.price_toman_exact='250';
  const block=offers(original,offer('other-offer','other-shop'));
  const result=new RecommendationWindow().apply([block]);
  expect(shown(result).map(o=>[o.product_id,o.shop_id,o.price_toman,o.last_price_changed_at])).toEqual([['p1','real-shop',250,'2026-10-01'],['p1','other-shop',100,'2026-10-01']]);
  expect(shown(result)[0]).toBe(original);
  expect(block.type==='offers'&&block.offers).toHaveLength(2);
 });
 it('drops inconsistent product or shop linkage without consuming recommendation places',()=>{
  const window=new RecommendationWindow(),wrongProduct=offer('wrong-product','s1','p2'),wrongShop={...offer('wrong-shop','s1'),shop:offer('other','s2').shop};
  const result=window.apply([offers(wrongProduct,wrongShop,offer('valid','s1'))]);
  expect(shown(result).map(o=>o.offer_id)).toEqual(['valid']);
  const discovery=window.apply([{type:'store_discovery',title:'فروشگاه‌ها',query:'کفش',limited:true,matches:[{product:product('p3'),offer:offer('bad','s3','p4')},{product:product('p3'),offer:offer('good','s3','p3')}]}]);
  expect(shown(discovery).map(o=>o.offer_id)).toEqual(['good']);
 });
 it('does not repeat product cards already represented by linked recommendations',()=>{
  const window=new RecommendationWindow();window.apply([offers(offer('o1','s1'))]);
  expect(products(window.apply([{type:'products',title:'کالاها',products:[product('p1'),product('p2')]}])).map(p=>p.product_id)).toEqual(['p2']);
 });
 it('omits blocks emptied by the window but preserves genuine empty lookup results',()=>{
  const window=new RecommendationWindow();window.apply([offers(offer('o1','s1'))]);
  expect(window.apply([offers(offer('o2','s1'))])).toEqual([]);
  expect(window.apply([{type:'products',title:'کالاها',products:[product('p1')]}])).toEqual([]);
  expect(window.apply([{type:'store_discovery',title:'فروشگاه‌ها',query:'کفش',limited:true,matches:[{product:product('p1'),offer:offer('o3','s1')}]}])).toEqual([]);
  expect(window.apply([{type:'alternatives',product:product('p1'),same_product:[offer('o4','s1')],similar_products:[product('p1')],explanation:'جایگزین'}])).toEqual([]);
  const empty:UIBlock[]=[offers(),{type:'products',title:'کالاها',products:[]},{type:'store_discovery',title:'فروشگاه‌ها',query:'کفش',limited:true,matches:[]},{type:'alternatives',product:product('p1'),same_product:[],similar_products:[],explanation:'یافت نشد'}];
  expect(window.apply(empty)).toEqual(empty);
 });
 it('preserves explicit comparisons, inquiries, shop details and visit plans after exhausting recommendations',()=>{
  const window=new RecommendationWindow();window.apply([offers(...Array.from({length:7},(_,i)=>offer(`o${i}`,`s${i}`)))]);
  const item=offer('o1','s1');
  const explicit:UIBlock[]=[{type:'product_comparison',products:[product('p1'),product('p2')]},{type:'offer_comparison',product:product('p1'),offers:[item]},{type:'visit_plan',offers:[item],day:'2026-10-23',checklist:[]},{type:'inquiry',draft:'متن',offer_id:'o1',shop:item.shop},{type:'shop',shop:item.shop}];
  expect(window.apply(explicit)).toEqual(explicit);
 });
});
