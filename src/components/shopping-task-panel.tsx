'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GitCompareArrows,List,MapPin,ShoppingBag,Store } from 'lucide-react';
import type { EnrichedOffer,Product,PurchaseSession,StoreDiscoveryMatch } from '@/lib/contracts';
import { dateLabel,fa,money } from '@/lib/client';
import { useIds } from '@/lib/session';
import { EmptyState,OfferCard,ProductCard,ProductCarousel,ProductImage,SourceLabel } from './ui';
import { ShopMap } from './location';
import './shopping-panels.css';

export function ShoppingTaskPanel({products,title,onProductPreview}:{products:Product[];title:string;onProductPreview?:(product:Product)=>void}){
  const {ids}=useIds('torob-compare-products');
  return <section className="shopping-task-panel" aria-label="انتخاب و مقایسه کالا">
    <header className="shopping-panel-heading"><span className="shopping-panel-icon"><ShoppingBag size={20}/></span><div><span className="shopping-panel-kicker">قدم اول · انتخاب کالا</span><h3>{title}</h3></div><span className="badge muted">{fa(products.length)} کالا در این نتیجه</span></header>
    {products.length?<ProductCarousel products={products} onPreview={onProductPreview}/>:<EmptyState title="کالایی با این شرایط پیدا نشد" description="بودجه، عبارت جست‌وجو یا محدوده را خودتان ویرایش کنید؛ شرط‌ها خودکار تغییر نمی‌کنند."/>}
    <footer className="shopping-panel-footer"><p>برای جزئیات روی کالا بزنید؛ با دکمه + حداکثر چهار کالا را برای مقایسه انتخاب کنید.</p>{ids.length>=2?<Link href="/compare" className="btn outline"><GitCompareArrows size={16}/>مقایسه {fa(ids.length)} کالای انتخابی</Link>:<span className="shopping-panel-hint">برای مقایسه، حداقل دو کالا انتخاب کنید.</span>}</footer>
  </section>;
}

function SellerComparison({matches}:{matches:StoreDiscoveryMatch[]}){
  return <div className="table-scroll"><table className="comparison-table shopping-seller-comparison"><caption>مقایسه پیشنهادهای همین شناسه کالا · موجودی نامشخص</caption><thead><tr><th>فروشگاه</th><th>قیمت ثبت‌شده</th><th>تاریخ ثبت قیمت</th><th>فاصله مستقیم</th><th>اقساط حضوری</th></tr></thead><tbody>{matches.map(({offer})=><tr key={offer.offer_id}><th>{offer.shop.name||'نامشخص'}</th><td>{money(offer.price_toman)}</td><td>{dateLabel(offer.last_price_changed_at)}</td><td>{offer.distance_km===null?'نامشخص':`${fa(offer.distance_km)} کیلومتر`}</td><td>{offer.installment_eligible?'ثبت‌شده؛ نیاز به استعلام':'نامشخص'}</td></tr>)}</tbody></table></div>;
}

export function StoreDiscoveryPanel({matches,query,title,session,onInquiry,onProductPreview,product,allowMapNavigation=true}:{matches:StoreDiscoveryMatch[];query:string;title:string;session?:PurchaseSession;onInquiry:(offer:EnrichedOffer)=>void;onProductPreview?:(product:Product)=>void;product?:Product;allowMapNavigation?:boolean}){
  const router=useRouter();
  const [view,setView]=useState<'list'|'map'>(product?'list':'map');
  const [compared,setCompared]=useState<string[]>([]);
  const [selectedOfferId,setSelectedOfferId]=useState<string|undefined>(matches[0]?.offer.offer_id);
  const selectedMatch=matches.find(match=>match.offer.offer_id===selectedOfferId)??matches[0];
  const visibleMatches=view==='map'?(selectedMatch?[selectedMatch]:[]):matches;
  const mapHref=`/map?offers=${matches.slice(0,5).map(match=>encodeURIComponent(match.offer.offer_id)).join(',')}${selectedMatch?`&selected=${encodeURIComponent(selectedMatch.offer.offer_id)}`:''}`;
  const visit=useIds('torob-visit-offers');
  const comparedMatches=matches.filter(m=>compared.includes(m.offer.offer_id));
  const comparisonProduct=comparedMatches[0]?.product.product_id;
  const shops=new Set(matches.map(m=>m.offer.shop_id)).size;
  const mapped=matches.filter(m=>m.offer.shop.lat!==null&&m.offer.shop.lon!==null);
  const offers=matches.map(m=>m.offer);
  const chooseCompare=(offer:EnrichedOffer)=>setCompared(ids=>ids.includes(offer.offer_id)?ids.filter(id=>id!==offer.offer_id):[...ids,offer.offer_id].slice(-4));
  return <section className="shopping-store-panel" aria-label="فروشگاه‌های دارای پیشنهاد واقعی">
    <header className="shopping-panel-heading"><span className="shopping-panel-icon"><MapPin size={20}/></span><div><span className="shopping-panel-kicker">قدم بعدی · بررسی فروشگاه</span><h3>{title}</h3><p>{query}</p></div><span className="badge muted">{fa(shops)} فروشگاه در این نتیجه</span></header>
    <p className="shopping-scope">این فهرست محدود به پیشنهادهای واقعی همین نتیجه است؛ فهرست کامل بازار نیست. قیمت ثبت‌شده و موجودی نامشخص است.</p>
    {product&&<div className="shopping-selected-product"><ProductCard product={product} onPreview={onProductPreview}/><Link className="text-button" href={`/products/${encodeURIComponent(product.product_id)}`}>جزئیات و همهٔ پیشنهادهای همین کالا</Link></div>}
    <div className="shopping-view-controls" role="group" aria-label="نحوه نمایش فروشگاه‌ها"><button className="btn outline" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={16}/>فهرست فروشگاه‌ها</button><button className="btn outline" aria-pressed={view==='map'} onClick={()=>setView('map')}><MapPin size={16}/>نقشه فروشگاه‌ها</button><span>{fa(mapped.length)} پیشنهاد دارای مختصات · زمان سفر نامشخص</span></div>
    {query.trim().length>=2&&<Link className="shopping-bazaar-link" href={`/bazaar?q=${encodeURIComponent(query.trim().slice(0,120))}`}><Store size={16}/>بورس این کالا: راسته‌هایی که فروشنده‌اش در آن جمع شده‌اند</Link>}
    {!matches.length?<EmptyState title="پیشنهاد مرتبط با این شرایط پیدا نشد" description="شرایط بودجه، محدوده و اقساط حفظ شده‌اند. برای نتیجه بیشتر، خودتان شرایط را تغییر دهید."/>:<>
      {view==='map'&&<div className="shopping-discovery-map"><ShopMap offers={offers} matches={matches} product={product} location={session} selectedOfferId={selectedMatch?.offer.offer_id} onSelectOffer={setSelectedOfferId} onOpenMap={allowMapNavigation?()=>router.push(mapHref):undefined}/><Link href={mapHref} onClick={event=>{if(!allowMapNavigation)event.preventDefault();}} aria-disabled={!allowMapNavigation} className="shopping-open-map btn outline"><MapPin size={17}/>{allowMapNavigation?'باز کردن نقشه و فروشندگان':'نقشهٔ کامل پس از آماده شدن پاسخ باز می‌شود'}</Link><div className="shopping-map-sellers" role="group" aria-label="انتخاب فروشنده روی نقشه">{matches.map(match=><button type="button" key={match.offer.offer_id} aria-pressed={selectedMatch?.offer.offer_id===match.offer.offer_id} onClick={()=>setSelectedOfferId(match.offer.offer_id)}>{match.offer.shop.name||'نامشخص'} · {money(match.offer.price_toman)}</button>)}</div>{mapped.length<matches.length&&<p className="shopping-panel-hint">مختصات بعضی فروشگاه‌ها نامشخص است؛ آدرس ثبت‌شده را در فهرست ببینید.</p>}<p className="shopping-panel-hint">نقشه پایه OpenStreetMap · بدون نیاز به کلید مسیریابی · اگر نقشه بارگذاری نشد، فهرست و نشانی‌ها در دسترس‌اند.</p></div>}
      <div className={`shopping-store-list ${view==='map'?'shopping-map-list':''}`}>{visibleMatches.map(({product:linkedProduct,offer})=><article className="shopping-linked-store" key={offer.offer_id} data-offer-id={offer.offer_id}>
        {!product&&<div className="shopping-match-product"><ProductImage product={linkedProduct}/><div>{onProductPreview?<button className="text-button" onClick={()=>onProductPreview(linkedProduct)}>{linkedProduct.persian_title||linkedProduct.model||'عنوان کالا نامشخص'}</button>:<Link href={`/products/${encodeURIComponent(linkedProduct.product_id)}`}>{linkedProduct.persian_title||linkedProduct.model||'عنوان کالا نامشخص'}</Link>}<small>کالای همین پیشنهاد · {linkedProduct.category_name||'دسته نامشخص'}</small><SourceLabel id={linkedProduct.product_id}/></div></div>}
        <OfferCard offer={offer} onInquiry={onInquiry} onCompare={comparisonProduct&&comparisonProduct!==offer.product_id?undefined:()=>chooseCompare(offer)} compared={compared.includes(offer.offer_id)}/>
        {comparisonProduct&&comparisonProduct!==offer.product_id&&<small className="shopping-panel-hint">مقایسه فروشنده برای شناسه کالای یکسان است. انتخاب فعلی را پاک کنید تا این کالا را مقایسه کنید.</small>}
      </article>)}</div>
    </>}
    {compared.length>0&&<div className="shopping-comparison-panel"><div className="shopping-panel-heading"><strong>مقایسه {fa(compared.length)} پیشنهاد انتخابی</strong><button className="text-button" onClick={()=>setCompared([])}>پاک کردن انتخاب مقایسه</button></div>{comparedMatches.length>=2?<SellerComparison matches={comparedMatches}/>:<p>یک فروشگاه دیگر از همین کالا را برای مقایسه انتخاب کنید.</p>}</div>}
    {visit.ids.length>0&&<footer className="shopping-panel-footer"><p>قبل از حرکت، قیمت امروز و امکان مراجعه را از منبع معتبر استعلام کنید.</p><Link href="/visit-plan" className="btn outline">برنامه مراجعه · {fa(visit.ids.length)} پیشنهاد</Link></footer>}
  </section>;
}
