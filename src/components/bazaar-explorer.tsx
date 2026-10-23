'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback,useEffect,useRef,useState } from 'react';
import { ArrowRight,ArrowUp,Check,ChevronLeft,Clock,CreditCard,Lightbulb,LocateFixed,Moon,Plus,Store,Sun } from 'lucide-react';
import type { BazaarHub,BazaarResult } from '@/lib/bazaar';
import type { BazaarAnswer } from '@/lib/bazaar-ask';
import { api,fa,money } from '@/lib/client';
import { useIds } from '@/lib/session';
import { basemaps,type Basemap } from './bazaar-basemaps';
import { BrandMark } from './brand-mark';
import './bazaar.css';

const BazaarMap=dynamic(()=>import('./bazaar-map'),{ssr:false,loading:()=><div className="bazaar-map-loading">در حال آماده‌سازی نقشه…</div>});
const starters=['دوربین مدار بسته','گوشی موبایل','سیم و کابل برق','ساعت مچی','چراغ پنلی','هدفون'];
const questions=(hub?:BazaarHub)=>hub?['از کدام پاساژ شروع کنم؟',`ارزان‌ترین در ${hub.name} کجاست؟`,'الان کدام‌ها بازند؟','قسطی هم می‌فروشند؟']:['بورس اصلی کجاست؟','ارزان‌ترین کجاست؟','نزدیک‌ترین راسته به من','راسته‌ها را مقایسه کن'];
const steps=[{title:'اسم کالا را بنویس',text:'مثلاً گوشی یا لوستر'},{title:'یک راسته را انتخاب کن',text:'جایی که فروشنده‌ها جمع‌اند'},{title:'از نقشه بپرس',text:'ارزان‌ترین، پاساژ، ساعت کار'}];

export function BazaarExplorer({initialQuery,initialHubId}:{initialQuery:string;initialHubId?:string}){
 const [input,setInput]=useState(initialQuery),[query,setQuery]=useState(initialQuery);
 const [result,setResult]=useState<BazaarResult|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [hubId,setHubId]=useState(initialHubId),[shopId,setShopId]=useState<string>(),[mall,setMall]=useState<string>();
 const [question,setQuestion]=useState(''),[answer,setAnswer]=useState<BazaarAnswer|null>(null),[asking,setAsking]=useState(false),[askError,setAskError]=useState('');
 const [location,setLocation]=useState<[number,number]>(),[basemap,setBasemap]=useState<Basemap>('dark');
 const visit=useIds('torob-visit-offers');
 const listRef=useRef<HTMLDivElement>(null);
 const hub=result?.hubs.find(item=>item.hub_id===hubId);

 const syncUrl=useCallback((next:{q?:string;hub?:string})=>{const url=new URL(window.location.href);for(const [key,value] of Object.entries(next)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}window.history.replaceState(null,'',url);},[]);
 useEffect(()=>{
  if(query.trim().length<2){setResult(null);return;}
  const abort=new AbortController();setLoading(true);setError('');setAnswer(null);
  api<BazaarResult>(`/api/bazaar?q=${encodeURIComponent(query)}`,{signal:abort.signal}).then(value=>{setResult(value);setHubId(current=>value.hubs.some(item=>item.hub_id===current)?current:undefined);}).catch((e:Error)=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[query]);
 useEffect(()=>{try{const saved=localStorage.getItem('torob-bazaar-basemap');if(saved&&saved in basemaps)setBasemap(saved as Basemap);}catch{}},[]);

 const search=(text:string)=>{const value=text.trim();if(value.length<2)return;setInput(value);setQuery(value);setHubId(undefined);setShopId(undefined);setMall(undefined);syncUrl({q:value,hub:undefined});};
 const selectHub=(id?:string)=>{setHubId(id);setShopId(undefined);setMall(undefined);syncUrl({hub:id});
  // On phones the details sit under the map; bring them up to meet the selection.
  if(id&&window.innerWidth<=900)requestAnimationFrame(()=>document.getElementById('hub-title')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));};
 const selectShop=(nextHub:string,id:string)=>{if(nextHub!==hubId){setHubId(nextHub);setMall(undefined);syncUrl({hub:nextHub});}setShopId(id);requestAnimationFrame(()=>listRef.current?.querySelector(`[data-shop="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));};
 const chooseBasemap=(value:Basemap)=>{setBasemap(value);try{localStorage.setItem('torob-bazaar-basemap',value);}catch{}};
 const locate=()=>new Promise<[number,number]|undefined>(resolve=>{if(!navigator.geolocation){setAskError('مرورگر از موقعیت‌یابی پشتیبانی نمی‌کند.');resolve(undefined);return;}navigator.geolocation.getCurrentPosition(position=>{const point:[number,number]=[position.coords.latitude,position.coords.longitude];setLocation(point);resolve(point);},()=>{setAskError('اجازهٔ موقعیت داده نشد؛ پرسش‌های دیگر همچنان کار می‌کنند.');resolve(undefined);},{timeout:10000});});
 async function ask(text:string,point=location){
  const value=text.trim();if(value.length<2||!result)return;
  setQuestion(value);setAsking(true);setAskError('');
  try{
   const reply=await api<BazaarAnswer>('/api/bazaar/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,question:value,hub_id:hubId,...(point?{lat:point[0],lng:point[1]}:{})})});
   if(reply.needs_location&&!point){const found=await locate();if(found){await ask(value,found);return;}}
   setAnswer(reply);
   if(reply.hub_id&&reply.hub_id!==hubId){setHubId(reply.hub_id);setMall(undefined);syncUrl({hub:reply.hub_id});}
   setShopId(reply.shop_ids[0]);
  }catch(e){setAskError(e instanceof Error?e.message:'پاسخ دریافت نشد.');}
  finally{setAsking(false);}
 }

 const shops=hub?hub.shops.filter(shop=>!mall||shop.mall===mall):[];
 const maxShops=Math.max(1,...(result?.hubs.map(item=>item.shop_count)??[1]));
 return <main id="main" className="bazaar" dir="rtl">
  <aside className="bazaar-panel" aria-label="جست‌وجو و راسته‌ها">
   <header className="bazaar-head">
    <Link href="/chat" className="bazaar-back" aria-label="بازگشت به گفت‌وگو"><ArrowRight size={20}/></Link>
    <span className="bazaar-brand"><BrandMark/>ترب‌چت</span>
    <span className="bazaar-tag">بورس‌یاب</span>
   </header>
   {!query&&<section className="bazaar-welcome" aria-labelledby="bazaar-title">
    <span className="bazaar-welcome-mark"><BrandMark/></span>
    <p className="bazaar-kicker">برای خرید حضوری در تهران</p>
    <h1 id="bazaar-title">این کالا را کجای تهران بخرم؟</h1>
    <p>اسم کالا را بنویس؛ روی نقشه نشانت می‌دهیم فروشنده‌هایش در کدام خیابان و پاساژ جمع شده‌اند.</p>
   </section>}
   <form className="bazaar-composer" role="search" onSubmit={event=>{event.preventDefault();search(input);}}>
    <label htmlFor="bazaar-q" className="sr-only">اسم کالا</label>
    <input id="bazaar-q" value={input} onChange={event=>setInput(event.target.value)} placeholder="چه کالایی می‌خواهی؟ مثلاً دوربین مدار بسته" autoComplete="off" maxLength={120}/>
    <button type="submit" disabled={input.trim().length<2||loading} aria-label="پیدا کردن راسته‌ها"><ArrowUp size={22}/></button>
   </form>
   {!query&&<>
    <div className="bazaar-starters" aria-label="نمونه‌ها">{starters.map(item=><button type="button" key={item} onClick={()=>search(item)}>{item}</button>)}</div>
    <ol className="bazaar-steps" aria-label="مراحل کار">{steps.map((step,index)=><li key={step.title}><b>{fa(index+1)}</b><span><strong>{step.title}</strong><small>{step.text}</small></span></li>)}</ol>
   </>}
   {loading&&<p className="bazaar-status" role="status"><BrandMark busy/>دارم فروشنده‌های «{query}» را روی نقشه پیدا می‌کنم…</p>}
   {error&&<p className="bazaar-status is-error" role="alert">{error}</p>}
   {result&&!loading&&<>
    {result.hubs.length>0&&<p className="bazaar-hint" role="status"><Lightbulb size={17} aria-hidden/>{hub?'یک پاساژ را انتخاب کن تا فروشنده‌هایش را ببینی، یا پایین صفحه از نقشه بپرس.':'روی یکی از راسته‌ها بزن تا پاساژها و فروشنده‌هایش را ببینی.'}</p>}
    {!hub&&<p className="bazaar-summary">«{result.query}» در {fa(result.total_shops)} فروشگاه پیدا شد{result.hubs.length?`؛ بیشترشان در ${fa(result.hubs.length)} راسته جمع‌اند.`:'.'}</p>}
    {!result.hubs.length&&<p className="bazaar-status" role="status">فروشنده‌ها پراکنده‌اند و راسته‌ای با دست‌کم دو فروشگاه پیدا نشد. اسم کالا را کلی‌تر بنویس، مثلاً «گوشی» به‌جای مدل دقیق.</p>}
    {!hub&&result.hubs.length>0&&<section aria-labelledby="hubs-title">
     <h2 id="hubs-title" className="bazaar-h2">کجا بیشتر فروشنده دارد؟</h2>
     <ol className="bazaar-hubs">{result.hubs.map(item=><li key={item.hub_id}><button type="button" className="bazaar-hub" onClick={()=>selectHub(item.hub_id)}>
      <span className="bazaar-hub-name"><strong>{item.name}</strong>{item.primary&&<em>بورس اصلی</em>}</span>
      <span className="bazaar-hub-street">{item.street_label}{item.region?`، محدودهٔ ${item.region}`:''}</span>
      <span className="bazaar-hub-bar" aria-hidden><span style={{inlineSize:`${Math.max(6,item.shop_count/maxShops*100)}%`}}/></span>
      <span className="bazaar-hub-facts"><span>{fa(item.shop_count)} فروشگاه</span>{item.malls.length>0&&<span>{fa(item.malls.length)} پاساژ</span>}<span className="bazaar-price">از {money(item.min_price_toman)}</span></span>
      <ChevronLeft className="bazaar-hub-go" size={18} aria-hidden/>
     </button></li>)}</ol>
     {result.scattered_shops>0&&<p className="bazaar-note">{fa(result.scattered_shops)} فروشگاه دیگر هم هست که در هیچ راسته‌ای جمع نشده‌اند.</p>}
    </section>}
    {hub&&<section className="bazaar-detail" aria-labelledby="hub-title">
     <button type="button" className="bazaar-up" onClick={()=>selectHub(undefined)}><ArrowRight size={16}/>همهٔ راسته‌ها</button>
     <h2 id="hub-title">راستهٔ {hub.name}{hub.primary&&<em>بورس اصلی</em>}</h2>
     <p className="bazaar-hub-street">{hub.street_label}{hub.region?`، محدودهٔ ${hub.region}`:''}</p>
     <ul className="bazaar-facts">
      <li><Store size={16}/>{fa(hub.shop_count)} فروشگاه با {fa(hub.product_count)} مدل کالا</li>
      <li><Clock size={16}/>{hub.hours_known_count?`${fa(hub.open_count)} فروشگاه طبق ساعت ثبت‌شده الان باز است`:'ساعت کاری ثبت نشده'}</li>
      <li><CreditCard size={16}/>{hub.installment_count?`${fa(hub.installment_count)} فروشگاه فروش قسطی حضوری ثبت کرده‌اند`:'فروش قسطی حضوری ثبت نشده'}</li>
     </ul>
     {hub.malls.length>0&&<><h3 className="bazaar-h3">پاساژها</h3><div className="bazaar-malls" role="group" aria-label="انتخاب پاساژ">
      <button type="button" aria-pressed={!mall} onClick={()=>setMall(undefined)}>همه<small>{fa(hub.shops.length)}</small></button>
      {hub.malls.map(item=><button type="button" key={item.name} aria-pressed={mall===item.name} onClick={()=>setMall(mall===item.name?undefined:item.name)}>{item.name}<small>{fa(item.shop_count)}</small></button>)}
     </div></>}
     <h3 className="bazaar-h3">فروشنده‌ها{mall?` در ${mall}`:''}<small>ارزان‌ترین اول</small></h3>
     <div className="bazaar-shops" ref={listRef}>{shops.map(shop=><article key={shop.shop_id} data-shop={shop.shop_id} className={`bazaar-shop ${shop.shop_id===shopId?'is-selected':''} ${answer?.shop_ids.includes(shop.shop_id)?'is-lit':''}`}>
      <button type="button" className="bazaar-shop-select" onClick={()=>selectShop(hub.hub_id,shop.shop_id)} aria-pressed={shop.shop_id===shopId} aria-label={`نمایش ${shop.name||'فروشگاه'} روی نقشه`}>
       <span className="bazaar-shop-head"><strong>{shop.name||'نام فروشگاه نامشخص'}</strong><span className="bazaar-price">{money(shop.min_price_toman)}</span></span>
       <span>{shop.mall??'پاساژ ثبت نشده'}</span>
       <small>{shop.cheapest_product_title||'کالای نامشخص'}</small>
      </button>
      <div className="bazaar-shop-links">
       <Link href={`/products/${encodeURIComponent(shop.cheapest_product_id)}`}>دیدن کالا</Link>
       <Link href={`/shops/${encodeURIComponent(shop.shop_id)}`}>دیدن فروشگاه</Link>
       <button type="button" onClick={()=>visit.toggle(shop.cheapest_offer_id)} aria-pressed={visit.ids.includes(shop.cheapest_offer_id)}>{visit.ids.includes(shop.cheapest_offer_id)?<><Check size={14}/>در برنامهٔ مراجعه</>:<><Plus size={14}/>برنامهٔ مراجعه</>}</button>
      </div>
     </article>)}</div>
    </section>}
   </>}
   <p className="bazaar-note">قیمت‌ها ثبت‌شده‌اند، نه قیمت امروز؛ موجودی را پیش از رفتن استعلام کن. راسته‌ها فقط از فروشگاه‌هایی ساخته شده‌اند که این کالا را در دیتاست دارند. <Link href="/settings">درباره داده‌ها</Link></p>
  </aside>

  <section className="bazaar-stage" aria-label="نقشهٔ راسته‌ها">
   {result&&<BazaarMap hubs={result.hubs} selectedHubId={hubId} selectedShopId={shopId} highlightShopIds={answer?.shop_ids??[]} location={location} basemap={basemap} onSelectHub={selectHub} onSelectShop={selectShop}/>}
   {!result&&!loading&&<div className="bazaar-map-empty"><p>اسم یک کالا را بنویس تا راسته‌هایش اینجا روی نقشه روشن شود.</p></div>}
   {result&&<div className="bazaar-map-tools">
    <button type="button" className="bazaar-tool" onClick={()=>chooseBasemap(basemap==='dark'?'positron':'dark')} aria-label={basemap==='dark'?'نقشهٔ روشن':'نقشهٔ تیره'}>{basemap==='dark'?<Sun size={16}/>:<Moon size={16}/>}{basemap==='dark'?basemaps.positron.label:basemaps.dark.label}</button>
    <button type="button" className="bazaar-tool" onClick={()=>void locate()} aria-pressed={Boolean(location)}><LocateFixed size={16}/>{location?'موقعیت شما روی نقشه':'موقعیت من'}</button>
   </div>}
  </section>
   {answer&&<div className="bazaar-answer" role="status" aria-live="polite">
     <p className="bazaar-answer-q">{question}</p>
     <div className="bazaar-answer-body"><BrandMark/><div>
      <p>{answer.text}</p>
      {answer.lines.length>0&&<ul>{answer.lines.map(line=><li key={line}>{line}</li>)}</ul>}
      <small>{answer.shop_ids.length>0&&'فروشگاه‌های این پاسخ روی نقشه زرد شده‌اند. '}{answer.router==='model'?'هوش مصنوعی فقط سؤال را فهمید؛ عددها از دیتاست است.':'پاسخ مستقیم از دیتاست.'}</small>
     </div></div>
     <button type="button" className="bazaar-answer-close" onClick={()=>setAnswer(null)} aria-label="بستن پاسخ">×</button>
    </div>}
   {result&&result.hubs.length>0&&<div className="bazaar-ask">
    {askError&&<p className="bazaar-status is-error" role="alert">{askError}</p>}
    <div className="bazaar-ask-chips" aria-label="سؤال‌های آماده">{questions(hub).map(item=><button type="button" key={item} disabled={asking} onClick={()=>void ask(item)}>{item}</button>)}</div>
    <form className="bazaar-composer is-ask" onSubmit={event=>{event.preventDefault();void ask(question);}}>
     <label htmlFor="bazaar-ask" className="sr-only">سؤال از نقشه</label>
     <input id="bazaar-ask" value={question} onChange={event=>setQuestion(event.target.value)} placeholder={hub?`دربارهٔ راستهٔ ${hub.name} بپرس…`:'از نقشه بپرس، مثلاً ارزان‌ترین کجاست؟'} maxLength={300} autoComplete="off"/>
     <button type="submit" disabled={asking||question.trim().length<2} aria-label="ارسال سؤال">{asking?<BrandMark busy/>:<ArrowUp size={22}/>}</button>
    </form>
   </div>}
 </main>;
}
