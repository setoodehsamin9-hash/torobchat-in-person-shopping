import { randomUUID } from 'node:crypto';
import { hybridSearch } from '../retrieval/search';
import { embeddingConfig } from '../retrieval/core';
import * as catalog from '../catalog';
import { searchStoreOffers } from '../store-discovery';
import { query } from '../db/client';
import { getHourStatus, haversineKm } from '../domain';
import type { OfferFilters, Product, UIBlock, ToolEvent, InquiryRecord } from '../contracts';
import { outputSchemas, toolNameSchema, toolSchemas, type ToolName } from './schemas';

export class ToolError extends Error {
  constructor(message:string, public status=400){super(message);this.name='ToolError';}
}
const labels:Record<ToolName,string>={searchStoreOffers:'فروشگاه‌های دارای پیشنهاد واقعی برای جست‌وجو',searchProducts:'جست‌وجوی محصولات واقعی',getProductDetails:'جزئیات محصول',compareProducts:'مقایسه محصولات',getProductOffers:'فروشندگان ثبت‌شده',findNearbyStores:'فروشگاه‌های دارای پیشنهاد',getStoreDetails:'جزئیات فروشگاه',compareOffers:'مقایسه پیشنهادها',getStoreHours:'ساعات ثبت‌شده',getPaymentOptions:'شرایط پرداخت ثبت‌شده',buildInquiryDraft:'تهیه متن استعلام',recordInquiryStatus:'ثبت نتیجه با منبع',findAlternatives:'جایگزین با حفظ محدودیت‌ها',buildVisitPlan:'برنامه مراجعه'};
async function product(id:string){const p=await catalog.getProduct(id);if(!p)throw new ToolError('محصول در دیتاست یافت نشد.',404);return p;}
async function shop(id:string){const s=await catalog.getShop(id);if(!s)throw new ToolError('فروشگاه در دیتاست یافت نشد.',404);return s;}
async function offer(id:string){const o=await catalog.getOffer(id);if(!o)throw new ToolError('پیشنهاد در دیتاست یافت نشد.',404);return o;}
function blocksFor(name:ToolName,result:unknown):UIBlock[]{
  switch(name){
    case 'searchStoreOffers':return [{type:'store_discovery',title:'فروشگاه‌های دارای پیشنهاد مرتبط',...outputSchemas.searchStoreOffers.parse(result)}];
    case 'searchProducts':{const r=outputSchemas.searchProducts.parse(result);return [{type:'products',products:r.data,title:'محصولات مطابق جست‌وجو'}];}
    case 'getProductDetails':return [{type:'products',products:[outputSchemas.getProductDetails.parse(result)],title:'جزئیات محصول'}];
    case 'compareProducts':return [{type:'product_comparison',...outputSchemas.compareProducts.parse(result)}];
    case 'getProductOffers':case 'findNearbyStores':{const r=outputSchemas.getProductOffers.parse(result);return [{type:'offers',product:r.product,offers:r.data,title:'پیشنهادهای ثبت‌شده؛ موجودی نامشخص'}];}
    case 'getStoreDetails':return [{type:'shop',shop:outputSchemas.getStoreDetails.parse(result)}];
    case 'getStoreHours':return [{type:'store_hours',...outputSchemas.getStoreHours.parse(result)}];
    case 'getPaymentOptions':return [{type:'payment_options',...outputSchemas.getPaymentOptions.parse(result)}];
    case 'compareOffers':return [{type:'offer_comparison',...outputSchemas.compareOffers.parse(result)}];
    case 'buildInquiryDraft':return [{type:'inquiry',...outputSchemas.buildInquiryDraft.parse(result)}];
    case 'findAlternatives':return [{type:'alternatives',...outputSchemas.findAlternatives.parse(result)}];
    case 'buildVisitPlan':return [{type:'visit_plan',...outputSchemas.buildVisitPlan.parse(result)}];
    default:return [];
  }
}
async function execute(name:ToolName,raw:unknown):Promise<unknown>{
  switch(name){
    case 'searchStoreOffers':return searchStoreOffers(toolSchemas.searchStoreOffers.parse(raw));
    case 'searchProducts':{
      const p=toolSchemas.searchProducts.parse(raw);const minPrice=p.minPrice??p.budget?.min,maxPrice=p.maxPrice??p.budget?.max;
      if(minPrice!==undefined&&maxPrice!==undefined&&minPrice>maxPrice)throw new ToolError('بازه بودجه نامعتبر است.');
      // Preserve the existing paginated lexical API; semantic tool results are a bounded first-page shortlist.
      let semantic=false;try{semantic=embeddingConfig().enabled;}catch{}
      if(p.retrieval!=='lexical'&&semantic&&(!p.page||p.page===1)&&(!p.cursor||p.cursor==='1'))return hybridSearch({query:p.query,category:p.category,minPrice,maxPrice,limit:p.limit??12},{...p.filters,minPrice,maxPrice});
      const hardFilters=p.filters&&(p.filters.installmentOnly||p.filters.lat!==undefined||Boolean(p.filters.region));
      const candidates=await catalog.searchProducts({query:p.query,category:p.category,minPrice,maxPrice,filters:p.filters,page:p.page??(p.cursor?Number(p.cursor):1),limit:hardFilters?24:p.limit??12});
      if(!hardFilters)return candidates;
      const eligible:Product[]=[];
      for(const candidate of candidates.data){const linked=await catalog.getProductOffers(candidate.product_id,{...p.filters,minPrice,maxPrice,page:1,limit:1});if(linked.data.length)eligible.push({...candidate,reasons:[...(candidate.reasons??[]),'دارای پیشنهاد واقعی مطابق محدوده و شرایط پرداخت انتخابی؛ بررسی محدود به این صفحه نتایج']});if(eligible.length===(p.limit??12))break;}
      return {...candidates,data:eligible,total:eligible.length,limit:p.limit??12};
    }
    case 'getProductDetails':return product(toolSchemas.getProductDetails.parse(raw).productId);
    case 'compareProducts':{const p=toolSchemas.compareProducts.parse(raw);return {products:await Promise.all(p.productIds.map(product))};}
    case 'getProductOffers':{const p=toolSchemas.getProductOffers.parse(raw);await product(p.productId);return catalog.getProductOffers(p.productId,{...p.filters,...p.pagination,limit:p.pagination?.limit??p.filters.limit??12});}
    case 'findNearbyStores':{
      const p=toolSchemas.findNearbyStores.parse(raw);await product(p.productId);
      const filters:OfferFilters={...p.filters,...(p.latitude!==undefined?{lat:p.latitude,lng:p.longitude}:{}),...(p.radiusKm!==undefined?{radiusKm:p.radiusKm}:{}),...(p.installmentOnly!==undefined?{installmentOnly:p.installmentOnly}:{}),...(p.visitAt?{visitAt:p.visitAt}:{}),limit:20};
      const valid=toolSchemas.getProductOffers.parse({productId:p.productId,filters});return catalog.getProductOffers(p.productId,valid.filters);
    }
    case 'getStoreDetails':return shop(toolSchemas.getStoreDetails.parse(raw).shopId);
    case 'compareOffers':{const p=toolSchemas.compareOffers.parse(raw);const prod=await product(p.productId);const offers=await Promise.all(p.offerIds.map(offer));if(offers.some(o=>o.product_id!==p.productId))throw new ToolError('برای مقایسه فروشنده، همه پیشنهادها باید دقیقاً برای یک محصول باشند.');return {product:prod,offers};}
    case 'getStoreHours':{const p=toolSchemas.getStoreHours.parse(raw),s=await shop(p.shopId);return {shop_id:s.shop_id,weekly_hours:s.weekly_hours,status:getHourStatus(s.weekly_hours,p.dateTimeTehran),timezone:'Asia/Tehran',at:p.dateTimeTehran};}
    case 'getPaymentOptions':{const s=await shop(toolSchemas.getPaymentOptions.parse(raw).shopId);return {shop_id:s.shop_id,options:s.payment_options,disclaimer:'فقط کانال in_person همراه با دسته و بازه مبلغ مرتبط، شاهد اقساط حضوری است؛ شرایط امروز نیاز به استعلام دارد.'};}
    case 'buildInquiryDraft':{
      const p=toolSchemas.buildInquiryDraft.parse(raw),o=await offer(p.offerId);if((p.shopId&&p.shopId!==o.shop_id)||(p.productId&&p.productId!==o.product_id))throw new ToolError('شناسه‌های محصول و فروشگاه با این پیشنهاد مطابقت ندارد.');
      const prod=await product(o.product_id),price=o.price_toman===null?'نامشخص':`${o.price_toman.toLocaleString('fa-IR')} تومان`;
      return {offer_id:o.offer_id,shop:o.shop,draft:`سلام. درباره ${prod.persian_title??prod.model??prod.product_id} (شناسه محصول ${prod.product_id}، پیشنهاد ${o.offer_id}) سؤال دارم. قیمت ثبت‌شده ${price} و زمان آخرین تغییر ثبت‌شده ${o.last_price_changed_at??'نامشخص'} است؛ این اطلاعات زنده نیست. آیا امروز موجود است؟ قیمت امروز چقدر است؟ امکان خرید و پرداخت حضوری و مراجعه در ساعت مورد نظر وجود دارد؟ نشانی دقیق، پاساژ، طبقه و واحد چیست؟\nشماره‌های دیتاست آزمایشی‌اند؛ تماس واقعی با آن‌ها ممکن نیست. متن را فقط با اقدام خودتان در وب‌سایت یا اینستاگرام معتبر منتشرشده استفاده کنید.`};
    }
    case 'recordInquiryStatus':{
      const p=toolSchemas.recordInquiryStatus.parse(raw);await offer(p.offerId);
      const demo=process.env.DEMO_CONTACT_MODE==='true'||(process.env.DEMO_CONTACT_MODE===undefined&&process.env.NODE_ENV!=='production');
      if(p.channel==='simulation'&&!demo)throw new ToolError('شبیه‌سازی تماس در این محیط غیرفعال است.',403);
      const record:InquiryRecord={id:randomUUID(),offer_id:p.offerId,status:p.status,channel:p.channel,provenance:p.provenance,created_at:new Date().toISOString(),verification_status:p.channel==='simulation'?'simulated':'unknown'};
      await query('INSERT INTO inquiry_records (id,offer_id,status,channel,provenance,created_at,verification_status) VALUES ($1,$2,$3,$4,$5,$6,$7)',[record.id,record.offer_id,record.status,record.channel,record.provenance,record.created_at,record.verification_status]);return record;
    }
    case 'findAlternatives':{
      const p=toolSchemas.findAlternatives.parse(raw),prod=await product(p.productId),filters={...p.constraints,page:1,limit:40};
      const candidates=await catalog.getProductOffers(p.productId,filters),excluded=new Set(p.excludeOfferIds);
      const same_product=candidates.data.filter(o=>!excluded.has(o.offer_id)).slice(0,20);const similar_products:Product[]=[];
      if(prod.category_name){const similar=await catalog.searchProducts({category:prod.category_name,minPrice:p.constraints.minPrice,maxPrice:p.constraints.maxPrice,page:1,limit:16});
        for(const candidate of similar.data){if(candidate.product_id===prod.product_id)continue;const matches=await catalog.getProductOffers(candidate.product_id,{...filters,limit:1});if(matches.data.length){similar_products.push(candidate);if(similar_products.length===6)break;}}
      }
      return {product:prod,same_product,similar_products,explanation:'ابتدا فروشندگان دیگر همین شناسه محصول، سپس مدل‌های دسته یکسان با پیشنهاد واقعی مطابق بودجه، محدوده و اقساط انتخاب شده‌اند. هیچ محدودیتی تغییر نکرده؛ نتایج محدود و موجودی همه نامشخص است. برای یافتن گزینه‌های بیشتر می‌توانید محدودیت‌ها را خودتان تغییر دهید.'};
    }
    case 'buildVisitPlan':{
      const p=toolSchemas.buildVisitPlan.parse(raw),day=p.day??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(!Number.isFinite(Date.parse(`${day}T12:00:00+03:30`))||new Date(`${day}T12:00:00+03:30`).toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'})!==day)throw new ToolError('روز مراجعه نامعتبر است.');
      const offers=(await Promise.all(p.offerIds.map(offer))).map(o=>({...o,hours:getHourStatus(o.shop.weekly_hours,`${day}T12:00:00+03:30`),distance_km:p.location&&o.shop.lat!==null&&o.shop.lon!==null?haversineKm(p.location.lat,p.location.lng,o.shop.lat,o.shop.lon):null}));
      if(p.location)offers.sort((a,b)=>(a.distance_km??Infinity)-(b.distance_km??Infinity));
      return {offers,day,checklist:['قبل از حرکت، موجودی و قیمت امروز را از کانال عمومی معتبر استعلام کنید.','ساعات، برنامه ثبت‌شده با منطقه زمانی تهران است؛ بازبودن زنده تأیید نشده. وضعیت کارت‌ها برای ساعت ۱۲ روز انتخابی بررسی شده است.','فاصله‌ها خط مستقیم هستند؛ زمان سفر یا مسیر بهینه محاسبه نشده.','نشانی پاساژ، طبقه و واحد را فقط از نشانی ثبت‌شده یا پاسخ معتبر بررسی کنید.','شرایط پرداخت حضوری، گارانتی و قیمت نهایی را تأیید کنید.']};
    }
  }
}

export async function runTool(rawName:unknown,input:unknown):Promise<{result:unknown;blocks:UIBlock[];event:ToolEvent}>{
  const name=toolNameSchema.parse(rawName),started=performance.now();
  const result=outputSchemas[name].parse(await execute(name,input));
  return {result,blocks:blocksFor(name,result),event:{tool:name,label:labels[name],status:'complete',duration_ms:Math.round(performance.now()-started)}};
}
export const toolLabels=labels;
