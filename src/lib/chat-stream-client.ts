import {z} from 'zod';
import type {ChatResponse,UIBlock} from './contracts';
import type {ChatStreamEvent} from './chat-stream';
import {outputSchemas,sessionSchema} from './agent/schemas';

function validBlock(value:unknown):value is UIBlock{
 if(!value||typeof value!=='object'||!('type'in value))return false;
 const b=value as Record<string,unknown>;
 switch(b.type){
  case 'products':return typeof b.title==='string'&&outputSchemas.searchProducts.safeParse({data:b.products,total:0,page:1,limit:40}).success;
  case 'offers':return typeof b.title==='string'&&outputSchemas.getProductOffers.safeParse({...b,data:b.offers,total:0,page:1,limit:40,disclaimer:''}).success;
  case 'store_discovery':return typeof b.title==='string'&&outputSchemas.searchStoreOffers.safeParse(b).success;
  case 'product_comparison':return outputSchemas.compareProducts.safeParse(b).success;
  case 'offer_comparison':return outputSchemas.compareOffers.safeParse(b).success;
  case 'alternatives':return outputSchemas.findAlternatives.safeParse(b).success;
  case 'visit_plan':return outputSchemas.buildVisitPlan.safeParse(b).success;
  case 'shop':return outputSchemas.getStoreDetails.safeParse(b.shop).success;
  case 'store_hours':return outputSchemas.getStoreHours.safeParse(b).success;
  case 'payment_options':return outputSchemas.getPaymentOptions.safeParse(b).success;
  case 'inquiry':return outputSchemas.buildInquiryDraft.safeParse(b).success;
  default:return false;
 }
}
const blockSchema=z.custom<UIBlock>(validBlock);
const toolEvent=z.object({tool:z.string().max(100),label:z.string().max(500),status:z.enum(['complete','error']),duration_ms:z.number().finite().nonnegative()});
const canonical=z.object({reply:z.string().max(20000),mode:z.enum(['deterministic','provider']),blocks:z.array(blockSchema).max(64),events:z.array(toolEvent).max(100),session:sessionSchema,agent:z.object({request_id:z.string().max(200),phases:z.array(z.string().max(500)).max(30),provider_requests:z.number().int().nonnegative(),tool_calls:z.number().int().nonnegative(),model:z.string().max(200).optional(),provider:z.string().max(100).optional(),fallback_reason:z.string().max(100).optional(),retrieval:z.object({mode:z.enum(['disabled','index_empty','hybrid','lexical_fallback','skipped']),indexed_products:z.number().nonnegative(),candidates:z.number().nonnegative(),limited:z.boolean(),duration_ms:z.number().nonnegative()}).optional()}).optional()});
const eventSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('status'),message:z.string().max(1000)}),
 z.object({type:z.literal('tool'),event:toolEvent}),
 z.object({type:z.literal('block'),block:blockSchema}),
 z.object({type:z.literal('text'),delta:z.string().max(20000)}),
 z.object({type:z.literal('done'),response:canonical}),
 z.object({type:z.literal('error'),message:z.string().max(1000)}),
]);
const maxFrameBytes=2000000,maxStreamBytes=16000000,maxFrames=256;

export async function streamChat(input:unknown,onEvent:(event:ChatStreamEvent)=>void,signal?:AbortSignal):Promise<ChatResponse>{
 const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify(input),signal});
 if(!response.ok){let message='دریافت پاسخ ممکن نشد.';try{const data=await response.json();if(typeof data.error==='string')message=data.error.slice(0,1000);}catch{}throw new Error(message);}
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
  const result=canonical.parse(await response.json()) as ChatResponse;onEvent({type:'done',response:result});return result;
 }
 if(!response.body)throw new Error('پاسخ کامل دریافت نشد.');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',bytes=0,frames=0,final:ChatResponse|undefined;
 const consume=(line:string)=>{
  if(!line.trim())return;
  if(final)throw new Error('داده‌ای پس از پایان پاسخ دریافت شد.');
  if(++frames>maxFrames||new TextEncoder().encode(line).byteLength>maxFrameBytes)throw new Error('حجم پاسخ بیش از حد مجاز است.');
  const event=eventSchema.parse(JSON.parse(line)) as ChatStreamEvent;
  if(event.type==='error')throw new Error(event.message);
  if(event.type==='done')final=event.response;
  onEvent(event);
 };
 try{
  for(;;){
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   const part=await reader.read();if(part.done)break;
   bytes+=part.value.byteLength;if(bytes>maxStreamBytes)throw new Error('حجم پاسخ بیش از حد مجاز است.');
   buffer+=decoder.decode(part.value,{stream:true});let index:number;
   while((index=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,index));buffer=buffer.slice(index+1);}
   if(new TextEncoder().encode(buffer).byteLength>maxFrameBytes)throw new Error('حجم پاسخ بیش از حد مجاز است.');
  }
  buffer+=decoder.decode();if(buffer.trim())consume(buffer);
  if(!final)throw new Error('پاسخ کامل دریافت نشد؛ نتیجهٔ جزئی ذخیره نشد.');
  return final;
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
}
