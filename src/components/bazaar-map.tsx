'use client';
import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { divIcon,type Marker as LeafletMarker } from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { getRTLTextPluginStatus,setRTLTextPlugin,type StyleSpecification } from 'maplibre-gl';
import { MapContainer,TileLayer,Circle,CircleMarker,Marker,Tooltip,useMap } from 'react-leaflet';
import type { BazaarHub } from '@/lib/bazaar';
import { basemaps,type Basemap } from './bazaar-basemaps';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const attribution='<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
// Persian labels need the RTL shaping plugin; place names prefer name:fa.
const rtlPlugin='https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
const persianName=['coalesce',['get','name:fa'],['get','name:nonlatin'],['get','name']];
const fallbackUrl='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const faNumber=(n:number)=>new Intl.NumberFormat('fa-IR').format(n);

function VectorBase({basemap,onFail}:{basemap:Basemap;onFail:()=>void}){
 const map=useMap();
 useEffect(()=>{
  let layer:ReturnType<typeof maplibreGL>|undefined,active=true;
  if(getRTLTextPluginStatus()==='unavailable')void setRTLTextPlugin(rtlPlugin,true).catch(()=>undefined);
  fetch(basemaps[basemap].style).then(response=>{if(!response.ok)throw new Error('style');return response.json() as Promise<StyleSpecification>;}).then(style=>{
   if(!active)return;
   for(const item of style.layers)if(item.type==='symbol'&&item.layout?.['text-field']&&!JSON.stringify(item.layout['text-field']).includes('"ref"'))item.layout['text-field']=persianName as never;
   layer=maplibreGL({style,attributionControl:false});layer.addTo(map);
   layer.getMaplibreMap().on('error',event=>{if(String(event.error?.message??'').includes('style'))onFail();});
  }).catch(()=>{if(active)onFail();});
  map.attributionControl?.addAttribution(attribution);
  return()=>{active=false;layer?.remove();map.attributionControl?.removeAttribution(attribution);};
 },[map,basemap,onFail]);
 return null;
}
type LabelPlacement={id:string;dx:number;dy:number};
/** Stack overlapping district labels vertically in rank order; coordinates never move. */
function useLabelPlacement(hubs:BazaarHub[]):Map<string,LabelPlacement>{
 const map=useMap();
 const [revision,setRevision]=useState(0);
 useLayoutEffect(()=>{const refresh=()=>setRevision(value=>value+1);map.on('zoomend moveend resize',refresh);return()=>{map.off('zoomend moveend resize',refresh);};},[map]);
 return useMemo(()=>{
  void revision;
  const placed:{l:number;t:number;r:number;b:number}[]=[],result=new Map<string,LabelPlacement>();
  for(const hub of hubs){
   const point=map.latLngToContainerPoint(hub.center),width=44+hub.name.length*9,height=32;
   const dy=[0,-38,38,-76,76,-114,114].find(offset=>{const t=point.y-height/2+offset,l=point.x-width/2;return placed.every(rect=>l+width+6<=rect.l||rect.r+6<=l||t+height+6<=rect.t||rect.b+6<=t);})??0;
   placed.push({l:point.x-width/2,t:point.y-height/2+dy,r:point.x+width/2,b:point.y+height/2+dy});
   result.set(hub.hub_id,{id:hub.hub_id,dx:0,dy});
  }
  return result;
 },[map,hubs,revision]);
}
function Frame({hubs,selected,location}:{hubs:BazaarHub[];selected?:BazaarHub;location?:[number,number]}){
 const map=useMap(),framed=useRef(false);
 const key=hubs.map(hub=>hub.hub_id).join(',');
 useEffect(()=>{
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Keep framed districts clear of the style switcher above and the ask dock below.
  const padding={paddingTopLeft:[40,80] as [number,number],paddingBottomRight:[40,window.innerWidth<=900?30:190] as [number,number]};
  // Leaflet cannot fly before it has a first view; the first framing is instant.
  const animate=!reduce&&framed.current;framed.current=true;
  if(selected){const pad=selected.radius_m/111000*1.6,bounds:[[number,number],[number,number]]=[[selected.center[0]-pad,selected.center[1]-pad],[selected.center[0]+pad,selected.center[1]+pad]];if(animate)map.flyToBounds(bounds,{...padding,maxZoom:17,duration:.6});else map.fitBounds(bounds,{...padding,maxZoom:17,animate:false});return;}
  // Frame the districts that hold most sellers; far, tiny ones stay reachable from the list.
  const core=hubs.filter((hub,index)=>index<2||hub.share>=.05);
  const points=core.map(hub=>hub.center);if(location)points.push(location);
  if(points.length===1)map.setView(points[0],15,{animate:false});else if(points.length>1)map.fitBounds(points,{...padding,maxZoom:16,animate});
 // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the result set, selection or origin changes
 },[map,key,selected?.hub_id,location?.[0],location?.[1]]);
 return null;
}
function HubLabel({hub,selected,dy,onSelect}:{hub:BazaarHub;selected:boolean;dy:number;onSelect:()=>void}){
 const marker=useRef<LeafletMarker>(null);
 const icon=useMemo(()=>divIcon({className:'bazaar-hub-label',html:`<span dir="rtl"><b>${escape(hub.name)}</b><i>${faNumber(hub.shop_count)}</i></span>`,iconSize:[0,0],iconAnchor:[0,-dy]}),[hub.name,hub.shop_count,dy]);
 // One marker per district for its whole life: re-mounting during a fly animation strands it.
 const sync=useCallback(()=>{const element=marker.current?.getElement();if(!element)return;element.setAttribute('role','button');element.setAttribute('aria-pressed',String(selected));element.classList.toggle('is-selected',selected);element.classList.toggle('is-primary',hub.primary);},[selected,hub.primary]);
 useEffect(()=>{sync();marker.current?.setZIndexOffset(selected?2000:hub.primary?1000:0);},[sync,icon,selected,hub.primary]);
 return <Marker ref={marker} position={hub.center} icon={icon} keyboard title={`راستهٔ ${hub.name}، ${faNumber(hub.shop_count)} فروشگاه`} eventHandlers={{click:onSelect,add:sync}}/>;
}
function HubLabels({hubs,selectedHubId,onSelectHub}:{hubs:BazaarHub[];selectedHubId?:string;onSelectHub:(id:string)=>void}){
 const placement=useLabelPlacement(hubs);
 return <>{hubs.map(hub=><HubLabel key={hub.hub_id} hub={hub} dy={placement.get(hub.hub_id)?.dy??0} selected={hub.hub_id===selectedHubId} onSelect={()=>onSelectHub(hub.hub_id)}/>)}</>;
}
export default function BazaarMap({hubs,selectedHubId,selectedShopId,highlightShopIds,location,basemap,onSelectHub,onSelectShop}:{hubs:BazaarHub[];selectedHubId?:string;selectedShopId?:string;highlightShopIds:string[];location?:[number,number];basemap:Basemap;onSelectHub:(id:string)=>void;onSelectShop:(hubId:string,shopId:string)=>void}){
 const [tileError,setTileError]=useState(false);
 const selected=hubs.find(hub=>hub.hub_id===selectedHubId);
 const highlighted=new Set(highlightShopIds),dark=basemap==='dark';
 const fail=useCallback(()=>setTileError(true),[]);
 const max=Math.max(1,...hubs.map(hub=>hub.shop_count));
 return <div className={`bazaar-map ${dark?'is-dark':'is-light'}`}>
  <MapContainer center={[35.6892,51.4199]} zoom={13} preferCanvas zoomControl={false} style={{height:'100%',width:'100%'}}>
   {tileError?<TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url={fallbackUrl}/>:<VectorBase basemap={basemap} onFail={fail}/>}
   <Frame hubs={hubs} selected={selected} location={location}/>
   {hubs.map(hub=>{const active=hub.hub_id===selectedHubId,weight=hub.shop_count/max;return <Circle key={hub.hub_id} center={hub.center} radius={hub.radius_m} eventHandlers={{click:()=>onSelectHub(hub.hub_id)}} pathOptions={{color:active?(dark?'#fff':'#0e1016'):'#f43f5e',weight:active?2.5:1.5,fillColor:'#f43f5e',fillOpacity:selectedHubId&&!active?.05:.1+weight*.18,dashArray:hub.primary||active?undefined:'5 5'}}/>;})}
   {hubs.flatMap(hub=>hub.shops.map(shop=>{const inSelected=hub.hub_id===selectedHubId,lit=highlighted.has(shop.shop_id),chosen=shop.shop_id===selectedShopId;if(selectedHubId&&!inSelected&&!lit)return null;return <CircleMarker key={`${hub.hub_id}-${shop.shop_id}`} center={[shop.lat,shop.lon]} radius={chosen?9:lit?7:inSelected?5:3} eventHandlers={{click:()=>onSelectShop(hub.hub_id,shop.shop_id)}} pathOptions={{color:chosen||lit?'#0e1016':dark?'#0e1016':'#fff',weight:chosen?3:1.5,fillColor:chosen||lit?'#fbbf24':'#f43f5e',fillOpacity:1}}><Tooltip direction="top" offset={[0,-6]}>{shop.name||'نام فروشگاه نامشخص'}{shop.mall?` · ${shop.mall}`:''}</Tooltip></CircleMarker>;}))}
   <HubLabels hubs={hubs} selectedHubId={selectedHubId} onSelectHub={onSelectHub}/>
   {location&&<CircleMarker center={location} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#38bdf8',fillOpacity:1}}><Tooltip permanent direction="bottom" offset={[0,8]}>موقعیت شما</Tooltip></CircleMarker>}
  </MapContainer>
  {tileError&&<p className="bazaar-map-error" role="status">نقشهٔ پایه بارگذاری نشد؛ از نقشهٔ استاندارد OpenStreetMap استفاده شد.</p>}
 </div>;
}
