import { z } from 'zod';
import type { Shop } from './contracts';
import { normalizeText } from './domain';
export type PlaceMedia={place:string;image_url:string;source_url:string;author:string;license:string;caption:string};
const metadata=z.record(z.string(),z.object({value:z.string()}));
const responseSchema=z.object({query:z.object({pages:z.record(z.string(),z.object({title:z.string(),imageinfo:z.array(z.object({thumburl:z.string().optional(),descriptionurl:z.string(),mime:z.string().optional(),extmetadata:metadata.optional()})).optional()}))}).optional()});
const cache=new Map<string,{expires:number;media:PlaceMedia|null}>();
const plain=(value:string)=>value.replace(/<[^>]*>/g,' ').replace(/&[^;]{1,12};/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
export async function placeMedia(shop:Shop):Promise<PlaceMedia|null>{
  const cached=cache.get(shop.shop_id);if(cached&&cached.expires>Date.now())return cached.media;
  const match=shop.address?.match(/(?:پاساژ|مجتمع تجاری|مرکز خرید)\s+([^،,؛\n]+)/);
  const place=match?.[1]?.split(/طبقه|واحد|پلاک|خیابان|کوچه|جنب|روبروی|روبه/)[0].trim().slice(0,70);
  if(!place||place.length<3||shop.lat===null||shop.lon===null)return null;
  const aliases:Record<string,string[]>={'علاءالدین':['alaeddin','aladdin','ala eddin'],'چارسو':['charsou','charsu','chaharsoo'],'اپال':['opal'],'کوروش':['kourosh','koroush'],'ایران مال':['iran mall']};
  const normalized=normalizeText(place),tokens=[normalized,...Object.entries(aliases).filter(([name])=>normalized.includes(normalizeText(name))).flatMap(([,names])=>names)];
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.search=new URLSearchParams({action:'query',format:'json',generator:'geosearch',ggscoord:`${shop.lat}|${shop.lon}`,ggsradius:'500',ggsnamespace:'6',ggslimit:'5',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'640',iiextmetadatafilter:'Artist|LicenseShortName|ImageDescription'}).toString();
  const response=await fetch(url,{headers:{'User-Agent':'TorobInPersonPrototype/1.0 (public place image attribution)'},signal:AbortSignal.timeout(6000),redirect:'error',cache:'no-store'});
  if(!response.ok)throw new Error('media_unavailable');
  const data=responseSchema.parse(await response.json());let media:PlaceMedia|null=null;
  for(const page of Object.values(data.query?.pages??{})){
    const info=page.imageinfo?.[0];if(!info?.thumburl||!info.mime?.startsWith('image/'))continue;
    const description=normalizeText(page.title+' '+plain(info.extmetadata?.ImageDescription?.value??''));
    if(!tokens.some(token=>description.includes(token)))continue;
    const image=new URL(info.thumburl),source=new URL(info.descriptionurl);
    const author=plain(info.extmetadata?.Artist?.value??''),license=plain(info.extmetadata?.LicenseShortName?.value??'');
    if(image.protocol!=='https:'||image.hostname!=='upload.wikimedia.org'||source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org'||!author||!license)continue;
    media={place,image_url:image.href,source_url:source.href,author,license,caption:'تصویر عمومی با تطبیق نام و فاصله حداکثر ۵۰۰ متر؛ ورودی یا داخل این فروشگاه تأیید نشده است.'};break;
  }
  if(cache.size>=200)cache.delete(cache.keys().next().value!);
  cache.set(shop.shop_id,{expires:Date.now()+86400000,media});return media;
}
