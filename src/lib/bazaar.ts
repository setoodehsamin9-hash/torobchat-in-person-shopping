import { query } from './db/client';
import { searchProducts } from './catalog';
import { getHourStatus,haversineKm,normalizeText,paymentEligible,sanitizePrice } from './domain';
import type { Hours,HourStatus,PaymentOption } from './contracts';

/** A market district ("بورس" / راسته) is inferred only from shops that carry an
 * offer row for a product matching the query. Shop category never counts.
 * Grouping uses the street recorded at the start of each shop address, then
 * removes members that sit far from the group's median point.
 */
export type BazaarShop={shop_id:string;name:string|null;address:string|null;mall:string|null;lat:number;lon:number;offer_count:number;product_count:number;min_price_toman:number|null;cheapest_offer_id:string;cheapest_product_id:string;cheapest_product_title:string|null;hours:HourStatus['state'];installment:boolean};
export type BazaarMall={name:string;shop_count:number};
export type BazaarHub={hub_id:string;name:string;street_label:string;region:string|null;center:[number,number];radius_m:number;shop_count:number;offer_count:number;product_count:number;share:number;min_price_toman:number|null;median_price_toman:number|null;open_count:number;hours_known_count:number;installment_count:number;malls:BazaarMall[];shops:BazaarShop[];primary:boolean};
export type BazaarResult={query:string;matched_products:number;sample_products:{product_id:string;title:string|null}[];total_shops:number;total_offers:number;scattered_shops:number;hubs:BazaarHub[];limited:true;computed_at:string};

type Row={offer_id:string;product_id:string;price_toman:unknown;shop_id:string;name:string|null;address:string|null;location_label:string|null;lat:unknown;lon:unknown;weekly_hours:Hours|null;payment_options:PaymentOption[]|null;persian_title:string|null;category_name:string|null};

const streetNoise=new Set(['خیابان','خ','بلوار','میدان','م','بزرگراه','اتوبان','کوچه','تقاطع','نبش','ابتدای','انتهای','ابتدا','انتها','اسلامی','جنوبی','شمالی','شرقی','غربی','نو','تهران','استان','شهر','سه','راه','چهارراه','چهار']);
const mallPattern=/(پاساژ|مجتمع تجاری|مجتمع|مرکز خرید|مرکز تجاری|بازار|سرای)\s+([^،,.]+)/u;
const mallStop=/\s(?:طبقه|واحد|پلاک|همکف|زیرزمین|بلوک|ورودی|غرفه|ط|ک)(?:\s|$).*/u;
const MAX_HUBS=8,MAX_SPREAD_KM=1.2,MIN_SHOPS=2;

export function streetKey(address:string|null,fallback:string|null):{key:string;label:string}|null{
  const first=(address??'').split(/[،,]/u)[0]?.trim()??'';
  const words=normalizeText(first).split(' ').filter(word=>word&&!streetNoise.has(word)&&!/^\d+$/.test(word));
  if(words.length&&words.length<=4)return {key:words.join(' '),label:first};
  const region=normalizeText(fallback??'');
  return region?{key:region,label:fallback!}:null;
}
export function mallName(address:string|null):string|null{
  const match=(address??'').match(mallPattern);if(!match)return null;
  const name=`${match[1]} ${match[2]}`.replace(/ء/gu,'').replace(mallStop,'').trim().split(/\s+/u).slice(0,4).join(' ');
  return name.length>3&&name.length<=48?name:null;
}
function hubId(key:string){let hash=5381;for(const char of key)hash=((hash*33)^char.codePointAt(0)!)>>>0;return `hub_${hash.toString(16).padStart(8,'0')}`;}
function median(values:number[]){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:Math.round((sorted[middle-1]+sorted[middle])/2);}
function mode<T>(values:T[]):T|undefined{const counts=new Map<T,number>();let best:T|undefined,max=0;for(const value of values){const count=(counts.get(value)??0)+1;counts.set(value,count);if(count>max){max=count;best=value;}}return best;}
const validPoint=(lat:number|null,lon:number|null)=>lat!==null&&lon!==null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;

/** Pure grouping step; exported for tests. */
export function groupHubs(rows:Row[],at=new Date().toISOString()):Omit<BazaarResult,'query'|'matched_products'|'sample_products'|'computed_at'>{
  const shops=new Map<string,{row:Row;offers:Row[];prices:number[]}>();
  for(const row of rows){const entry=shops.get(row.shop_id);if(entry){entry.offers.push(row);}else shops.set(row.shop_id,{row,offers:[row],prices:[]});const price=sanitizePrice(row.price_toman);if(price!==null)shops.get(row.shop_id)!.prices.push(price);}
  const groups=new Map<string,{label:string[];members:BazaarShop[];regions:(string|null)[];prices:number[];offers:number;products:Set<string>}>();
  let scattered=0;
  for(const {row,offers,prices} of shops.values()){
    const lat=row.lat===null?null:Number(row.lat),lon=row.lon===null?null:Number(row.lon);
    const street=streetKey(row.address,row.location_label);
    if(!validPoint(lat,lon)||!street){scattered++;continue;}
    let cheapest=offers[0];for(const offer of offers){const price=sanitizePrice(offer.price_toman),best=sanitizePrice(cheapest.price_toman);if(price!==null&&(best===null||price<best))cheapest=offer;}
    const hours=getHourStatus(row.weekly_hours??{},at).state;
    const installment=offers.some(offer=>paymentEligible(row.payment_options??[],sanitizePrice(offer.price_toman),offer.category_name));
    const shop:BazaarShop={shop_id:row.shop_id,name:row.name,address:row.address,mall:mallName(row.address),lat:lat!,lon:lon!,offer_count:offers.length,product_count:new Set(offers.map(offer=>offer.product_id)).size,min_price_toman:sanitizePrice(cheapest.price_toman),cheapest_offer_id:cheapest.offer_id,cheapest_product_id:cheapest.product_id,cheapest_product_title:cheapest.persian_title,hours,installment};
    const group=groups.get(street.key)??{label:[],members:[],regions:[],prices:[],offers:0,products:new Set<string>()};
    group.label.push(street.label);group.members.push(shop);group.regions.push(row.location_label);group.prices.push(...prices);group.offers+=offers.length;offers.forEach(offer=>group.products.add(offer.product_id));
    groups.set(street.key,group);
  }
  const total=shops.size,hubs:BazaarHub[]=[];
  for(const [key,group] of groups){
    const centerLat=median(group.members.map(shop=>shop.lat*1e6))!/1e6,centerLon=median(group.members.map(shop=>shop.lon*1e6))!/1e6;
    const members=group.members.filter(shop=>haversineKm(centerLat,centerLon,shop.lat,shop.lon)<=MAX_SPREAD_KM);
    if(members.length<MIN_SHOPS){scattered+=group.members.length;continue;}
    scattered+=group.members.length-members.length;
    const lat=members.reduce((sum,shop)=>sum+shop.lat,0)/members.length,lon=members.reduce((sum,shop)=>sum+shop.lon,0)/members.length;
    const distances=members.map(shop=>haversineKm(lat,lon,shop.lat,shop.lon)*1000).sort((a,b)=>a-b);
    const malls=new Map<string,number>();members.forEach(shop=>{if(shop.mall)malls.set(shop.mall,(malls.get(shop.mall)??0)+1);});
    const prices=members.map(shop=>shop.min_price_toman).filter((price):price is number=>price!==null);
    hubs.push({hub_id:hubId(key),name:key,street_label:mode(group.label)??key,region:mode(group.regions.filter(Boolean))??null,center:[lat,lon],radius_m:Math.min(450,Math.max(90,Math.round(distances[Math.floor(distances.length*.75)]??0))),shop_count:members.length,offer_count:members.reduce((sum,shop)=>sum+shop.offer_count,0),product_count:group.products.size,share:total?members.length/total:0,min_price_toman:prices.length?Math.min(...prices):null,median_price_toman:median(group.prices),open_count:members.filter(shop=>shop.hours==='fits_reported').length,hours_known_count:members.filter(shop=>shop.hours!=='unknown').length,installment_count:members.filter(shop=>shop.installment).length,malls:[...malls].map(([name,shop_count])=>({name,shop_count})).sort((a,b)=>b.shop_count-a.shop_count||a.name.localeCompare(b.name,'fa')).slice(0,8),shops:members.sort((a,b)=>(a.min_price_toman??Infinity)-(b.min_price_toman??Infinity)||a.shop_id.localeCompare(b.shop_id)).slice(0,150),primary:false});
  }
  hubs.sort((a,b)=>b.shop_count-a.shop_count||b.offer_count-a.offer_count||a.hub_id.localeCompare(b.hub_id));
  const kept=hubs.slice(0,MAX_HUBS);
  hubs.slice(MAX_HUBS).forEach(hub=>{scattered+=hub.shop_count;});
  if(kept[0]&&kept[0].shop_count>=3)kept[0].primary=true;
  return {total_shops:total,total_offers:rows.length,scattered_shops:scattered,hubs:kept,limited:true};
}

const cache=new Map<string,{at:number;value:Promise<BazaarResult>}>();
export async function findBazaars(text:string):Promise<BazaarResult>{
  const key=normalizeText(text).slice(0,120),now=Date.now();
  const hit=cache.get(key);if(hit&&now-hit.at<300000)return hit.value;
  const value=computeBazaars(text).catch(error=>{cache.delete(key);throw error;});
  cache.set(key,{at:now,value});if(cache.size>24)cache.delete(cache.keys().next().value!);
  return value;
}
async function computeBazaars(text:string):Promise<BazaarResult>{
  const [first,second]=await Promise.all([searchProducts({query:text,page:1,limit:60}),searchProducts({query:text,page:2,limit:60})]);
  const products=[...first.data,...second.data];
  const ids=products.map(product=>product.product_id);
  const rows=ids.length?await query<Row>(`SELECT o.offer_id,o.product_id,o.price_toman::text price_toman,s.shop_id,s.name,s.address,s.location_label,s.lat,s.lon,s.weekly_hours,s.payment_options,p.persian_title,p.category_name FROM offers o JOIN shops s ON s.shop_id=o.shop_id JOIN products p ON p.product_id=o.product_id WHERE o.product_id=ANY($1::text[]) ORDER BY o.offer_id LIMIT 6000`,[ids]):[];
  return {query:text,matched_products:first.total,sample_products:products.slice(0,5).map(product=>({product_id:product.product_id,title:product.persian_title})),...groupHubs(rows),computed_at:new Date().toISOString()};
}
