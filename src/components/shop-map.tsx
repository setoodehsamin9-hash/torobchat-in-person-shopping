'use client';
import { Fragment,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { divIcon,DomEvent,type Marker as LeafletMarker } from 'leaflet';
import { MapContainer,TileLayer,Circle,CircleMarker,Marker,Popup,Polyline,useMap,useMapEvents } from 'react-leaflet';
import type { EnrichedOffer,Product,PurchaseSession,Shop,StoreDiscoveryMatch } from '@/lib/contracts';
import { dateLabel,money } from '@/lib/client';
import { layoutMapLabels,type MapLabelOffset } from './map-label-layout';
import 'leaflet/dist/leaflet.css';
import './shopping-panels.css';

function ClickPin({onPin,onOpenMap}:{onPin?:(lat:number,lng:number)=>void;onOpenMap?:()=>void}){useMapEvents({click(e){const target=e.originalEvent?.target;if(target instanceof Element&&target.closest('.leaflet-marker-icon,.leaflet-control'))return;if(e.originalEvent?.defaultPrevented)return;if(onPin)onPin(e.latlng.lat,e.latlng.lng);else onOpenMap?.();}});return null;}
/** Leaflet restores window scroll after focus, but cannot restore a nested chat scroller.
 * Focus before its mouse handler and keep marker presses from refocusing the map.
 */
function StableMapFocus(){
 const map=useMap();
 useEffect(()=>{
  const container=map.getContainer();
  const focus=(event:MouseEvent)=>{
   const marker=event.target instanceof Element?event.target.closest<HTMLElement>('.leaflet-marker-icon'):null;
   if(marker){marker.focus({preventScroll:true});event.preventDefault();event.stopPropagation();}
   else container.focus({preventScroll:true});
  };
  container.addEventListener('mousedown',focus,true);
  return()=>container.removeEventListener('mousedown',focus,true);
 },[map]);return null;
}
function Frame({coordinates}:{coordinates:string}){const map=useMap();useEffect(()=>{const points=JSON.parse(coordinates) as [number,number][];if(points.length===1)map.setView(points[0],15,{animate:false});else if(points.length>1)map.fitBounds(points,{padding:[44,44],maxZoom:16,animate:false});},[map,coordinates]);return null;}
function FocusSelection({offer}:{offer?:EnrichedOffer}){const map=useMap(),previous=useRef(offer?.offer_id);useEffect(()=>{if(previous.current===offer?.offer_id)return;previous.current=offer?.offer_id;const lat=offer?.shop.lat,lon=offer?.shop.lon;if(lat!==null&&lat!==undefined&&lon!==null&&lon!==undefined&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)map.panTo([lat,lon],{animate:false});},[map,offer]);return null;}
function LayoutPins({shops,children}:{shops:Shop[];children:(shop:Shop,offset:MapLabelOffset)=>React.ReactNode}){
 const map=useMap();
 const [,setRevision]=useState(0);
 useLayoutEffect(()=>{const refresh=()=>setRevision(revision=>revision+1);map.on('moveend zoomend resize',refresh);return()=>{map.off('moveend zoomend resize',refresh);};},[map]);
 const size=map.getSize();
 const projected=shops.map(shop=>{const point=map.latLngToContainerPoint([shop.lat!,shop.lon!]);return {id:shop.shop_id,x:point.x,y:point.y};});
 const offsets=layoutMapLabels(projected,{width:size.x,height:size.y});
 return <>{shops.map((shop,index)=>{
  const offset=offsets[index],point=projected[index];
  const displaced=offset.offsetX!==0||offset.offsetY!==0;
  const labelCenter=map.containerPointToLatLng([point.x+offset.offsetX,point.y+offset.offsetY-24]);
  return <Fragment key={shop.shop_id}>{displaced&&<><Polyline positions={[[shop.lat!,shop.lon!],labelCenter]} interactive={false} pathOptions={{color:'#9b2340',weight:2,dashArray:'4 4',opacity:.9}}/><CircleMarker center={[shop.lat!,shop.lon!]} radius={3} interactive={false} pathOptions={{color:'#fff',fillColor:'#a8203b',fillOpacity:1,weight:1}}/></>}{children(shop,offset)}</Fragment>;
 })}</>;
}
function PriceMarker({shop,offer,selected,onSelect,children,offset}:{shop:Shop;offer?:EnrichedOffer;selected:boolean;onSelect?:()=>void;children?:React.ReactNode;offset:MapLabelOffset}){
 const marker=useRef<LeafletMarker>(null);
 const label=`${shop.name||'فروشگاه با نام نامشخص'} · ${offer?money(offer.price_toman):'قیمت نامشخص'} · قیمت ثبت‌شده`;
 // Only our formatted numeric price enters the icon HTML; seller/product text stays in React or attributes.
 const price=offer?money(offer.price_toman):'فروشگاه';
 const safePrice=price.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 // Reuse the icon while its price and label position remain unchanged.
 const icon=useMemo(()=>divIcon({className:'shop-price-marker',html:`<span dir="rtl" style="box-sizing:border-box;width:112px;height:36px;max-width:none;font-size:10px">${safePrice}</span>`,iconSize:[112,36],iconAnchor:[56-offset.offsetX,42-offset.offsetY]}),[safePrice,offset.offsetX,offset.offsetY]);
 const accessible=()=>{const element=marker.current?.getElement();element?.setAttribute('aria-label',label);element?.setAttribute('aria-pressed',String(selected));element?.classList.toggle('is-selected',selected);if(offer)element?.setAttribute('data-offer-id',offer.offer_id);};
 useEffect(accessible,[label,selected,offer]);
 return <Marker ref={marker} position={[shop.lat!,shop.lon!]} icon={icon} title={label} keyboard autoPanOnFocus={false} bubblingMouseEvents={false} riseOnHover zIndexOffset={selected?1000:0} eventHandlers={{click:event=>{DomEvent.stopPropagation(event.originalEvent);onSelect?.();},add:accessible}}>{children}</Marker>;
}
export default function ShopMap({offers,shops=[],location,onPin,product,path,matches=[],selectedOfferId,onSelectOffer,onOpenMap}:{offers:EnrichedOffer[];shops?:Shop[];location?:PurchaseSession;onPin?:(lat:number,lng:number)=>void;product?:Product;path?:[number,number][];matches?:StoreDiscoveryMatch[];selectedOfferId?:string;onSelectOffer?:(offerId:string)=>void;onOpenMap?:()=>void}){
 const [tileError,setTileError]=useState(false);
 const points=Array.from(new Map([...offers.map(o=>o.shop),...shops].filter(s=>s.lat!==null&&s.lon!==null&&Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&Math.abs(s.lat)<=90&&Math.abs(s.lon)<=180).map(s=>[s.shop_id,s])).values());
 const origin=location?.lat!==undefined&&location.lng!==undefined?[location.lat,location.lng] as [number,number]:undefined;
 const pathBounds=path?.length?[[Math.min(...path.map(p=>p[0])),Math.min(...path.map(p=>p[1]))],[Math.max(...path.map(p=>p[0])),Math.max(...path.map(p=>p[1]))]]:[];
 const coordinates=JSON.stringify([...points.map(s=>[s.lat!,s.lon!] as [number,number]),...(origin?[origin]:[]),...pathBounds]);
 const selected=offers.find(offer=>offer.offer_id===selectedOfferId);
 return <div className="map-wrapper"><MapContainer center={[35.7117,51.407]} zoom={12} preferCanvas scrollWheelZoom={false} style={{height:'100%',width:'100%'}}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror:()=>setTileError(true),tileload:()=>setTileError(false)}}/><StableMapFocus/><Frame coordinates={coordinates}/><FocusSelection offer={selected}/>{path&&<Polyline positions={path} pathOptions={{color:'#0f766e',weight:5,opacity:.85}}/>}{origin&&<><Circle center={origin} radius={(location?.radiusKm??5)*1000} pathOptions={{color:'#0f766e',fillOpacity:.045,weight:1}}/><CircleMarker center={origin} radius={7} pathOptions={{color:'#fff',fillColor:'#0f766e',fillOpacity:1,weight:3}}/></>}{<LayoutPins shops={points}>{(s,offset)=>{
 const linked=offers.filter(o=>o.shop_id===s.shop_id);
 const chosen=linked.find(offer=>offer.offer_id===selectedOfferId)??linked[0];
 // A pin represents one shop. Selection always refers to one exact offer row.
 return <PriceMarker key={s.shop_id} offset={offset} shop={s} offer={chosen} selected={selected?.shop_id===s.shop_id} onSelect={chosen&&onSelectOffer?()=>onSelectOffer(chosen.offer_id):undefined}>{!onSelectOffer&&<Popup><div dir="rtl" className="map-product-popup"><strong>{s.name||'نام نامشخص'}</strong><p>{s.address||'آدرس نامشخص'}</p>{linked.map(o=>{const actual=matches.find(m=>m.offer.offer_id===o.offer_id&&m.product.product_id===o.product_id)?.product??(product?.product_id===o.product_id?product:undefined);return <div className="map-linked-offer" key={o.offer_id}>{actual&&<><strong>{actual.persian_title||actual.model||'نام کالا نامشخص'}</strong>{actual.image_urls[0]&&/^https?:\/\//.test(actual.image_urls[0])&&<img src={actual.image_urls[0]} alt="تصویر کالای همین پیشنهاد" width={64} height={64} loading="lazy" referrerPolicy="no-referrer"/>}</>}<p>{money(o.price_toman)} · ثبت‌شده</p><small>آخرین تغییر: {dateLabel(o.last_price_changed_at)} · موجودی نامشخص</small><code dir="ltr">{o.offer_id}</code><a href={`/products/${encodeURIComponent(o.product_id)}`}>جزئیات کالای این پیشنهاد</a></div>;})}{!linked.length&&<small>فقط مکان ثبت‌شده؛ پیشنهاد کالایی نمایش داده نشده است.</small>}<a href={`/shops/${encodeURIComponent(s.shop_id)}`}>جزئیات فروشگاه</a></div></Popup>}</PriceMarker>;
 }}</LayoutPins>}<ClickPin onPin={onPin} onOpenMap={onOpenMap}/></MapContainer><div className="map-caption" role="status">{tileError?'بارگذاری نقشه مختل شد؛ آدرس و فهرست فروشگاه‌ها همچنان در کارت‌ها در دسترس است.':onPin?'برای انتخاب موقعیت روی نقشه بزنید.':path?'مسیر: نشان · نقشه پایه: OpenStreetMap':'مکان‌های ثبت‌شده · پیش‌نمایش OpenStreetMap؛ زمان سفر نامشخص'}</div></div>;
}
