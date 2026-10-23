'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight,MapPin,Store } from 'lucide-react';
import type { StoreDiscoveryMatch } from '@/lib/contracts';
import { fa,money } from '@/lib/client';
import { ShopMap } from './location';
import { OfferCard,ProductImage,SourceLabel } from './ui';
import './shopping-panels.css';
import './map-explorer.css';

export function MapExplorer({matches,initialSelectedOfferId}:{matches:StoreDiscoveryMatch[];initialSelectedOfferId?:string}){
 const [selectedId,setSelectedId]=useState(initialSelectedOfferId);
 const selected=matches.find(match=>match.offer.offer_id===selectedId);
 const select=(offerId:string)=>{setSelectedId(offerId);const url=new URL(window.location.href);url.searchParams.set('selected',offerId);window.history.replaceState(null,'',url);};
 return <main id="main" className="map-explorer" dir="rtl">
  <header className="map-explorer-header"><Link href="/chat" className="map-return"><ArrowRight size={18}/>بازگشت به گفت‌وگو</Link><div><h1>نقشه و فروشندگان</h1><p>فروشگاه‌های همین نتیجه · {fa(new Set(matches.map(match=>match.offer.shop_id)).size)} فروشگاه</p></div><span className="map-demo-badge">نمونه اولیه مستقل</span></header>
  <div className="map-explorer-layout">
   <section className="map-explorer-canvas" aria-label="نقشه مکان‌های ثبت‌شده"><ShopMap offers={matches.map(match=>match.offer)} matches={matches} selectedOfferId={selectedId} onSelectOffer={select}/><p className="map-explorer-map-note">برای دیدن کالا و قیمت همان فروشگاه، روی نشان قیمت بزنید.</p></section>
   <aside className="map-explorer-sidebar" aria-label="فروشندگان روی نقشه"><div className="map-seller-heading"><Store size={19}/><h2>فروشندگان این نتیجه</h2></div><p className="map-trust-note">قیمت‌ها ثبت‌شده‌اند؛ موجودی و قیمت امروز نامشخص است. نام فروشنده ممکن است ناشناس‌سازی شده باشد.</p>
    {matches.length?<div className="map-seller-list" role="group" aria-label="انتخاب فروشنده">{matches.map(({offer,product})=><button type="button" className="map-seller-choice" data-seller-offer={offer.offer_id} key={offer.offer_id} aria-pressed={selectedId===offer.offer_id} onClick={()=>select(offer.offer_id)}><span className="map-seller-thumbnail"><ProductImage product={product}/></span><span className="map-seller-copy"><strong>{product.persian_title||product.model||'عنوان کالا نامشخص'}</strong><span><Store size={13}/>{offer.shop.name||'نام فروشگاه نامشخص'}</span><small>{offer.shop.location_label||'محدوده نامشخص'}</small></span><span className="map-seller-price">{money(offer.price_toman)}<small>قیمت ثبت‌شده · موجودی نامشخص</small></span></button>)}</div>:<p role="status">پیشنهاد معتبری برای این نشانی پیدا نشد. از نتیجه جست‌وجو دوباره نقشه را باز کنید.</p>}
    {selected?<section className="map-selected-detail" aria-label="جزئیات پیشنهاد انتخاب‌شده" data-offer-id={selected.offer.offer_id}><h2>پیشنهاد انتخاب‌شده</h2><div className="map-selected-product"><ProductImage product={selected.product}/><div><Link href={`/products/${encodeURIComponent(selected.product.product_id)}`}>{selected.product.persian_title||selected.product.model||'عنوان کالا نامشخص'}</Link><SourceLabel id={selected.product.product_id}/></div></div><OfferCard offer={selected.offer}/><p className="map-missing-location">{selected.offer.shop.lat===null||selected.offer.shop.lon===null?'مختصات این فروشگاه نامشخص است؛ آدرس ثبت‌شده در بالا آمده است.':'موقعیت ثبت‌شده در دیتاست؛ زمان سفر نامشخص است.'}</p></section>:matches.length>0&&<div className="map-selection-empty" role="status"><MapPin size={26}/><p>یک نشان روی نقشه یا یک فروشنده از فهرست را انتخاب کنید.</p></div>}
    <p className="map-trust-note">شماره‌های دیتاست آزمایشی‌اند؛ تماس واقعی از این صفحه انجام نمی‌شود.</p>
   </aside>
  </div>
 </main>;
}
