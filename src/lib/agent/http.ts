import { createHash } from 'node:crypto';
import { ZodError } from 'zod';
import { ToolError } from './tools';

const buckets=new Map<string,{count:number;reset:number}>();
const MAX_BYTES=32768;
function allowedOrigin(origin:string,requestUrl:string):boolean{
  try{
    const incoming=new URL(origin),request=new URL(requestUrl);
    if(incoming.origin===request.origin)return true;
    if(process.env.NEXT_PUBLIC_APP_URL&&incoming.origin===new URL(process.env.NEXT_PUBLIC_APP_URL).origin)return true;
    // NextURL canonicalizes local loopback hostnames to localhost while browsers
    // retain the original Origin. Keep this development exception narrow.
    const loopback=new Set(['localhost','127.0.0.1','[::1]']);
    return process.env.NODE_ENV==='development'&&loopback.has(incoming.hostname)&&loopback.has(request.hostname)&&incoming.protocol===request.protocol&&incoming.port===request.port;
  }catch{return false;}
}
export async function readSafeJson(request:Request):Promise<unknown>{
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new ToolError('درخواست بین‌سایتی پذیرفته نیست.',403);
  if(origin&&!allowedOrigin(origin,request.url))throw new ToolError('مبدأ درخواست معتبر نیست.',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ToolError('بدنه باید JSON باشد.',415);
  if(Number(request.headers.get('content-length')??0)>MAX_BYTES)throw new ToolError('حجم درخواست بیش از حد مجاز است.',413);
  const now=Date.now();
  for(const [key,value] of buckets)if(value.reset<=now)buckets.delete(key);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local';
  const key=createHash('sha256').update(ip).digest('hex').slice(0,20);
  let bucket=buckets.get(key);if(!bucket){if(buckets.size>=2000)throw new ToolError('سرویس موقتاً شلوغ است.',429);bucket={count:0,reset:now+60000};buckets.set(key,bucket);}
  if(++bucket.count>40)throw new ToolError('تعداد درخواست زیاد است؛ یک دقیقه دیگر تلاش کنید.',429);
  if(!request.body)throw new ToolError('بدنه درخواست خالی است.');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw new ToolError('حجم درخواست بیش از حد مجاز است.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ToolError('JSON درخواست معتبر نیست.');}
}
export function jsonResponse(body:unknown,status=200){return Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
export function safeError(error:unknown,tool='request',started=performance.now()){
  const status=error instanceof ToolError?error.status:error instanceof ZodError?400:503;
  const message=error instanceof ToolError?error.message:error instanceof ZodError?'ورودی یا شناسه‌ها معتبر نیست؛ محدودیت‌ها را بررسی کنید.':'دسترسی به داده‌ها موقتاً ممکن نیست. دوباره تلاش کنید.';
  // No raw provider/SQL error, precise location, API key or fictional phone enters logs or responses.
  return jsonResponse({error:message,event:{tool,label:'درخواست انجام نشد',status:'error',duration_ms:Math.round(performance.now()-started)}},status);
}
