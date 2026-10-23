import Link from 'next/link';
import { z } from 'zod';
import { getOffer,getProduct } from '@/lib/catalog';
import type { StoreDiscoveryMatch } from '@/lib/contracts';
import { MapExplorer } from '@/components/map-explorer';

export const dynamic='force-dynamic';
const offerIds=z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)).min(1).max(5);
export default async function MapPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const raw=typeof query.offers==='string'?query.offers.split(','):[];
 const parsed=offerIds.safeParse(raw);
 if(!parsed.success)return <main className="map-page-error" dir="rtl"><h1>نقشه و فروشندگان</h1><p role="alert">{raw.length>5?'برای نقشه حداکثر پنج پیشنهاد را انتخاب کنید.':'شناسه‌های پیشنهاد معتبر نیستند؛ نقشه را از نتیجه جست‌وجو باز کنید.'}</p><Link href="/chat">بازگشت به گفت‌وگو</Link></main>;
 let matches:StoreDiscoveryMatch[]=[];
 try{
  const offers=await Promise.all([...new Set(parsed.data)].map(getOffer));
  const linked=await Promise.all(offers.map(async offer=>{if(!offer)return null;const product=await getProduct(offer.product_id);return product?{offer,product}:null;}));
  matches=linked.filter((match):match is StoreDiscoveryMatch=>match!==null);
 }catch{return <main className="map-page-error" dir="rtl"><h1>نقشه و فروشندگان</h1><p role="alert">خواندن پیشنهادهای ثبت‌شده ممکن نشد؛ دوباره تلاش کنید.</p><Link href="/chat">بازگشت به گفت‌وگو</Link></main>;}
 const selected=typeof query.selected==='string'&&matches.some(match=>match.offer.offer_id===query.selected)?query.selected:undefined;
 return <MapExplorer matches={matches} initialSelectedOfferId={selected}/>;
}
