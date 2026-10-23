'use client';

import {Database,LoaderCircle} from 'lucide-react';
import type {ChatResponse,EnrichedOffer,Product,PurchaseSession,ToolEvent,UIBlock} from '@/lib/contracts';
import {BrandMark} from './brand-mark';
import {CopyReply} from './chat-panels';
import {ToolEventStep,UIBlockRenderer} from './workflows';

export type ChatMessage={id:string;role:'user'|'assistant';text:string;blocks?:UIBlock[];events?:ToolEvent[];mode?:ChatResponse['mode'];agent?:ChatResponse['agent'];state?:'streaming'|'complete'|'cancelled'|'error';statusText?:string;directAction?:boolean};
export function AssistantResponse({message,session,onSources,onInquiry,onPreview,onStop}:{message:ChatMessage;session:PurchaseSession;onSources:()=>void;onInquiry:(offer:EnrichedOffer)=>void;onPreview:(product:Product)=>void;onStop:()=>void}){
 const active=message.state==='streaming';
 const incomplete=message.state==='cancelled'||message.state==='error';
 return <article className="message assistant" data-response-state={message.state??'complete'} aria-label="پاسخ دستیار">
  <span className="assistant-avatar"><BrandMark busy={active}/></span>
  <div className="message-content">
   {message.text&&<p className="message-text">{message.text}</p>}
   {message.mode&&<span className="mode-label">{message.mode==='provider'?<>دستیار هوشمند · <bdi>{message.agent?.provider??'ارائه‌دهنده نامشخص'}</bdi>{message.agent?.model&&<> · <bdi>{message.agent.model}</bdi></>}</>:message.directAction?'اقدام مستقیم بر داده‌ها · بدون درخواست هوش مصنوعی':'راهنمای قطعی مبتنی بر داده'}</span>}
   {((message.blocks?.length??0)>0||(message.events?.length??0)>0)&&<button className="response-sources-button" aria-label="منابع این پاسخ" aria-haspopup="dialog" onClick={onSources}><Database size={15}/> دیدن منابع <span>{message.events?.length??0} مرحله بررسی</span></button>}
   {!!message.events?.length&&<details className="tool-events"><summary>مراحل بررسی اطلاعات</summary>{message.events.map((event,index)=><ToolEventStep key={index} event={event}/>)}</details>}
   {!!message.blocks?.length&&<UIBlockRenderer allowMapNavigation={!active} blocks={message.blocks} session={session} onInquiry={onInquiry} onProductPreview={onPreview}/>}
   {active&&<div className="response-progress" role="status" aria-live="polite"><LoaderCircle size={16} className="search-progress-spinner" aria-hidden="true"/><span>{message.statusText||'در حال دریافت پاسخ…'}</span><button className="text-button" onClick={onStop}>توقف</button></div>}
   {incomplete&&<p className="response-incomplete" role="status">{message.state==='cancelled'?'پاسخ متوقف شد؛ نتیجه کامل نیست.':'پاسخ کامل نشد؛ نتیجه‌های دریافت‌شده ممکن است ناقص باشند.'} این پاسخ ناقص در تاریخچه ذخیره نمی‌شود.</p>}
   {!active&&message.text&&<CopyReply text={message.text}/>}
  </div>
 </article>;
}
