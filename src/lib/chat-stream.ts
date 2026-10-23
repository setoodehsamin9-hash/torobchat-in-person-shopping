import {setTimeout as delay} from 'node:timers/promises';
import type {ChatResponse,ToolEvent,UIBlock} from './contracts';

export type ChatStreamEvent=
 |{type:'status';message:string}
 |{type:'tool';event:ToolEvent}
 |{type:'block';block:UIBlock}
 |{type:'text';delta:string}
 |{type:'done';response:ChatResponse}
 |{type:'error';message:string};
export type ChatObserver=(event:ChatStreamEvent)=>void;

export function createChatStream(task:(emit:ChatObserver,signal:AbortSignal)=>Promise<ChatResponse>,external?:AbortSignal):Response{
 const abort=new AbortController(),signal=external?AbortSignal.any([external,abort.signal]):abort.signal;
 const encoder=new TextEncoder();let closed=false;
 const body=new ReadableStream<Uint8Array>({
  async start(controller){
   const emit:ChatObserver=event=>{if(!closed&&!signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
   try{
    const response=await task(emit,signal);
    // Tool/stage events arrive while work runs. Only the approved final prose
    // is revealed in small pieces; these are presentation chunks, not raw tokens.
    const words=response.reply.match(/\S+\s*/gu)??[];
    const size=Math.max(4,Math.ceil(words.length/40));
    for(let i=0;i<words.length;i+=size){
     if(signal.aborted)break;emit({type:'text',delta:words.slice(i,i+size).join('')});
     if(i+size<words.length)await delay(16,undefined,{signal});
    }
    if(!signal.aborted)emit({type:'done',response});
   }catch{
    if(!signal.aborted)emit({type:'error',message:'پاسخ کامل نشد؛ دوباره با حفظ شرایط خرید تلاش کنید.'});
   }finally{
    if(!closed){closed=true;controller.close();}
   }
  },
  cancel(){closed=true;abort.abort();},
 });
 return new Response(body,{headers:{'content-type':'application/x-ndjson; charset=utf-8','cache-control':'no-store, no-transform','x-accel-buffering':'no','x-content-type-options':'nosniff',vary:'Accept'}});
}
