import { useEffect, useState } from 'react';

export async function api<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,init);
  const body=await response.json();
  if(!response.ok) throw new Error(typeof body.error==='string'?body.error:'دریافت اطلاعات ممکن نشد. دوباره تلاش کنید.');
  return body as T;
}
export function queryString(values:object):string {
  const q=new URLSearchParams();
  Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v));});
  return q.toString();
}
export function useData<T>(url:string|null) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[version,setVersion]=useState(0);
  useEffect(()=>{setData(null);if(!url){setLoading(false);return;}const abort=new AbortController();let active=true;setLoading(true);setError('');const timer=setTimeout(()=>{if(active){setError('دریافت اطلاعات طول کشید. دوباره تلاش کنید.');setLoading(false);abort.abort();}},25000);api<T>(url,{signal:abort.signal}).then(value=>{if(active&&!abort.signal.aborted)setData(value);}).catch((e:Error)=>{if(active&&!abort.signal.aborted)setError(e.message);}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});return()=>{active=false;clearTimeout(timer);abort.abort();};},[url,version]);
  return {data,error,loading,retry:()=>setVersion(v=>v+1)};
}
export const fa=(n:number)=>new Intl.NumberFormat('fa-IR').format(n);
export const money=(n:number|null)=>n===null?'قیمت نامشخص':`${fa(n)} تومان`;
export const priceRange=(min:number|null,max:number|null)=>min!==null&&max!==null&&min!==max?`${fa(min)} تا ${fa(max)} تومان`:money(min);
export function warrantyLabel(value:string|null){if(!value)return 'نامشخص';try{const v:unknown=JSON.parse(value);if(typeof v==='string')return v;if(v&&typeof v==='object'){const labels:Record<string,string>={provider:'شرکت',provider_name:'شرکت',period_months:'مدت (ماه)',description:'توضیح',type:'نوع',name:'عنوان',duration:'مدت',has_warranty:'دارای گارانتی'};const parts=Object.entries(v).filter(([,item])=>item!==null&&item!==undefined&&item!=='').map(([key,item])=>`${labels[key]||key}: ${typeof item==='boolean'?(item?'بله':'خیر'):typeof item==='object'?JSON.stringify(item):String(item)}`);return parts.join(' · ')||'نامشخص';}}catch{}return value;}
export function offerFilters(session:import('./contracts').PurchaseSession):import('./contracts').OfferFilters {const {minPrice,maxPrice,lat,lng,radiusKm,installmentOnly,region,visitAt,sort}=session;return {minPrice,maxPrice,lat,lng,sort,radiusKm:lat!==undefined&&lng!==undefined?radiusKm:undefined,installmentOnly,region,visitAt};}
export function dateLabel(value:string|null){if(!value)return 'نامشخص';const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(d);}
export async function runTool<T=unknown>(tool:string,input:object){return api<{result:T;blocks:import('./contracts').UIBlock[];event:import('./contracts').ToolEvent}>('/api/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input})});}
