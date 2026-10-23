import { z } from 'zod';

const id = z.string().trim().min(1).max(160);
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().max(1000);
const nullableText = text.nullable();
const pagination = {page:z.number().int().min(1).max(10000).optional(),limit:z.number().int().min(1).max(40).optional()};
export const locationSchema = z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).strict();
const filterShape = {minPrice:money.optional(),maxPrice:money.optional(),lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional(),radiusKm:z.number().positive().max(100).optional(),installmentOnly:z.boolean().optional(),region:z.string().max(160).optional(),sort:z.enum(['rank','price','distance','hours']).optional(),visitAt:z.iso.datetime({offset:true}).optional(),...pagination};
export const filtersSchema=z.object(filterShape).strict().superRefine((v,c)=>{
  if((v.lat===undefined)!==(v.lng===undefined))c.addIssue({code:'custom',message:'هر دو مختصات لازم است'});
  if(v.radiusKm!==undefined && v.lat===undefined)c.addIssue({code:'custom',message:'شعاع به موقعیت نیاز دارد'});
  if(v.minPrice!==undefined&&v.maxPrice!==undefined&&v.minPrice>v.maxPrice)c.addIssue({code:'custom',message:'بازه بودجه نامعتبر است'});
});
const productIds=z.array(id).min(2).max(4).refine(a=>new Set(a).size===a.length,'شناسه تکراری');
const offerIds=z.array(id).min(1).max(8).refine(a=>new Set(a).size===a.length,'شناسه تکراری');
export const toolSchemas={
  searchStoreOffers:z.object({query:z.string().trim().min(1).max(300),filters:filtersSchema.optional(),limit:z.number().int().min(1).max(12).default(12)}).strict(),
  searchProducts:z.object({retrieval:z.literal('lexical').optional(),query:z.string().max(300).default(''),category:z.string().max(160).optional(),budget:z.object({min:money.optional(),max:money.optional()}).strict().optional(),minPrice:money.optional(),maxPrice:money.optional(),filters:filtersSchema.optional(),...pagination,cursor:z.string().regex(/^\d+$/).max(5).optional()}).strict(),
  getProductDetails:z.object({productId:id}).strict(),
  compareProducts:z.object({productIds}).strict(),
  getProductOffers:z.object({productId:id,filters:filtersSchema.default({}),pagination:z.object(pagination).strict().optional()}).strict(),
  findNearbyStores:z.object({productId:id,latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),radiusKm:z.number().positive().max(100).optional(),installmentOnly:z.boolean().optional(),visitAt:z.iso.datetime({offset:true}).optional(),filters:filtersSchema.optional()}).strict().refine(v=>(v.latitude===undefined)===(v.longitude===undefined),'هر دو مختصات لازم است'),
  getStoreDetails:z.object({shopId:id}).strict(),
  compareOffers:z.object({productId:id,offerIds:offerIds.refine(a=>a.length>=2,'حداقل دو فروشنده')}).strict(),
  getStoreHours:z.object({shopId:id,dateTimeTehran:z.iso.datetime({offset:true})}).strict(),
  getPaymentOptions:z.object({shopId:id}).strict(),
  buildInquiryDraft:z.object({offerId:id,shopId:id.optional(),productId:id.optional()}).strict(),
  recordInquiryStatus:z.object({offerId:id,status:z.enum(['available','not_available','unanswered','price_changed']),channel:z.enum(['simulation','user_entered']),provenance:z.enum(['simulation','user_reported'])}).strict().refine(v=>(v.channel==='simulation')===(v.provenance==='simulation'),'منبع استعلام ناسازگار است'),
  findAlternatives:z.object({productId:id,constraints:filtersSchema.default({}),reason:z.string().max(300).default('unanswered'),excludeOfferIds:z.array(id).max(8).default([])}).strict(),
  buildVisitPlan:z.object({offerIds,day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),location:locationSchema.optional()}).strict(),
};
export type ToolName=keyof typeof toolSchemas;
export const toolNameSchema=z.enum(Object.keys(toolSchemas) as [ToolName,...ToolName[]]);
export const sessionSchema=z.object({query:z.string().max(300).optional(),product_id:id.optional(),selected_product_ids:z.array(id).max(4).optional(),selected_offer_ids:z.array(id).max(8).optional(),maxPrice:money.optional(),minPrice:money.optional(),lat:filterShape.lat,lng:filterShape.lng,radiusKm:filterShape.radiusKm,region:filterShape.region,sort:filterShape.sort,installmentOnly:filterShape.installmentOnly,visitAt:filterShape.visitAt,intent:z.string().max(160).optional()}).strict().superRefine((v,c)=>{const p=filtersSchema.safeParse(Object.fromEntries(Object.entries(v).filter(([k])=>k in filterShape)));if(!p.success)c.addIssue({code:'custom',message:'محدودیت‌های نشست نامعتبر است'});});
export const chatInputSchema=z.object({
  interaction:z.enum(['show_stores','nearby_stores','credit_stores']).optional(),
  message:z.string().trim().min(1).max(2000),session:sessionSchema.default({}),
  history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().max(800)}).strict()).max(6).default([]),
  context:z.object({products:z.array(z.object({product_id:id,title:z.string().max(200)}).strict()).max(12).default([]),offers:z.array(z.object({offer_id:id,product_id:id,shop_id:id}).strict()).max(20).default([])}).strict().default({products:[],offers:[]})
}).strict();
const payment=z.object({provider_name:text,channel:text,category_names:z.array(text),min_price_toman:money.nullable(),max_price_toman:money.nullable()});
const hours=z.record(z.string(),z.object({status:text,shifts:z.array(z.object({start_time:text,end_time:text}))}));
export const productSchema=z.object({product_id:id,persian_title:nullableText,brand_name:nullableText,category_name:nullableText,model:nullableText,image_urls:z.array(z.string()),specs:z.array(z.object({key:text,value:z.string().max(10000),section:text.optional()})),min_price_toman:money.nullable(),max_price_toman:money.nullable(),offer_count:z.number().int().nonnegative(),reasons:z.array(text).optional()});
export const shopSchema=z.object({shop_id:id,name:nullableText,address:z.string().nullable(),location_label:nullableText,lat:z.number().nullable(),lon:z.number().nullable(),weekly_hours:hours,payment_options:z.array(payment),category_names:z.array(text),website_url:z.string().nullable(),instagram:z.string().nullable(),supports_fast_delivery:nullableText,identity_verified:z.literal(false)});
const hourStatus=z.object({state:z.enum(['fits_reported','outside_reported','unknown']),label:text,schedule_status:z.enum(['reported','unknown'])});
export const offerSchema=z.object({offer_id:id,product_id:id,shop_id:id,price_toman:money.nullable(),price_toman_exact:z.string().regex(/^\d+$/).optional(),price_validation:z.literal('unsafe_integer').optional(),last_price_changed_at:z.string().nullable(),seller_title:nullableText,warranty:nullableText,description:z.string().nullable(),source:z.literal('torob_hackathon_dataset'),price_status:z.literal('recorded'),stock_status:z.literal('unknown'),verification_status:z.literal('unknown'),shop:shopSchema,distance_km:z.number().nonnegative().nullable(),installment_eligible:z.boolean(),payment_notes:z.array(z.string()),freshness:z.object({age_days:z.number().int().nonnegative().nullable(),status:z.enum(['recent','aging','stale','unknown'])}),hours:hourStatus,score:z.number(),reasons:z.array(z.string())});
const page=<T extends z.ZodType>(schema:T)=>z.object({data:z.array(schema).max(40),total:z.number().int().nonnegative(),page:z.number().int().positive(),limit:z.number().int().positive(),timing_ms:z.number().optional()});
export const inquiryRecordSchema=z.object({id,offer_id:id,status:z.enum(['available','not_available','unanswered','price_changed']),channel:z.enum(['simulation','user_entered']),provenance:z.enum(['simulation','user_reported']),created_at:z.string(),verification_status:z.enum(['simulated','unknown'])});
const storeDiscoveryMatch=z.object({product:productSchema,offer:offerSchema}).refine(v=>v.product.product_id===v.offer.product_id&&v.offer.shop_id===v.offer.shop.shop_id,'شناسه محصول یا فروشگاه با پیشنهاد سازگار نیست');
export const storeDiscoveryOutputSchema=z.object({query:z.string().max(300),matches:z.array(storeDiscoveryMatch).max(12),limited:z.literal(true)}).refine(v=>new Set(v.matches.map(m=>m.offer.offer_id)).size===v.matches.length,'شناسه پیشنهاد تکراری است');
export const outputSchemas={searchStoreOffers:storeDiscoveryOutputSchema,searchProducts:page(productSchema),getProductDetails:productSchema,compareProducts:z.object({products:z.array(productSchema).max(4)}),getProductOffers:page(offerSchema).extend({product:productSchema,disclaimer:z.string()}),findNearbyStores:page(offerSchema).extend({product:productSchema,disclaimer:z.string()}),getStoreDetails:shopSchema,compareOffers:z.object({product:productSchema,offers:z.array(offerSchema).max(8)}),getStoreHours:z.object({shop_id:id,weekly_hours:hours,status:hourStatus,timezone:z.literal('Asia/Tehran'),at:z.string()}),getPaymentOptions:z.object({shop_id:id,options:z.array(payment),disclaimer:z.string()}),buildInquiryDraft:z.object({draft:z.string(),offer_id:id,shop:shopSchema}),recordInquiryStatus:inquiryRecordSchema,findAlternatives:z.object({product:productSchema,same_product:z.array(offerSchema).max(20),similar_products:z.array(productSchema).max(6),explanation:z.string()}),buildVisitPlan:z.object({offers:z.array(offerSchema).max(8),day:z.string(),checklist:z.array(z.string())})};
