import { z } from 'zod';
import { haversineKm,normalizeText } from './domain';
import { agentConfig,recordModelUsage,reserveModelRequest } from './agent/runtime';
import type { BazaarHub,BazaarResult,BazaarShop } from './bazaar';

/** Map questions are routed to one of a few deterministic answers. The model,
 * when configured, only picks the intent and district; it never writes facts.
 * Every sentence below is composed from validated dataset fields.
 */
export const bazaarIntents=['cheapest','most_sellers','open_now','installment','malls','plan','compare','nearest','unsupported'] as const;
export type BazaarIntent=typeof bazaarIntents[number];
export type BazaarAnswer={intent:BazaarIntent;router:'model'|'rules';text:string;lines:string[];hub_id?:string;shop_ids:string[];needs_location?:boolean};
export const bazaarAskSchema=z.object({query:z.string().trim().min(2).max(120),question:z.string().trim().min(2).max(300),hub_id:z.string().regex(/^hub_[0-9a-f]{8}$/).optional(),lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional()}).strict().refine(v=>(v.lat===undefined)===(v.lng===undefined),{message:'عرض و طول جغرافیایی باید با هم ارسال شوند.'});

const fa=(n:number)=>new Intl.NumberFormat('fa-IR').format(n);
const money=(n:number|null)=>n===null?'قیمت نامشخص':`${fa(n)} تومان`;
const shopName=(shop:BazaarShop)=>shop.name?.trim()||'فروشگاهی با نام نامشخص';
const hubName=(hub:BazaarHub)=>`راستهٔ ${hub.name}`;
const caution='قیمت و ساعت از دیتاست ثبت شده‌اند؛ موجودی و قیمت امروز را پیش از رفتن استعلام کنید.';

export function routeByRules(question:string):BazaarIntent{
  const text=normalizeText(question);
  if(/نزدیک|نزدیکترین|نزدیک ترین|اطراف|دور و بر|به من/.test(text))return 'nearest';
  if(/ارزان|ارزون|کمترین قیمت|کم ترین قیمت|قیمت پایین|ارزانترین/.test(text))return 'cheapest';
  if(/باز|تعطیل|ساعت کار|الان/.test(text))return 'open_now';
  if(/قسط|اقساط|اعتباری|چک|پرداخت/.test(text))return 'installment';
  if(/شروع|ترتیب|برنامه|مسیر|اول کجا|کجا برم|کجا بروم/.test(text))return 'plan';
  if(/پاساژ|مجتمع|سرای|مرکز خرید/.test(text))return 'malls';
  if(/مقایسه|فرق|تفاوت|کدام بهتر|کدوم بهتر/.test(text))return 'compare';
  if(/بورس|کجا|بیشترین|تمرکز|راسته|بیشتر/.test(text))return 'most_sellers';
  return 'unsupported';
}

const routeSchema=z.object({intent:z.enum(bazaarIntents),hub_id:z.string().nullable().optional()});
const completionSchema=z.object({choices:z.array(z.object({message:z.object({tool_calls:z.array(z.object({function:z.object({name:z.string(),arguments:z.string().max(2000)})})).max(2).optional()})})).min(1),usage:z.object({prompt_tokens:z.number().optional(),completion_tokens:z.number().optional()}).optional()});
async function routeByModel(question:string,result:BazaarResult,selected?:string):Promise<{intent:BazaarIntent;hub_id?:string}|null>{
  let config;try{config=agentConfig();}catch{return null;}
  if(!config.configured)return null;
  try{
    await reserveModelRequest(config.dailyLimit);
    const endpoint=new URL(config.base);endpoint.pathname=endpoint.pathname.replace(/\/$/,'')+'/chat/completions';
    const reasoning=/^(?:[^/]+\/)?(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(config.model);
    const generation=reasoning?{max_completion_tokens:200,reasoning_effort:/(?:^|\/)gpt-6-luna$/.test(config.model)?'none':'low'}:{max_tokens:200,temperature:0};
    const hubs=result.hubs.map(hub=>({hub_id:hub.hub_id,street:hub.name}));
    const tool={type:'function',function:{name:'route_map_question',description:'Choose which dataset-backed map answer fits a Persian shopper question about market districts for a product.',parameters:{type:'object',additionalProperties:false,properties:{intent:{type:'string',enum:bazaarIntents,description:'cheapest=lowest recorded price; most_sellers=where sellers concentrate; open_now=open by reported hours; installment=in-person installment; malls=passages in a district; plan=which passage to visit first; compare=compare districts; nearest=district closest to the shopper; unsupported=anything else'},hub_id:{type:['string','null'],enum:[...hubs.map(hub=>hub.hub_id),null],description:'District the question names, else null'}},required:['intent','hub_id']}}};
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.AI_API_KEY}`},body:JSON.stringify({model:config.model,messages:[{role:'system',content:'Classify the question by calling route_map_question once. Never answer in prose.'},{role:'user',content:JSON.stringify({question:question.slice(0,300),districts:hubs,selected_district:selected??null})}],tools:[tool],tool_choice:{type:'function',function:{name:'route_map_question'}},...generation,stream:false}),signal:AbortSignal.timeout(Math.min(config.timeoutMs,15000)),redirect:'error'});
    if(!response.ok)return null;
    const data=completionSchema.parse(await response.json());
    if(data.usage)await recordModelUsage(data.usage.prompt_tokens??0,data.usage.completion_tokens??0);
    const call=data.choices[0].message.tool_calls?.find(item=>item.function.name==='route_map_question');if(!call)return null;
    const parsed=routeSchema.parse(JSON.parse(call.function.arguments));
    return {intent:parsed.intent,hub_id:result.hubs.some(hub=>hub.hub_id===parsed.hub_id)?parsed.hub_id!:undefined};
  }catch{return null;}
}

export function composeAnswer(intent:BazaarIntent,result:BazaarResult,hubId?:string,location?:{lat:number;lng:number}):Omit<BazaarAnswer,'router'>{
  const hubs=result.hubs,hub=hubs.find(item=>item.hub_id===hubId);
  if(!hubs.length)return {intent,text:`برای «${result.query}» هنوز راسته‌ای با دست‌کم دو فروشگاه دارای پیشنهاد ثبت‌شده پیدا نشد. نام کالا را کلی‌تر بنویسید.`,lines:[],shop_ids:[]};
  const scope=hub?[hub]:hubs,all=scope.flatMap(item=>item.shops.map(shop=>({hub:item,shop})));
  switch(intent){
    case 'cheapest':{
      const priced=all.filter(item=>item.shop.min_price_toman!==null).sort((a,b)=>a.shop.min_price_toman!-b.shop.min_price_toman!).slice(0,3);
      if(!priced.length)return {intent,text:'قیمت ثبت‌شده‌ای در این محدوده نیست.',lines:[],hub_id:hub?.hub_id,shop_ids:[]};
      const best=priced[0];
      return {intent,text:`کمترین قیمت ثبت‌شده ${hub?`در ${hubName(hub)}`:'روی نقشه'}: ${money(best.shop.min_price_toman)} برای «${best.shop.cheapest_product_title??'کالای نامشخص'}» در ${shopName(best.shop)}${best.shop.mall?`، ${best.shop.mall}`:''}. ${caution}`,lines:priced.map(item=>`${money(item.shop.min_price_toman)} · ${shopName(item.shop)} · ${hubName(item.hub)}`),hub_id:best.hub.hub_id,shop_ids:priced.map(item=>item.shop.shop_id)};
    }
    case 'most_sellers':{
      const top=hub??hubs[0];
      return {intent,text:`${hubName(top)} با ${fa(top.shop_count)} فروشگاه دارای پیشنهاد ثبت‌شده، ${fa(Math.round(top.share*100))}٪ فروشگاه‌های منطبق با «${result.query}» را در خود دارد${top.primary&&!hub?' و بورس اصلی این کالا در دیتاست است':''}.`,lines:top.malls.slice(0,3).map(mall=>`${mall.name}: ${fa(mall.shop_count)} فروشگاه`),hub_id:top.hub_id,shop_ids:[]};
    }
    case 'open_now':{
      const open=all.filter(item=>item.shop.hours==='fits_reported'),known=all.filter(item=>item.shop.hours!=='unknown').length;
      return {intent,text:`طبق ساعات ثبت‌شده، ${fa(open.length)} فروشگاه از ${fa(all.length)} فروشگاه ${hub?hubName(hub):'روی نقشه'} الان باید باز باشد؛ ساعات ${fa(all.length-known)} فروشگاه نامشخص است. باز بودن واقعی تأیید نشده است.`,lines:open.slice(0,4).map(item=>`${shopName(item.shop)} · ${item.shop.mall??hubName(item.hub)}`),hub_id:hub?.hub_id,shop_ids:open.slice(0,40).map(item=>item.shop.shop_id)};
    }
    case 'installment':{
      const eligible=all.filter(item=>item.shop.installment);
      return {intent,text:eligible.length?`${fa(eligible.length)} فروشگاه ${hub?`در ${hubName(hub)}`:'روی نقشه'} برای دست‌کم یکی از کالاهای منطبق، شرایط پرداخت اقساطی حضوری مستند دارد. شرایط را پیش از خرید از فروشنده بپرسید.`:`در ${hub?hubName(hub):'این نتیجه'} شرایط اقساط حضوری مستندی برای این کالا ثبت نشده است؛ نبودِ ثبت به معنای نبودِ امکان نیست.`,lines:eligible.slice(0,4).map(item=>`${shopName(item.shop)} · ${item.shop.mall??hubName(item.hub)}`),hub_id:hub?.hub_id,shop_ids:eligible.slice(0,40).map(item=>item.shop.shop_id)};
    }
    case 'malls':case 'plan':{
      const target=hub??hubs[0];
      if(!target.malls.length)return {intent,text:`در نشانی فروشگاه‌های ${hubName(target)} نام پاساژ ثبت نشده است؛ فهرست فروشگاه‌ها را ببینید.`,lines:[],hub_id:target.hub_id,shop_ids:[]};
      const order=target.malls.slice(0,3);
      const ids=target.shops.filter(shop=>shop.mall===order[0].name).map(shop=>shop.shop_id);
      return intent==='plan'
        ?{intent,text:`برای مراجعهٔ حضوری در ${hubName(target)}، از ${order[0].name} با ${fa(order[0].shop_count)} فروشندهٔ این کالا شروع کنید${order[1]?`، بعد ${order[1].name}`:''}${order[2]?` و ${order[2].name}`:''}. این ترتیب فقط بر اساس تعداد فروشنده است؛ ${caution}`,lines:order.map(mall=>`${mall.name}: ${fa(mall.shop_count)} فروشگاه`),hub_id:target.hub_id,shop_ids:ids}
        :{intent,text:`پرفروشنده‌ترین پاساژهای ${hubName(target)} برای این کالا:`,lines:target.malls.slice(0,5).map(mall=>`${mall.name}: ${fa(mall.shop_count)} فروشگاه`),hub_id:target.hub_id,shop_ids:ids};
    }
    case 'compare':{
      const top=hubs.slice(0,3);
      return {intent,text:`مقایسهٔ ${fa(top.length)} راستهٔ اصلی بر اساس پیشنهادهای ثبت‌شده:`,lines:top.map(item=>`${hubName(item)}: ${fa(item.shop_count)} فروشگاه · از ${money(item.min_price_toman)} · ${fa(item.malls.length)} پاساژ`),shop_ids:[]};
    }
    case 'nearest':{
      if(!location)return {intent,text:'برای پیدا کردن نزدیک‌ترین راسته، دکمهٔ «موقعیت من» را بزنید؛ موقعیت فقط برای همین پرسش استفاده می‌شود.',lines:[],shop_ids:[],needs_location:true};
      const ranked=hubs.map(item=>({hub:item,km:haversineKm(location.lat,location.lng,item.center[0],item.center[1])})).sort((a,b)=>a.km-b.km);
      return {intent,text:`نزدیک‌ترین راسته به موقعیت شما ${hubName(ranked[0].hub)} است؛ حدود ${fa(Math.round(ranked[0].km*10)/10)} کیلومتر فاصلهٔ مستقیم با ${fa(ranked[0].hub.shop_count)} فروشگاه. زمان سفر نامشخص است.`,lines:ranked.slice(1,3).map(item=>`${hubName(item.hub)}: حدود ${fa(Math.round(item.km*10)/10)} کیلومتر`),hub_id:ranked[0].hub.hub_id,shop_ids:[]};
    }
    default:return {intent:'unsupported',text:'این پرسش با داده‌های نقشه پاسخ‌پذیر نیست. می‌توانید دربارهٔ ارزان‌ترین قیمت ثبت‌شده، بیشترین تمرکز فروشنده، پاساژها، ساعات ثبت‌شده، اقساط حضوری یا نزدیک‌ترین راسته بپرسید.',lines:[],shop_ids:[]};
  }
}

export async function askBazaar(input:z.infer<typeof bazaarAskSchema>,result:BazaarResult):Promise<BazaarAnswer>{
  const routed=await routeByModel(input.question,result,input.hub_id);
  const intent=routed?.intent??routeByRules(input.question);
  const location=input.lat!==undefined&&input.lng!==undefined?{lat:input.lat,lng:input.lng}:undefined;
  return {...composeAnswer(intent,result,routed?.hub_id??input.hub_id,location),router:routed?'model':'rules'};
}
