import {createHash,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {ToolError} from '../agent/tools';
import {ContactService,liveEligibility,publicJob,transition} from './service';
import type {StoredJob} from './store';
import type {ContactStatus} from './contracts';
export type GatewayDispatch={jobId:string;idempotencyKey:string;channel:'voice'|'sms';destination:string;offerId:string;shopId:string;productId:string;productTitle:string|null;productModel:string|null;maxCostToman:number;instructions:string};
export type GatewayTransport=(payload:GatewayDispatch)=>Promise<{gatewayId:string}>;
const gatewayAck=z.object({gatewayId:z.string().min(1).max(200)}).strict();
const callbackSchema=z.object({eventId:z.string().min(8).max(120).regex(/^[a-zA-Z0-9_-]+$/),jobId:z.string().uuid(),status:z.enum(['dialing','sending','waiting','completed','unanswered','failed']),chargedCostToman:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),result:z.object({outcome:z.enum(['available','not_available','unanswered','price_changed','unknown']),reportedPriceToman:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable()}).strict().optional()}).strict();
/** A claimed job is uncertain before crossing the network boundary. It is never auto-retried. */
export async function dispatchOne(service:ContactService,transport:GatewayTransport):Promise<boolean>{
  if(!service.options.liveEnabled)return false;
  const now=service.options.now?.()??Date.now();
  const claimed=await service.store.atomic(async db=>{
    const rows=await db.query<{payload:StoredJob}>(`SELECT payload FROM contact_jobs WHERE payload->>'mode'='live' AND payload->>'status'='queued' ORDER BY payload->>'createdAt' LIMIT 100`);
    for(const {payload:j} of rows.rows){
      const eligible=liveEligibility(j.shopId,j.channel,service.options);
      const subject=(await db.query<{persian_title:string|null;model:string|null}>('SELECT persian_title,model FROM products WHERE product_id=$1',[j.productId])).rows[0];
      if(eligible.reason||eligible.cost!==j.maxCostToman||!subject){
        transition(j,'failed',now,'مجوز مخاطب، تعرفه یا اطلاعات کالا تغییر کرده است؛ پیش از استعلام واقعی تأیید تازه لازم است.');
        await service.store.save(db,j);continue;
      }
      // A prior-day approval is not a reservation for today's phone traffic.
      // Reserve again in a separate dispatch ledger, never refund uncertain sends.
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
      const budget=await db.query(`INSERT INTO contact_dispatch_daily(day,requests,reserved) SELECT $1,1,$2::bigint WHERE $2::bigint<=$3::bigint AND $4::integer>0 ON CONFLICT(day) DO UPDATE SET requests=contact_dispatch_daily.requests+1,reserved=contact_dispatch_daily.reserved+EXCLUDED.reserved WHERE contact_dispatch_daily.requests<$4 AND contact_dispatch_daily.reserved+EXCLUDED.reserved<=$3::bigint RETURNING requests`,[day,j.maxCostToman,service.options.dailyCostToman??0,service.options.dailyJobs??100]);
      if(!budget.rows.length)continue;
      transition(j,'dispatch_uncertain',now,'ارسال در حال بررسی؛ تکرار خودکار برای جلوگیری از تماس تکراری ممنوع است.');
      j.claimedAt=new Date(now).toISOString();j.dispatchDay=day;await service.store.save(db,j);
      return {...j,productTitle:subject.persian_title,productModel:subject.model};
    }
    return null;
  });
  if(!claimed)return false;
  const contact=service.options.registry!.find(c=>c.shopId===claimed.shopId)!;
  try{
    const ack=gatewayAck.parse(await transport({jobId:claimed.id,idempotencyKey:claimed.id,channel:claimed.channel,destination:contact.destination,offerId:claimed.offerId,shopId:claimed.shopId,productId:claimed.productId,productTitle:claimed.productTitle,productModel:claimed.productModel,maxCostToman:claimed.maxCostToman,instructions:'خود را دستیار ربات معرفی کنید. فقط درباره قیمت و موجودی همین محصول و امکان مراجعه حضوری سؤال کنید. گزارش درگاه تأیید مستقل نیست. سقف هزینه و کلید یکتای درخواست را رعایت کنید.'}));
    await service.store.atomic(async db=>{const row=(await db.query<{payload:StoredJob}>('SELECT payload FROM contact_jobs WHERE id=$1',[claimed.id])).rows[0];if(row?.payload.status==='dispatch_uncertain'){const j=row.payload;j.gatewayId=ack.gatewayId;transition(j,'waiting',service.options.now?.()??Date.now(),'درگاه درخواست را پذیرفته؛ در انتظار گزارش تأییدنشده');await service.store.save(db,j);}});
  }catch{/* Keep uncertainty and dispatch-day reservation. Never automatically send twice. */}
  return true;
}
export function secureEquals(actual:string,expected:string){const a=createHash('sha256').update(actual).digest(),b=createHash('sha256').update(expected).digest();return timingSafeEqual(a,b);}
export async function handleCallback(service:ContactService,secret:string,input:unknown){const configured=service.options.callbackSecret;if(!configured||configured.length<32||!secureEquals(secret,configured))throw new ToolError('اعتبار گزارش درگاه پذیرفته نشد.',401);const v=callbackSchema.parse(input),hash=createHash('sha256').update(JSON.stringify(v)).digest('hex');return service.store.atomic(async db=>{const row=(await db.query<{payload:StoredJob}>('SELECT payload FROM contact_jobs WHERE id=$1',[v.jobId])).rows[0];if(!row||row.payload.mode!=='live')throw new ToolError('استعلام واقعی یافت نشد.',404);const j=row.payload;const replay=(await db.query<{job_id:string;payload_hash:string}>('SELECT job_id,payload_hash FROM contact_callback_events WHERE event_id=$1',[v.eventId])).rows[0];if(replay){if(replay.job_id!==j.id||replay.payload_hash!==hash)throw new ToolError('شناسه گزارش تکراری با محتوای متفاوت.',409);return publicJob(j);}const allowed:Partial<Record<ContactStatus,ContactStatus[]>>={dispatch_uncertain:['dialing','sending','waiting','completed','unanswered','failed'],dialing:['waiting','completed','unanswered','failed'],sending:['waiting','completed','unanswered','failed'],waiting:['completed','unanswered','failed']};if(!allowed[j.status]?.includes(v.status)||(v.status==='dialing'&&j.channel!=='voice')||(v.status==='sending'&&j.channel!=='sms'))throw new ToolError('ترتیب وضعیت گزارش معتبر نیست.',409);if(v.chargedCostToman>j.maxCostToman||v.chargedCostToman<j.chargedCostToman)throw new ToolError('هزینه گزارش از سقف تأییدشده یا ترتیب مجاز خارج است.',409);if(v.result&&!['completed','unanswered'].includes(v.status))throw new ToolError('نتیجه فقط در وضعیت پایانی پذیرفته است.',409);const now=service.options.now?.()??Date.now();transition(j,v.status,now,'گزارش درگاه؛ تأیید مستقل فروشنده انجام نشده است.');j.chargedCostToman=v.chargedCostToman;if(['completed','unanswered'].includes(v.status))j.result={outcome:v.result?.outcome??(v.status==='unanswered'?'unanswered':'unknown'),reportedPriceToman:v.result?.reportedPriceToman??null,source:'gateway_report',verificationStatus:'unknown',reportedAt:new Date(now).toISOString()};await db.query('INSERT INTO contact_callback_events(event_id,job_id,payload_hash) VALUES($1,$2,$3)',[v.eventId,j.id,hash]);await service.store.save(db,j);return publicJob(j);});}
export function httpsGatewayTransport(options:ContactService['options']):GatewayTransport{return async payload=>{const response=await fetch(options.gatewayUrl!,{method:'POST',headers:{authorization:`Bearer ${options.gatewayToken}`,'content-type':'application/json','idempotency-key':payload.idempotencyKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('Gateway rejected dispatch');if(!response.body)throw Error('Missing gateway acknowledgment');const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>8192){await reader.cancel();throw Error('Gateway acknowledgment too large');}text+=decoder.decode(chunk.value,{stream:true});}}finally{reader.releaseLock();}return gatewayAck.parse(JSON.parse(text+decoder.decode()));};}
