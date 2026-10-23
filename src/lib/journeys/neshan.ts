import {createHash} from 'node:crypto';
import {z} from 'zod';
import {query} from '../db/client';
import type {JourneyInput} from './contracts';
const segment=z.object({value:z.number().finite().nonnegative()});
const responseSchema=z.object({routes:z.array(z.object({overview_polyline:z.object({points:z.string().min(2).max(300000)}),legs:z.array(z.object({distance:segment,duration:segment,summary:z.string().max(1000).optional()})).min(1).max(8)})).min(1).max(5)});
export class NeshanError extends Error{constructor(public code:'unavailable'|'daily_limit'){super(code);}}
export function decodePolyline(encoded:string):[number,number][]{
  if(encoded.length>300000)throw new Error('geometry_limit');
  const points:[number,number][]=[];let offset=0,lat=0,lng=0;
  const next=()=>{let value=0,shift=0,byte:number;do{if(offset>=encoded.length||shift>30)throw new Error('geometry_invalid');byte=encoded.charCodeAt(offset++)-63;if(byte<0||byte>63)throw new Error('geometry_invalid');value|=(byte&31)<<shift;shift+=5;}while(byte>=32);return value&1?~(value>>1):value>>1;};
  while(offset<encoded.length){lat+=next();lng+=next();const p:[number,number]=[lat/1e5,lng/1e5];if(Math.abs(p[0])>90||Math.abs(p[1])>180||points.length>=30000)throw new Error('geometry_invalid');points.push(p);}
  if(points.length<2)throw new Error('geometry_invalid');return points;
}
async function reserveRequest(){
  const limit=Number(process.env.NESHAN_DAILY_REQUEST_LIMIT||100);if(!Number.isInteger(limit)||limit<1||limit>10000)throw new NeshanError('daily_limit');
  await query('CREATE TABLE IF NOT EXISTS routing_usage_daily(day text PRIMARY KEY,requests integer NOT NULL DEFAULT 0)');
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const rows=await query('INSERT INTO routing_usage_daily(day,requests) VALUES ($1,1) ON CONFLICT(day) DO UPDATE SET requests=routing_usage_daily.requests+1 WHERE routing_usage_daily.requests<$2 RETURNING requests',[day,limit]);if(!rows.length)throw new NeshanError('daily_limit');
}
async function limitedJson(response:Response){
  if(!response.body)throw new Error('empty_response');const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2000000){await reader.cancel();throw new Error('response_limit');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
type Direction={path:[number,number][];distanceMeters:number;durationSeconds:number;summary:string[];calculatedAt:string};
// Process-local only: coordinates and routes are never written to the usage DB.
const routeCache=new Map<string,{expiresAt:number;route:Direction}>();
const pendingRoutes=new Map<string,Promise<Direction>>();
const routeTtlMs=120000,routeCacheLimit=128;
export async function neshanDirection(origin:{lat:number;lng:number},stops:{lat:number;lng:number}[],mode:JourneyInput['travelMode'],signal?:AbortSignal):Promise<Direction>{
  const key=process.env.NESHAN_API_KEY;if(!key||!stops.length||signal?.aborted)throw new NeshanError('unavailable');
  // Official pedestrian docs declare v4, but show v1 samples. Never silently
  // retry a paid request: let the operator select the documented version.
  const version=mode==='walking'&&process.env.NESHAN_WALKING_API_VERSION==='v1'?'v1':'v4';
  const keyHash=createHash('sha256').update(key).digest('hex');
  const cacheKey=createHash('sha256').update(JSON.stringify([keyHash,version,mode,origin.lat,origin.lng,stops.map(p=>[p.lat,p.lng])])).digest('hex');
  const now=Date.now();for(const [id,cached] of routeCache)if(cached.expiresAt<=now)routeCache.delete(id);
  const cached=routeCache.get(cacheKey);if(cached)return structuredClone(cached.route);
  let pending=pendingRoutes.get(cacheKey);
  if(!pending){
    if(pendingRoutes.size>=routeCacheLimit)throw new NeshanError('unavailable');
    pending=fetchDirection(origin,stops,mode,version,key).then(route=>{
      if(routeCache.size>=routeCacheLimit)routeCache.delete(routeCache.keys().next().value!);
      routeCache.set(cacheKey,{expiresAt:Date.now()+routeTtlMs,route});return route;
    }).finally(()=>{pendingRoutes.delete(cacheKey);});
    pendingRoutes.set(cacheKey,pending);
  }
  return structuredClone(await waitForRoute(pending,signal));
}
async function waitForRoute(pending:Promise<Direction>,signal?:AbortSignal):Promise<Direction>{
  if(!signal)return pending;
  if(signal.aborted)throw new NeshanError('unavailable');
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new NeshanError('unavailable'));
    signal.addEventListener('abort',abort,{once:true});
    pending.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
async function fetchDirection(origin:{lat:number;lng:number},stops:{lat:number;lng:number}[],mode:JourneyInput['travelMode'],version:string,key:string):Promise<Direction>{
  await reserveRequest();
  const url=new URL(`https://api.neshan.org/${version}/direction`);const point=(p:{lat:number;lng:number})=>`${p.lat},${p.lng}`;
  url.searchParams.set('type',mode==='walking'?'pedestrian':'car');url.searchParams.set('origin',point(origin));url.searchParams.set('destination',point(stops[stops.length-1]));url.searchParams.set('alternative','false');
  if(stops.length>1)url.searchParams.set('waypoints',stops.slice(0,-1).map(point).join('|'));
  const timeout=AbortSignal.timeout(10000);
  try{
    const response=await fetch(url,{headers:{'Api-Key':key},signal:timeout,redirect:'error',cache:'no-store'});if(!response.ok)throw new Error('provider_response');
    const route=responseSchema.parse(await limitedJson(response)).routes[0];
    if(route.legs.length!==stops.length)throw new Error('route_legs_mismatch');
    return {path:decodePolyline(route.overview_polyline.points),distanceMeters:route.legs.reduce((sum,l)=>sum+l.distance.value,0),durationSeconds:route.legs.reduce((sum,l)=>sum+l.duration.value,0),summary:route.legs.map(l=>l.summary).filter((s):s is string=>Boolean(s)),calculatedAt:new Date().toISOString()};
  }catch{throw new NeshanError('unavailable');}
}
