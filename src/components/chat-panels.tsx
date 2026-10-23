'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Database, ExternalLink, LoaderCircle, X } from 'lucide-react';
import type { EnrichedOffer, OffersResult, Product, PurchaseSession, ToolEvent, UIBlock } from '@/lib/contracts';
import { dateLabel, fa, money, offerFilters, queryString, useData } from '@/lib/client';
import { EmptyState, ErrorState, OfferCard, ProductImage } from './ui';

/** Shared keyboard and focus behavior for chat's source drawer and product sheet. */
function ChatDialog({ title, children, onClose, className = '' }: {
  title: string; children: React.ReactNode; onClose: () => void; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="chat-dialog-backdrop" onClick={onClose}>
    <section ref={ref} className={`chat-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,summary,[tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="chat-dialog-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="بستن" onClick={onClose}><X size={21}/></button></header>
      {children}
    </section>
  </div>;
}

export function ProductPreview({ product, session, onClose, onAsk, onInquiry }: {
  product: Product; session: PurchaseSession; onClose: () => void;
  onAsk: (product: Product) => void; onInquiry: (offer: EnrichedOffer) => void;
}) {
  const result = useData<OffersResult>(`/api/products/${encodeURIComponent(product.product_id)}/offers?${queryString({ ...offerFilters(session), limit: 3 })}`);
  const current = result.data?.product ?? product;
  return <ChatDialog title="پیش‌نمایش محصول" onClose={onClose} className="product-preview">
    <div className="chat-dialog-scroll">
      <div className="preview-product"><ProductImage key={current.product_id} product={current}/><div>
        <h3>{current.persian_title || current.model || 'عنوان نامشخص'}</h3>
        <span className="preview-price">{money(current.min_price_toman)} <small>کمترین قیمت ثبت‌شده کل محصول</small></span>
        <code className="full-source-id" dir="ltr">{current.product_id}</code>
      </div></div>
      <p className="preview-trust">منبع: دیتاست چالش · قیمت امروز و موجودی تأیید نشده است.</p>
      <details className="preview-specs-disclosure"><summary>مشخصات ثبت‌شده</summary>
      {current.specs.length ? <dl className="preview-specs">{current.specs.slice(0,12).map((spec,i)=><div key={i}><dt>{spec.key}</dt><dd>{spec.value || 'نامشخص'}</dd></div>)}</dl> : <p className="muted-text">مشخصات: نامشخص</p>}</details>
      <div className="preview-offers-heading"><h4>پیشنهادهای فروشگاه‌ها {result.data && `(${fa(result.data.total)})`}</h4><span>با شرایط خرید فعلی شما</span></div>
      {result.error ? <ErrorState message={result.error} retry={result.retry}/> : !result.data ? <p className="preview-loading" role="status"><LoaderCircle size={18} className="spin"/> دریافت پیشنهادهای واقعی…</p> : result.data.data.length ? <>
        {result.data.data.map(offer=><OfferCard key={offer.offer_id} offer={offer} onInquiry={onInquiry}/>)}
        {result.data.total > result.data.data.length && <p className="preview-trust">{fa(result.data.data.length)} پیشنهاد از {fa(result.data.total)} نتیجه مطابق شرایط؛ همه را در صفحه کالا ببینید.</p>}
      </> : <EmptyState title="پیشنهادی با این شرایط پیدا نشد" description="بودجه، محدوده یا شرط اقساط را در شرایط خرید ویرایش کنید؛ محدودیت‌ها خودکار تغییر نمی‌کنند."/>}
    </div>
    <footer className="chat-dialog-footer"><button className="btn primary" onClick={()=>onAsk(current)}>درباره این محصول بپرس</button><Link className="btn outline" href={`/products/${encodeURIComponent(current.product_id)}?${queryString(offerFilters(session))}`}>صفحه کامل کالا <ExternalLink size={15}/></Link></footer>
  </ChatDialog>;
}

type Source = { id: string; kind: 'product' | 'shop' | 'offer'; title: string; href: string; date?: string | null };
function collectSources(blocks: UIBlock[]) {
  const records = new Map<string,Source>();
  const product = (p: Product) => records.set(`product:${p.product_id}`,{id:p.product_id,kind:'product',title:p.persian_title || p.model || 'کالای ثبت‌شده',href:`/products/${encodeURIComponent(p.product_id)}`});
  const shop = (id: string, title: string | null) => records.set(`shop:${id}`,{id,kind:'shop',title:title || 'نام فروشگاه نامشخص',href:`/shops/${encodeURIComponent(id)}`});
  const offers = (items: EnrichedOffer[]) => items.forEach(o=>{
    shop(o.shop_id,o.shop.name);
    records.set(`offer:${o.offer_id}`,{id:o.offer_id,kind:'offer',title:`پیشنهاد ثبت‌شده ${o.shop.name || 'فروشگاه'}`,href:`/products/${encodeURIComponent(o.product_id)}`,date:o.last_price_changed_at});
  });
  blocks.forEach(block=>{
    switch(block.type) {
      case 'store_discovery': block.matches.forEach(match=>{product(match.product);offers([match.offer]);}); break;
      case 'products': case 'product_comparison': block.products.forEach(product); break;
      case 'offers': case 'offer_comparison': product(block.product); offers(block.offers); break;
      case 'alternatives': product(block.product); block.similar_products.forEach(product); offers(block.same_product); break;
      case 'visit_plan': offers(block.offers); break;
      case 'shop': shop(block.shop.shop_id,block.shop.name); break;
      case 'store_hours':case 'payment_options':shop(block.shop_id,null);break;
      case 'inquiry': shop(block.shop.shop_id,block.shop.name); records.set(`offer:${block.offer_id}`,{id:block.offer_id,kind:'offer',title:'منبع متن استعلام',href:`/shops/${encodeURIComponent(block.shop.shop_id)}`}); break;
    }
  });
  return [...records.values()];
}
export function ResponseSources({ blocks, events, onClose }: { blocks: UIBlock[]; events: ToolEvent[]; onClose: () => void }) {
  const records = collectSources(blocks);
  const labels = { product:'کالا',shop:'فروشگاه',offer:'پیشنهاد' };
  return <ChatDialog title="منابع و مراحل بررسی" onClose={onClose} className="sources-drawer">
    <div className="chat-dialog-scroll"><p className="preview-trust"><Database size={16}/> {fa(records.length)} رکورد · {fa(events.length)} مرحله بررسی · دیتاست رسمی چالش</p>
      <p className="preview-trust">این منابع رکوردهای واردشده‌اند؛ تأیید زنده قیمت، موجودی یا هویت فروشنده نیستند.</p>
      <ol className="source-tool-list">{events.map((event,i)=><li key={i}><Check size={15}/><span>{event.label}</span><small>{event.status==='error'?'بررسی ناموفق':'بررسی انجام شد'}</small></li>)}</ol>
      <div className="source-record-list">{records.map(source=><Link href={source.href} key={`${source.kind}:${source.id}`}><span className="source-kind">{labels[source.kind]}</span><strong>{source.title}</strong><code dir="ltr">{source.id}</code>{source.kind==='offer'&&<small>آخرین تغییر قیمت: {dateLabel(source.date??null)}</small>}</Link>)}</div>
      {!records.length && <p className="preview-trust">در این پاسخ، رکورد قابل ارجاعی نمایش داده نشده است.</p>}
    </div>
  </ChatDialog>;
}
export function CopyReply({text}:{text:string}) {
  const [status,setStatus] = useState('');
  return <div className="reply-actions"><button className="icon-button" aria-label="کپی متن پاسخ" title="کپی متن پاسخ" onClick={async()=>{
    try { await navigator.clipboard.writeText(text); setStatus('متن پاسخ کپی شد'); }
    catch { setStatus('کپی خودکار در دسترس نیست؛ متن پاسخ را انتخاب و کپی کنید.'); }
  }}><Copy size={16}/></button><span role="status">{status}</span></div>;
}
