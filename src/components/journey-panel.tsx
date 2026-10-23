'use client';
import {useState} from 'react';
import {Car,Footprints,Route,MapPin} from 'lucide-react';
import type {EnrichedOffer,Product,PurchaseSession} from '@/lib/contracts';
import type {JourneyResult} from '@/lib/journeys/contracts';
import {api,fa,money,offerFilters} from '@/lib/client';
import {ShopMap} from './location';
export function JourneyPanel({product,offers,session={}}:{product:Product;offers:EnrichedOffer[];session?:PurchaseSession}){
  const candidates=Array.from(new Map(offers.filter(o=>o.product_id===product.product_id&&o.shop.lat!==null&&o.shop.lon!==null).map(o=>[o.shop_id,o])).values()).slice(0,6);
  const [selected,setSelected]=useState<string[]>(()=>candidates.slice(0,3).map(o=>o.offer_id));
  const [mode,setMode]=useState<'car'|'walking'>('car'),[strategy,setStrategy]=useState<'nearest'|'connect'>('nearest'),[consent,setConsent]=useState(false),[result,setResult]=useState<JourneyResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [signature,setSignature]=useState('');
  const current=JSON.stringify({origin:[session.lat,session.lng],selected,mode,strategy,filters:offerFilters(session)});
  const active=result&&current===signature?result:null;
  const chosen=candidates.filter(o=>selected.includes(o.offer_id));
  async function route(){if(session.lat===undefined||session.lng===undefined)return;setBusy(true);setError('');setResult(null);setSignature(current);try{setResult(await api<JourneyResult>('/api/journeys/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:product.product_id,offerIds:chosen.map(o=>o.offer_id),origin:{lat:session.lat,lng:session.lng},consent,travelMode:mode,strategy,filters:offerFilters(session)})}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="journey-panel" aria-label="مسیر خرید حضوری"><div className="journey-title"><span className="journey-icon"><Route size={23}/></span><div><span className="eyebrow">قدم بعدی: مراجعه</span><h3>این کالا را کجا ببینم؟</h3><p>{product.persian_title||'کالای انتخاب‌شده'}</p></div></div>
    <ShopMap offers={chosen} product={product} location={session} path={active?.status==='ready'?active.route.path:undefined}/>
    {candidates.length?<><fieldset className="journey-stores"><legend>فروشگاه‌های دارای پیشنهاد همین شناسه کالا</legend>{candidates.map(o=><label key={o.offer_id}><input type="checkbox" checked={selected.includes(o.offer_id)} onChange={()=>{setSelected(old=>old.includes(o.offer_id)?old.filter(id=>id!==o.offer_id):[...old,o.offer_id]);setConsent(false);}}/><span>{o.shop.name||'نام نامشخص'}<small>{money(o.price_toman)} · قیمت ثبت‌شده</small></span></label>)}</fieldset>
    <div className="journey-options"><label>روش رفتن<select aria-label="روش رفتن" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="walking">پیاده</option><option value="car">با خودرو</option></select></label><label>نوع مسیر<select aria-label="نوع مسیر" value={strategy} onChange={e=>setStrategy(e.target.value as typeof strategy)}><option value="nearest">کمترین زمان تا یک فروشگاه</option><option value="connect">اتصال فروشگاه‌های انتخاب‌شده</option></select></label></div>
    {session.lat===undefined||session.lng===undefined?<p className="journey-notice"><MapPin size={16}/> ابتدا در «شرایط خرید شما»، محله یا نقطه شروع را انتخاب کن.</p>:null}
    <label className="checkbox-label journey-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>با ارسال نقطه انتخاب‌شده به نشان برای محاسبه مسیر موافقم.<small>فقط با زدن دکمه درخواست ارسال می‌شود؛ تا {fa(strategy==='nearest'?chosen.length:1)} درخواست مسیریابی. مختصات در گزارش برنامه ذخیره نمی‌شود.</small></span></label>
    <button className="btn primary" disabled={busy||!consent||!chosen.length||session.lat===undefined||session.lng===undefined} onClick={route}>{mode==='car'?<Car size={17}/>:<Footprints size={17}/>} {busy?'دریافت مسیر…':'دریافت مسیر از نشان'}</button>
    {busy&&<p role="status">زمان رسیدن فقط پس از پاسخ نشان نمایش داده می‌شود…</p>}{error&&<p role="alert">{error}</p>}{active&&active.status!=='ready'&&<p role="status" className="journey-notice">{active.message}</p>}{active?.status==='ready'&&<div className="journey-result" role="status"><strong>{fa(Math.ceil(active.route.durationSeconds/60))} دقیقه · {fa(Math.round(active.route.distanceMeters))} متر</strong><span>{mode==='car'?'با خودرو':'پیاده'} · تخمین نشان</span><p>{active.scope}</p>{active.partial&&<p>پاسخ بعضی فروشگاه‌ها دریافت نشد؛ نتیجه مقایسه کامل نیست.</p>}<ol>{active.route.stops.map(s=><li key={s.shopId}>{s.name}</li>)}</ol><p>{active.note}</p><small>محاسبه: {new Date(active.calculatedAt).toLocaleTimeString('fa-IR')}</small></div>}
    </>:<p>مختصات معتبر فروشگاه برای این نتیجه ثبت نشده؛ زمان رسیدن نامشخص است.</p>}
  </section>;
}
