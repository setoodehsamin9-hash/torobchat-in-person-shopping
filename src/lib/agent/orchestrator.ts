import { randomUUID } from 'node:crypto';
import { withEmbeddingBudget } from '../retrieval/budget';
import { normalizeText } from '../domain';
import type { ChatResponse, PurchaseSession, OfferFilters, RetrievalInfo } from '../contracts';
import { chatInputSchema } from './schemas';
import { runProvider, type Followup, type ProviderTurn } from './provider';
import { runTool,toolLabels } from './tools';
import type {ChatObserver} from '../chat-stream';
import {visibleChatBlocks} from '../chat-presentation';

export function parseMessageSession(message:string,previous:PurchaseSession):PurchaseSession{
  const s={...previous},text=normalizeText(message);
  if(/^(سلام|درود|سلام خوبی|سلام وقت بخیر)[!؟?. ]*$/.test(text)){s.intent='clarify';return s;}
  const budgetText=normalizeText(message.replace(/[.٫]/g,'decimalmark')).replace(/decimalmark/g,'.');
  const match=budgetText.match(/(?:تا|حداکثر|بودجه(?:\s*ام)?(?:\s*حداکثر)?)\s*(\d+(?:\.\d+)?)\s*(میلیون|میلیارد|هزار)?(?:\s*تومان)?/);
  if(match){const factor=match[2]==='میلیارد'?1e9:match[2]==='میلیون'?1e6:match[2]==='هزار'?1e3:1;const amount=Number(match[1].replace(/\s/g,''))*factor;if(Number.isSafeInteger(amount)&&amount>=0)s.maxPrice=amount;}
  const minimum=text.match(/(?:از|حداقل)\s*(\d+)\s*(میلیون|میلیارد|هزار)\s*(?:تومان)?/);if(minimum)s.minPrice=Number(minimum[1])*(minimum[2]==='میلیارد'?1e9:minimum[2]==='میلیون'?1e6:1e3);
  if(/بدون (?:اقساط|خرید اعتباری|اعتبار)|نقدی/.test(text))s.installmentOnly=false;else if(/اقساط|قسطی|اعتباری/.test(text))s.installmentOnly=true;
  const radius=text.match(/(?:شعاع|فاصله|محدوده)\s*(\d+)\s*(?:کیلومتر|کیلومتری)/);if(radius&&s.lat!==undefined&&s.lng!==undefined)s.radiusKm=Math.max(0.1,Math.min(100,Number(radius[1])));
  if(/جایگزین|ناموجود|پاسخ نداد|پاسخ نداده|تعطیل/.test(text))s.intent='alternatives';
  else if(/برنامه|مراجعه|بازدید/.test(text)&&s.selected_offer_ids?.length)s.intent='visit';
  else if(/استعلام|پیام|تماس/.test(text)&&s.selected_offer_ids?.length)s.intent='inquiry';
  else if(/مقایسه/.test(text))s.intent='compare';
  else if((/فروشگاه|فروشنده|نزدیک/.test(text)||/^(?:قیمتش|قیمت|چنده|چند است|ارزان تر|ارزانترین|موجوده|با اقساط|اقساط)(?:\s+(?:چنده|چند است|چی|چطوره|داره|هم))?$/.test(text))&&s.product_id)s.intent='offers';
  else s.intent='search';
  if(!s.product_id&&/کجا|کدوم فروشگاه|کدام فروشگاه/.test(text))s.intent='stores';
  if(!s.product_id&&(/نقشه/.test(text)||/فروشگاه.*(?:کفش|لباس|پوشاک)|(?:کفش|لباس|پوشاک).*فروشگاه/.test(text)))s.intent='store_map';
  if(/ارزان|ارزون|کمترین قیمت/.test(text))s.sort='price';else if(/نزدیک/.test(text))s.sort='distance';
  const cleaned=text.replace(/(?:تا|حداکثر|بودجه(?:\s*ام)?(?:\s*حداکثر)?)\s*\d+\s*(?:میلیون|میلیارد|هزار)?\s*(?:تومان)?/g,'').replace(/(?:از|حداقل)\s*\d+\s*(?:میلیون|میلیارد|هزار)\s*(?:تومان)?/g,'').replace(/(?:شعاع|فاصله|محدوده)\s*\d+\s*(?:کیلومتر|کیلومتری)/g,'').replace(/(?:با|بدون)\s*اقساط|قسطی|نقدی|میخواهم|می خواهم|لطفا|تومان/g,'').replace(/\b(?:حالا|همونا|همین|قبلی|فقط)\b/g,'').trim();
  const followup=Boolean(s.product_id)&&(/همین|همونا|قبلی|ارزان تر|ارزون تر|نزدیک تر/.test(text)||/^(?:حالا\s*)?(?:تا|حداکثر|بودجه|اقساط|قسطی|نقدی|با اقساط|بدون اقساط)/.test(text));
  if(followup&&s.intent==='search')s.intent='offers';
  const storeWords=new Set(['توی','تو','در','تهران','هارو','ها','رو','را','کجا','به','صورت','خرید','اعتباری','میدن','میدهند','می','دن','کدوم','کدام','فروشگاه','میشه','بخرم','از','بهم','که','دارن','دارند','داره','دارای','نمایش','نشان','نشون','بده','دهید','روی','نقشه','لطفا','هایی','های']);
  const storeQuery=cleaned.replace(/لپتاپ|لپ تاب/g,'لپ تاپ').replace(/فروشگاه\s*(?:هایی|های|ها)?/g,' ').split(/\s+/).filter(t=>t&&!storeWords.has(t)).join(' ');
  if((s.intent==='search'||s.intent==='stores'||s.intent==='store_map')&&cleaned.length>1){s.query=(s.intent==='stores'||s.intent==='store_map'?storeQuery:cleaned).slice(0,300);s.product_id=undefined;s.selected_product_ids=[];s.selected_offer_ids=[];}
  return s;
}
function sessionFilters(s:PurchaseSession):OfferFilters{return {minPrice:s.minPrice,maxPrice:s.maxPrice,lat:s.lat,lng:s.lng,radiusKm:s.radiusKm,region:s.region,sort:s.sort,installmentOnly:s.installmentOnly,visitAt:s.visitAt,limit:40};}
type ToolRun=typeof runTool;
function discoveryCategory(s:PurchaseSession){return /^(?:لپ\s*تاپ|laptop)(?:\s|$)/.test(s.query??'')?'لپ تاپ و نوت بوک':undefined;}
async function deterministic(s:PurchaseSession,call:ToolRun,lexical=false){
  if(s.intent==='store_map'&&!s.product_id)return [await call('searchStoreOffers',{query:s.query??'',filters:sessionFilters(s),limit:5})];
  if(s.intent==='stores'&&!s.product_id){
    const found=await call('searchProducts',{query:s.query??'',...(lexical?{retrieval:'lexical'}:{}),category:discoveryCategory(s),minPrice:s.minPrice,maxPrice:s.maxPrice,filters:sessionFilters(s),limit:3});
    const block=found.blocks.find(b=>b.type==='products');
    const offers:Awaited<ReturnType<ToolRun>>[]=[];
    if(block?.type==='products')for(const product of block.products.slice(0,3))offers.push(await call('getProductOffers',{productId:product.product_id,filters:{...sessionFilters(s),limit:2}}));
    return [found,...offers];
  }
  if(s.intent==='alternatives'&&s.product_id)return [await call('findAlternatives',{productId:s.product_id,constraints:sessionFilters(s),excludeOfferIds:s.selected_offer_ids??[],reason:'user_requested'})];
  if(s.intent==='visit'&&s.selected_offer_ids?.length)return [await call('buildVisitPlan',{offerIds:s.selected_offer_ids,...(s.lat!==undefined&&s.lng!==undefined?{location:{lat:s.lat,lng:s.lng}}:{})})];
  if(s.intent==='inquiry'&&s.selected_offer_ids?.length)return [await call('buildInquiryDraft',{offerId:s.selected_offer_ids[0]})];
  if(s.intent==='compare'){
    if(s.product_id&&(s.selected_offer_ids?.length??0)>=2)return [await call('compareOffers',{productId:s.product_id,offerIds:s.selected_offer_ids})];
    if((s.selected_product_ids?.length??0)>=2)return [await call('compareProducts',{productIds:s.selected_product_ids})];
  }
  if(s.product_id)return [await call('getProductOffers',{productId:s.product_id,filters:sessionFilters(s)})];
  return [await call('searchProducts',{query:s.query??'',minPrice:s.minPrice,maxPrice:s.maxPrice,filters:sessionFilters(s),limit:5})];
}
const questions:Record<Followup,string>={none:'',budget:'حداکثر بودجه‌ات برای این خرید چقدر است؟',use_case:'چه کالایی می‌خواهی و بیشتر برای چه کاری از آن استفاده می‌کنی؟',select_product:'کدام محصول مدنظرت است؟ از کارت‌ها انتخابش کن تا فروشگاه‌های همان کالا را بررسی کنم.',select_offers:'برای این کار، پیشنهادهای فروشگاه موردنظرت را از کارت‌ها انتخاب کن.',location:'برای پیدا کردن فروشگاه نزدیک، محله یا نقطه‌ای روی نقشه انتخاب کن.'};
const providerProblems:Record<string,string>={
  timeout:'زمان انتظار پاسخ مدل تمام شد.',
  daily_limit:'سقف روزانه درخواست‌های مدل در این برنامه پر شده است.',
  provider_limit:'سرویس مدل محدودیت مصرف اعلام کرد.',
  provider_auth:'کلید یا مجوز اتصال مدل پذیرفته نشد.',
  provider_configuration:'تنظیمات اتصال مدل معتبر نیست.',
  context_limit:'زمینه گفتگو از اندازه مجاز پردازش مدل بیشتر شد.',
  review_incomplete:'بررسی نهایی مدل کامل نشد؛ این نتیجه فقط از داده‌های ثبت‌شده آماده شده است.',
  no_valid_tool:'مدل ابزار معتبری برای این درخواست اجرا نکرد.',
  provider_unavailable:'سرویس مدل در این مرحله در دسترس نبود.',
};
export function orchestrateChat(raw:unknown,call:ToolRun=runTool,signal?:AbortSignal,observe?:ChatObserver):Promise<ChatResponse>{return withEmbeddingBudget(2,()=>orchestrateTurn(raw,call,signal,observe));}
async function orchestrateTurn(raw:unknown,originalCall:ToolRun,signal?:AbortSignal,observe?:ChatObserver):Promise<ChatResponse>{
  observe?.({type:'status',message:'در حال بررسی پیام و شرایط خرید شما…'});
  const call:ToolRun=async(name,args)=>{
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    observe?.({type:'status',message:`در حال ${toolLabels[name as keyof typeof toolLabels]??'بررسی داده‌های ثبت‌شده'}…`});
    const result=await originalCall(name,args);
    if(!signal?.aborted){
      observe?.({type:'tool',event:result.event});
      observe?.({type:'status',message:'در حال بررسی نتیجه‌ها و آماده‌سازی پاسخ نهایی…'});
    }
    return result;
  };
  const input=chatInputSchema.parse(raw),previous={...input.session},direct=Boolean(input.interaction);
  const ordinal=normalizeText(input.message).match(/^(?:گزینه\s*)?(اولی|اول|دومی|دوم|سومی|سوم|چهارمی|چهارم)(?:\s|$)/);
  if(!direct&&ordinal){const names=['اول','دوم','سوم','چهارم'],index=names.findIndex(n=>ordinal[1].startsWith(n)),p=input.context.products[index];if(p){previous.product_id=p.product_id;previous.selected_product_ids=[p.product_id];previous.selected_offer_ids=[];}}
  const session=direct?{...previous}:parseMessageSession(input.message,previous);
  if(direct){
    session.product_id=previous.product_id??(previous.selected_product_ids?.length===1?previous.selected_product_ids[0]:undefined);
    session.intent=session.product_id?'offers':'stores';
    if(!session.product_id&&!session.query){const parsed=parseMessageSession(input.message,{});session.query=parsed.query?.replace(/فروشگاه(?:‌ها|ها|های)?|نزدیک من|نمایش/g,'').trim()||undefined;}
    if(input.interaction==='credit_stores')session.installmentOnly=true;
    if(input.interaction==='nearby_stores')session.sort='distance';
  }
  if(!direct&&ordinal&&previous.product_id){session.product_id=previous.product_id;session.selected_product_ids=previous.selected_product_ids;session.intent=/مقایسه/.test(input.message)?'compare':'offers';}
  chatInputSchema.parse({message:input.message,session});
  const phases=direct?['دریافت اقدام صریح کاربر','حفظ محصول و محدودیت‌های انتخابی']:['دریافت زمینه گفتگو','تشخیص درخواست و محدودیت‌ها'];
  let mode:ChatResponse['mode']='deterministic',results:Awaited<ReturnType<ToolRun>>[]=[],extraEvents:ChatResponse['events']=[],question:Followup='none',failure:string|undefined,requests=0,guidance:string|undefined,model:string|undefined,provider:string|undefined;
  let retrieval:RetrievalInfo={mode:'disabled',indexed_products:0,candidates:0,limited:true,duration_ms:0};
  if(direct){
    retrieval.mode='skipped';
    if(input.interaction==='nearby_stores'&&(session.lat===undefined||session.lng===undefined))question='location';
    else if(!session.product_id&&!session.query)question='select_product';
    else if(!signal?.aborted)results=await deterministic(session,call,true);
  }
  retrieval={...retrieval,mode:'skipped'};
  if(!direct&&process.env.AI_API_KEY){
    observe?.({type:'status',message:'در حال دریافت راهنمای مدل و انتخاب ابزارهای لازم…'});
    const turn:ProviderTurn=await runProvider(input,session,call,signal).catch(()=>({results:[],events:[],question:"none" as Followup,requests:0,failure:"provider_configuration"}));results=turn.results;extraEvents=turn.events;question=turn.question;failure=turn.failure;requests=turn.requests;guidance=turn.guidance;model=turn.model;provider=turn.provider;
    for(const event of extraEvents)observe?.({type:'tool',event});
    if(!failure&&(results.length||question!=='none'||guidance))mode='provider';
  }
  if(!direct&&mode!=='provider'&&session.intent==='stores'&&question==='none'&&!guidance&&!results.some(r=>r.blocks.some(b=>b.type==='offers'||b.type==='store_discovery'))&&!signal?.aborted){results=await deterministic(session,call);question='none';}
  if(!direct&&!results.length&&question==='none'&&!guidance){
    if(session.intent==='clarify')question='use_case';
    else if(session.intent==='compare'&&(session.selected_product_ids?.length??0)<2&&(session.selected_offer_ids?.length??0)<2)question='select_product';
    else if(!session.product_id&&!session.query)question='select_product';
    else if(!signal?.aborted)results=await deterministic(session,call);
  }
  phases.push('اجرای ابزارهای معتبر','ساخت رابط از شواهد');
  const rawBlocks=results.flatMap(r=>r.blocks);
  const blocks=visibleChatBlocks(rawBlocks),events=[...results.map(r=>r.event),...extraEvents];
  // Publish only the canonical response; intermediate candidates stay server-side.
  for(const block of blocks)if(!signal?.aborted)observe?.({type:'block',block});
  const empty=blocks.length>0&&blocks.every(b=>b.type==='products'?b.products.length===0:b.type==='offers'?b.offers.length===0:b.type==='store_discovery'?b.matches.length===0:b.type==='alternatives'?b.same_product.length===0&&b.similar_products.length===0:false);
  const kinds=new Set(blocks.map(b=>b.type));
  let reply='';
  if(empty)reply='با شرایط فعلی نتیجه‌ای پیدا نشد. بودجه، محدوده و شرط اقساط را تغییر نداده‌ام؛ می‌توانی خودت آن‌ها را ویرایش کنی.';
  else if(kinds.has('store_discovery'))reply='این فروشگاه‌ها برای کالاهای مطابق جست‌وجویت پیشنهاد ثبت‌شده دارند. روی نقشه یا فهرست، مدل و پیشنهاد مرتبط هر فروشگاه را ببین. این یک جست‌وجوی محدود است؛ موجودی و قیمت امروز تأیید نشده‌اند.';
  else if(kinds.has('inquiry'))reply='متن استعلام بر اساس پیشنهاد ثبت‌شده آماده شد. هیچ تماس یا پیامی ارسال نشده؛ برای ادامه از کانال عمومی معتبر و ثبت نتیجه با منبع استفاده کن.';
  else if(kinds.has('alternatives'))reply='اول فروشندگان دیگر همان کالا و بعد مدل‌های مشابه را با حفظ شرایط خریدت بررسی کردم. موجودی و قیمت امروز همه گزینه‌ها نیازمند استعلام است.';
  else if(kinds.has('visit_plan'))reply='برنامه مراجعه و چک‌لیست آماده است. ساعت‌ها گزارش‌شده و فاصله‌ها مستقیم‌اند؛ پیش از حرکت، زمان مراجعه و موجودی را استعلام کن.';
  else if(kinds.has('product_comparison')||kinds.has('offer_comparison'))reply='انتخاب‌ها را با مشخصات و قیمت‌های ثبت‌شده کنار هم گذاشتم. هرجا داده کافی نبود، مقدار نامشخص باقی مانده است.';
  else if(kinds.has('offers'))reply='این فروشگاه‌ها برای همین شناسه محصول پیشنهاد ثبت‌شده دارند. می‌توانی قیمت، شرایط پرداخت و موقعیتشان را مقایسه کنی و متن استعلام آماده کنی. قیمت امروز و موجودی تأیید نشده است.';
  else if(kinds.has('products'))reply='این گزینه‌ها از محصولات واقعی دیتاست پیدا شدند. روی هر کارت بزن تا مشخصات و فروشگاه‌هایش را با شرایط خریدت ببینی. قیمت‌ها ثبت‌شده‌اند و موجودی زنده نامشخص است.';
  else if(kinds.has('store_hours'))reply='برنامه گزارش‌شده فروشگاه بررسی شد؛ باز بودن زنده فروشگاه تأیید نشده است.';
  else if(kinds.has('payment_options'))reply='شرایط پرداخت ثبت‌شده آماده است. کانال نامشخص، اقساط حضوری محسوب نمی‌شود.';
  else if(kinds.has('shop'))reply='اطلاعات ثبت‌شده فروشگاه آماده است. برنامه کاری و هویت فروشنده، تأیید زنده محسوب نمی‌شوند.';
  if(retrieval.mode==='index_empty')reply+='\nایندکس امبدینگ هنوز ساخته نشده؛ این جست‌وجو متنی بود.';
  if(retrieval.mode==='lexical_fallback')reply+='\nبازیابی معنایی در دسترس نبود؛ از جست‌وجوی متنی استفاده شد.';
  if(question!=='none')reply+=(reply?'\n\n':'')+questions[question];
  if(mode==='provider'&&!failure){
    // Data claims remain in sourced cards. Do not append a canned narrative to
    // the model's own reply or present hidden retrieval candidates as advice.
    // If prose is rejected, retain the source-backed summary instead of a blank reply.
    reply=guidance??(question!=='none'?questions[question]:reply);
  }else if(guidance)reply=guidance+(reply?'\n\n'+reply:'');
  if(!reply&&mode!=='provider')reply='برای ادامه، یک کالا یا پیشنهاد فروشگاه انتخاب کن و بگو چه چیزی را بررسی کنم.';
  if(failure)reply+='\n'+(providerProblems[failure]??providerProblems.provider_unavailable)+(mode==='deterministic'?' راهنمای قطعی با همان داده‌ها ادامه داد.':' بخش آماده‌شده از داده‌ها نمایش داده شده است.');
  else if(mode==='deterministic')reply+='\nراهنمای قطعی فعال است؛ مدل زبانی در این پاسخ استفاده نشده است.';
  return {reply,mode,blocks,events,session,agent:{request_id:randomUUID(),phases,provider_requests:requests,tool_calls:events.length,retrieval,...(requests>0?{model,provider}:{}),...(failure?{fallback_reason:failure}:{})}};
}
