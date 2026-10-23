import {getOffer,getProduct} from '../catalog';
import {haversineKm} from '../domain';
import {ToolError} from '../agent/tools';
import {journeyInputSchema,type JourneyResult,type JourneyStop} from './contracts';
import {neshanDirection,NeshanError} from './neshan';
export async function planJourney(raw:unknown):Promise<JourneyResult>{
  const input=journeyInputSchema.parse(raw),product=await getProduct(input.productId);if(!product)throw new ToolError('محصول پیدا نشد.',404);
  const stops:JourneyStop[]=[];
  for(const id of input.offerIds){
    const offer=await getOffer(id);if(!offer||offer.product_id!==input.productId)throw new ToolError('پیشنهاد باید برای همین محصول ثبت شده باشد.');
    const f=input.filters,p=offer.price_toman,s=offer.shop;
    if((f.minPrice!==undefined&&(p===null||p<f.minPrice))||(f.maxPrice!==undefined&&(p===null||p>f.maxPrice))||(f.installmentOnly&&!offer.installment_eligible)||(f.region&&f.region!==s.location_label)||(f.lat!==undefined&&f.lng!==undefined&&f.radiusKm!==undefined&&(s.lat===null||s.lon===null||haversineKm(f.lat,f.lng,s.lat,s.lon)>f.radiusKm)))throw new ToolError('فروشگاه با شرایط خرید فعلی سازگار نیست.');
    if(s.lat===null||s.lon===null||!Number.isFinite(s.lat)||!Number.isFinite(s.lon)||Math.abs(s.lat)>90||Math.abs(s.lon)>180)throw new ToolError('مختصات ثبت‌شده فروشگاه نامشخص است.');
    if(!stops.some(stop=>stop.shopId===s.shop_id))stops.push({offerId:id,shopId:s.shop_id,name:s.name||'نام فروشگاه نامشخص',lat:s.lat,lng:s.lon,recordedPriceToman:p});
  }
  if(!process.env.NESHAN_API_KEY)return {status:'configuration_required',source:'neshan',message:'مسیریابی نشان هنوز تنظیم نشده است؛ زمان رسیدن نامشخص است. نقشه و آدرس‌های ثبت‌شده در دسترس‌اند.'};
  try{
    let ordered=stops;
    if(input.strategy==='connect'){
      const remaining=[...stops];ordered=[];let from=input.origin;
      while(remaining.length){remaining.sort((a,b)=>haversineKm(from.lat,from.lng,a.lat,a.lng)-haversineKm(from.lat,from.lng,b.lat,b.lng)||a.shopId.localeCompare(b.shopId));const stop=remaining.shift()!;ordered.push(stop);from=stop;}
      const {calculatedAt,...route}=await neshanDirection(input.origin,ordered,input.travelMode);
      return {status:'ready',source:'neshan',travelMode:input.travelMode,strategy:input.strategy,route:{...route,stops:ordered,ordering:'straight_line_heuristic'},scope:'مسیر اتصال فروشگاه‌های انتخاب‌شدهٔ همین محصول',candidateCount:stops.length,partial:false,calculatedAt,note:'ترتیب توقف‌ها پیشنهادی و براساس فاصله مستقیم است، نه بهینه قطعی. زمان و مسیر از نشان است؛ موجودی فروشگاه‌ها تأیید نشده است.'};
    }
    const routes=await Promise.allSettled(stops.map(async stop=>({...(await neshanDirection(input.origin,[stop],input.travelMode)),stops:[stop]})));
    const ready=routes.flatMap(r=>r.status==='fulfilled'?[r.value]:[]).sort((a,b)=>a.durationSeconds-b.durationSeconds||a.distanceMeters-b.distanceMeters);
    if(!ready.length){if(routes.some(r=>r.status==='rejected'&&r.reason instanceof NeshanError&&r.reason.code==='daily_limit'))throw new NeshanError('daily_limit');throw new NeshanError('unavailable');}
    const {calculatedAt,...route}=ready[0];
    return {status:'ready',source:'neshan',travelMode:input.travelMode,strategy:input.strategy,route:{...route,ordering:'single_destination'},scope:'کمترین زمان رسیدن بین فروشگاه‌های انتخاب‌شده؛ همه فروشگاه‌های تهران بررسی نشده‌اند',candidateCount:stops.length,partial:ready.length!==stops.length,calculatedAt,note:'زمان تخمینی نشان است و ممکن است تغییر کند؛ قیمت و موجودی زنده تأیید نشده‌اند.'};
  }catch(error){return error instanceof NeshanError&&error.code==='daily_limit'?{status:'daily_limit',source:'neshan',message:'سقف روزانه مسیریابی این برنامه پر شده است؛ زمان رسیدن نامشخص است.'}:{status:'unavailable',source:'neshan',message:'مسیر قابل اتکا از نشان دریافت نشد؛ زمان رسیدن نامشخص است. دوباره با اقدام خودتان تلاش کنید.'};}
}
