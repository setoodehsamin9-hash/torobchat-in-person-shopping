'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {ArrowUp,MessageSquarePlus,MessageCircle,PanelRightClose,PanelRightOpen,Trash2,SlidersHorizontal,Footprints,PhoneCall,Route,Store} from 'lucide-react';
import type {EnrichedOffer,Product,PurchaseSession} from '@/lib/contracts';
import type {ChatStreamEvent} from '@/lib/chat-stream';
import {streamChat} from '@/lib/chat-stream-client';
import {conversationContext} from '@/lib/chat-context';
import {demoScenarios} from '@/lib/demo-scenarios';
import {visibleChatBlocks} from '@/lib/chat-presentation';
import {usePurchaseSession,useIds,safeSession} from '@/lib/session';
import {ArrowLeft,ShieldCheck,ErrorState} from './ui';
import {FilterBar} from './location';
import {InquiryDraft} from './workflows';
import {ProductPreview,ResponseSources} from './chat-panels';
const ContactTracker=dynamic(()=>import('./contact-tracker').then(module=>module.ContactTracker),{loading:()=> <p role="status">در حال آماده‌سازی استعلام‌ها…</p>});
import {BrandMark} from './brand-mark';
import {AssistantResponse,type ChatMessage as Message} from './assistant-response';
import '@/app/conversation.css';
const completedMessages=(messages:Message[])=>messages.filter(message=>!message.state||message.state==='complete');
type Conversation={id:string;title:string;messages:Message[];session?:PurchaseSession};
const examples=[{title:'فروشگاه کالای من کجاست؟',text:'هدفون انکر R50i'},{title:'لپ‌تاپ با خرید اعتباری',text:'توی تهران لپتاپ هارو کجا به صورت خرید اعتباری میدن'},{title:'کجا برای این کالا بروم؟',text:'شارژر اپل ۲۰ وات'}];
export default function ChatScreen(){
  const {session,update,replace}=usePurchaseSession();const comparison=useIds('torob-compare-products');
  const [text,setText]=useState(''),[messages,setMessages]=useState<Message[]>([]),[history,setHistory]=useState<Conversation[]>([]),[conversationId,setConversationId]=useState('');
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[sidebar,setSidebar]=useState(false),[collapsed,setCollapsed]=useState(false),[ready,setReady]=useState(false);
  const [inquiry,setInquiry]=useState<EnrichedOffer|null>(null),[preview,setPreview]=useState<Product|null>(null),[sourceMessage,setSourceMessage]=useState<Message|null>(null),[tab,setTab]=useState<'shopping'|'tracking'>('shopping');
  const bottom=useRef<HTMLDivElement>(null),abort=useRef<AbortController|null>(null);
  useEffect(()=>{
    try{const saved:Conversation[]=(JSON.parse(localStorage.getItem('torob-conversations')||'[]') as Conversation[]).map(conversation=>({...conversation,messages:conversation.messages.map(message=>({...message,blocks:visibleChatBlocks(message.blocks??[])}))}));setHistory(saved);const params=new URLSearchParams(window.location.search);const productId=params.get('product_id');
      if(params.get('tracking')==='1')setTab('tracking');
      const demo=demoScenarios.find(scenario=>scenario.id===params.get('demo'));
      if(demo){setConversationId(crypto.randomUUID());setMessages([]);replace({...demo.session,selected_product_ids:demo.session.product_id?[demo.session.product_id]:[],selected_offer_ids:[]});setText(demo.prompt);}
      else if(productId){setConversationId(crypto.randomUUID());update({product_id:productId,selected_product_ids:[productId],selected_offer_ids:[]});}
      else if(saved[0]){setConversationId(saved[0].id);setMessages(saved[0].messages);replace(saved[0].session??{});}
      if(!demo&&params.get('q'))setText(params.get('q')!);
    }catch{}setReady(true);return()=>abort.current?.abort();
  },[update,replace]);
  useEffect(()=>{if(!ready||messages.some(message=>message.state==='streaming'))return;const complete=completedMessages(messages);if(!complete.length)return;const id=conversationId||crypto.randomUUID();if(!conversationId)setConversationId(id);
    setHistory(previous=>{const next=[{id,title:complete.find(m=>m.role==='user')?.text.slice(0,45)||'خرید جدید',messages:complete,session:safeSession(session)},...previous.filter(c=>c.id!==id)].slice(0,12);localStorage.setItem('torob-conversations',JSON.stringify(next));return next;});
  },[messages,conversationId,ready,session]);
  useEffect(()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;bottom.current?.scrollIntoView({behavior:reduced?'instant':'smooth'});},[messages,pending]);
  async function send(value=text,interaction?:'show_stores'|'nearby_stores'|'credit_stores',sessionOverride?:PurchaseSession){
    if(!ready||!value.trim()||(pending&&!sessionOverride))return;
    if(pending&&sessionOverride)abort.current?.abort();
    const userId=crypto.randomUUID(),assistantId=crypto.randomUUID();
    const controller=new AbortController();abort.current=controller;
    setError('');setText('');setPending(true);
    setMessages(old=>[...old,{id:userId,role:'user',text:value,state:'streaming'},{id:assistantId,role:'assistant',text:'',blocks:[],events:[],state:'streaming',directAction:!!interaction}]);
    const receive=(event:ChatStreamEvent)=>{
      if(controller.signal.aborted)return;
      setMessages(old=>old.map(message=>{
        if(message.id!==assistantId)return message;
        switch(event.type){
          case 'status':return {...message,statusText:event.message};
          case 'tool':return {...message,events:[...(message.events??[]),event.event]};
          case 'block':return message; // Cards are committed together with the canonical response.
          case 'text':return {...message,text:message.text+event.delta};
          default:return message;
        }
      }));
    };
    try{
      const response=await streamChat({message:value,session:sessionOverride??session,...(interaction?{interaction}:{}),...conversationContext(completedMessages(messages))},receive,controller.signal);
      if(controller.signal.aborted)return;
      update(response.session);
      setMessages(old=>old.map(message=>message.id===assistantId?{id:assistantId,role:'assistant',text:response.reply,blocks:response.blocks,events:response.events,mode:response.mode,agent:response.agent,state:'complete',directAction:!!interaction}:message.id===userId?{...message,state:'complete'}:message));
    }catch(e){
      const cancelled=controller.signal.aborted||(e as Error).name==='AbortError';
      setMessages(old=>old.map(message=>message.id===assistantId||message.id===userId?{...message,state:cancelled?'cancelled':'error'}:message));
      if(!cancelled)setError((e as Error).message);
    }finally{if(abort.current===controller){abort.current=null;setPending(false);}}
  }
  function newChat(){abort.current?.abort();setPending(false);setMessages([]);setConversationId(crypto.randomUUID());setSidebar(false);setText('');setPreview(null);setSourceMessage(null);setError('');setTab('shopping');replace({});window.history.replaceState({},'','/chat');}
  function focusShopping(value?:string){setTab('shopping');if(value)setText(value);requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.chat-composer textarea')?.focus());}
  function startRoute(){setTab('shopping');requestAnimationFrame(()=>{const route=document.querySelector('.journey-panel');if(route)route.scrollIntoView({behavior:'smooth',block:'center'});else if(session.product_id)send('فروشگاه‌های همین کالا را نشان بده','show_stores');else focusShopping();});}
  return <div className={`chat-app reference-chat in-person-app ${collapsed?'sidebar-collapsed':''}`}>
    <aside className={`chat-sidebar ${sidebar?'open':''}`}>
      <div className="chat-sidebar-head"><Link href="/chat" className="reference-brand"><BrandMark/><strong>ترب‌چت</strong></Link><button className="icon-button desktop-sidebar-toggle" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'باز کردن تاریخچه':'جمع کردن تاریخچه'}><PanelRightClose size={21}/></button><button className="icon-button mobile-only" onClick={()=>setSidebar(false)} aria-label="بستن منو"><PanelRightClose size={20}/></button></div>
      <p className="sidebar-purpose">دستیار خرید حضوری</p><button className="btn new-chat" onClick={newChat}><MessageSquarePlus size={19}/> گفت‌وگوی جدید</button><div className="sidebar-label">مسیرهای خرید شما</div>
      <div className="chat-history">{history.length?history.map(c=><button key={c.id} className={conversationId===c.id?'active':''} onClick={()=>{if(pending)return;setConversationId(c.id);setMessages(c.messages);replace(c.session??{});setSidebar(false);setTab('shopping');}}><MessageCircle size={16}/><span>{c.title}</span></button>):<p>برای خرید بعدی، از همین‌جا شروع کن.</p>}</div>
      <div className="sidebar-bottom"><Link href="/demo">راهنمای سناریوهای دمو <ArrowLeft size={15}/></Link><Link href="/bazaar"><Store size={18}/> بورس‌یاب: راسته‌های هر کالا <ArrowLeft size={15}/></Link><Link href="/visit-plan"><Route size={18}/> برنامه مراجعه من <ArrowLeft size={15}/></Link><button className="text-button" onClick={()=>{setTab('tracking');setSidebar(false);}}><PhoneCall size={18}/> پیگیری استعلام‌ها</button><Link href="/settings"><ShieldCheck size={18}/> داده‌ها و تنظیم اتصال‌ها</Link><button className="text-button" onClick={()=>{localStorage.removeItem('torob-conversations');setHistory([]);newChat();}}><Trash2 size={15}/> پاک کردن تاریخچه محلی</button><span className="prototype-badge">نمونه مستقل · داده‌های چالش</span></div>
    </aside>
    {sidebar&&<div className="sidebar-shade" onClick={()=>setSidebar(false)}/>}
    <div className={`chat-main ${messages.length===0&&tab==='shopping'?'is-empty':''}`}>
      <header className="chat-header"><div><button className="icon-button mobile-only" onClick={()=>setSidebar(true)} aria-label="نمایش تاریخچه"><PanelRightOpen size={21}/></button><span className="chat-brand"><BrandMark/> ترب‌چت</span><span className="muted-text tiny">دستیار خرید حضوری</span></div><span className="chat-header-links"><Link className="text-button" href="/bazaar"><Store size={16}/> بورس‌یاب</Link><Link className="text-button" href="/settings"><span className="status-dot"/> داده‌های قابل پیگیری</Link></span></header>
      <nav className="shopping-switch" role="tablist" aria-label="نمای خرید و استعلام"><button role="tab" id="shopping-tab" aria-controls="shopping-panel" aria-selected={tab==='shopping'} onClick={()=>setTab('shopping')}><Footprints size={17}/> مسیر خرید</button><button role="tab" id="tracking-tab" aria-controls="tracking-panel" aria-selected={tab==='tracking'} onClick={()=>setTab('tracking')}><PhoneCall size={17}/> پیگیری استعلام</button></nav>
      <main id="main" className="chat-scroll"><div className="chat-thread">
        {tab==='tracking'?<div role="tabpanel" id="tracking-panel" aria-labelledby="tracking-tab"><ContactTracker/></div>:<div role="tabpanel" id="shopping-panel" aria-labelledby="shopping-tab">
          <nav className="journey-steps" aria-label="قدم‌های خرید حضوری"><button onClick={()=>focusShopping()}><span>۱</span><strong>کالا و فروشگاه</strong><small>کجا پیدایش کنم؟</small></button><button onClick={()=>setTab('tracking')}><span>۲</span><strong>پیش از حرکت</strong><small>قیمت و موجودی را بپرس</small></button><button onClick={startRoute}><span>۳</span><strong>مسیر مراجعه</strong><small>پیاده یا با خودرو</small></button></nav>
          {messages.length===0?<section className="chat-welcome"><span className="welcome-icon"><BrandMark/></span><span className="welcome-kicker">برای خریدی که باید از نزدیک ببینی</span><h1>اول مطمئن شو، بعد راه بیفت.</h1><p>کالایت را پیدا کن، پیشنهاد فروشگاه‌ها را بسنج،<br/>پیش از رفتن استعلام بگیر و مسیرت را بچین.</p><div className="in-person-promises"><span><ShieldCheck size={16}/> پیشنهاد واقعی، موجودی نامشخص</span><span><Route size={16}/> مراجعه با نقشه و برنامه</span></div></section>:<div className="message-list">{messages.map(m=>m.role==='assistant'?<AssistantResponse key={m.id} message={m} session={session} onSources={()=>setSourceMessage(m)} onInquiry={setInquiry} onPreview={setPreview} onStop={()=>abort.current?.abort()}/>:<article className="message user" key={m.id}><div className="message-content"><p className="message-text">{m.text}</p></div></article>)}</div>}
          {error&&<ErrorState message={error}/>}<div ref={bottom}/>
        </div>}
      </div></main>
      {tab==='shopping'&&<div className="composer-area">{comparison.ids.length>0&&<div className="chat-selection-tray"><span>{comparison.ids.length.toLocaleString('fa-IR')} کالا برای مقایسه</span><button className="text-button" onClick={comparison.clear}>پاک کردن انتخاب</button>{comparison.ids.length>=2?<Link className="btn outline" href={`/compare?products=${comparison.ids.map(encodeURIComponent).join(',')}`}>مقایسه کالاها</Link>:<small>یک کالای دیگر انتخاب کنید</small>}</div>}
        <details className="chat-filters"><summary><SlidersHorizontal size={16}/> شرایط خرید شما <span>{session.maxPrice?'بودجه مشخص شده':'بودجه'} · {session.lat!==undefined?'موقعیت انتخاب شده':'نقطه شروع'} · {session.installmentOnly?'اقساط حضوری':'نحوه پرداخت'}</span></summary><FilterBar value={session} onChange={update}/></details>
        {session.product_id&&<div className="selected-product-chip"><Link href={`/products/${encodeURIComponent(session.product_id)}`}>کالای انتخاب‌شده <code dir="ltr">{session.product_id}</code></Link><button className="text-button" onClick={()=>{update({product_id:undefined,selected_product_ids:[],selected_offer_ids:[]});window.history.replaceState({},'','/chat');}}>حذف انتخاب</button></div>}
        {session.product_id&&<div className="store-shortcuts" aria-label="اقدام‌های سریع برای همین کالا"><button disabled={pending} onClick={()=>send('فروشگاه‌های همین کالا را نشان بده','show_stores')}>فروشگاه‌های همین کالا</button><button disabled={pending} onClick={()=>send('نزدیک‌ترین فروشگاه‌های همین کالا را نشان بده','nearby_stores')}>نزدیک من</button><button disabled={pending} onClick={()=>send('فروشگاه‌های همین کالا با خرید اعتباری','credit_stores')}>خرید اعتباری حضوری</button></div>}
        <form className="chat-composer" onSubmit={e=>{e.preventDefault();send();}}><textarea aria-label="پیام شما به دستیار خرید" rows={1} maxLength={2000} placeholder="چی می‌خواهی از نزدیک ببینی و بخری؟" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/><button type="submit" className="send-button" disabled={!ready||pending||!text.trim()} aria-label="ارسال پیام"><ArrowUp size={22}/></button></form>
        {messages.length===0&&<div className="reference-starters" aria-label="پیشنهادهای شروع گفت‌وگو">{examples.map(({title,text})=><button key={title} onClick={()=>send(text)} disabled={pending}>{title}</button>)}</div>}
        <p className="composer-disclaimer">پیشنهاد ثبت‌شده، تأیید موجودی نیست؛ پیش از مراجعه استعلام کن. <Link href="/settings">درباره داده‌ها</Link></p>
      </div>}
    </div>
    {preview&&<ProductPreview key={preview.product_id} product={preview} session={session} onClose={()=>setPreview(null)} onInquiry={offer=>{setPreview(null);setInquiry(offer);}} onAsk={product=>{update({product_id:product.product_id,selected_product_ids:[product.product_id],selected_offer_ids:[]});setPreview(null);setTab('shopping');send('فروشگاه‌های همین کالا را نشان بده','show_stores',{...session,product_id:product.product_id,selected_product_ids:[product.product_id],selected_offer_ids:[]});}}/>}
    {sourceMessage&&<ResponseSources blocks={sourceMessage.blocks??[]} events={sourceMessage.events??[]} onClose={()=>setSourceMessage(null)}/>}
    {inquiry&&<InquiryDraft offer={inquiry} constraints={session} onClose={()=>setInquiry(null)} onJobStarted={()=>{setInquiry(null);setTab('tracking');}} onAlternative={blocks=>setMessages(old=>[...old,{id:crypto.randomUUID(),role:'assistant',text:'فروشگاه‌ها یا کالاهای جایگزین برای ادامه خرید حضوری:',blocks}])}/>}
  </div>;
}
