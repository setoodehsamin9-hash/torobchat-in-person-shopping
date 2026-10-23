import Link from 'next/link';
import {ArrowRight,MapPinned,MessageCircle,Package,ShieldCheck} from 'lucide-react';
import {BrandMark} from '@/components/brand-mark';
import {demoScenarios} from '@/lib/demo-scenarios';
import './demo.css';

const fa=(n:number)=>n.toLocaleString('fa-IR');
export default function DemoPage(){
 return <main id="main" className="demo-guide" dir="rtl">
  <header className="demo-head">
   <Link href="/chat" className="demo-back" aria-label="بازگشت به گفت‌وگو"><ArrowRight size={20}/></Link>
   <span className="demo-brand"><BrandMark/>ترب‌چت</span>
   <span className="demo-tag">راهنمای ارائه</span>
  </header>
  <div className="demo-body">
   <section className="demo-intro">
    <p className="demo-kicker">راهنمای ارائهٔ پنج‌دقیقه‌ای</p>
    <h1>سه مسیر برای نمایش خرید حضوری</h1>
    <p>هر سناریو را با پیام آماده شروع کن؛ بعد انتخاب کالا، فروشنده و آماده‌سازی مراجعه را روی داده‌های واقعی نشان بده.</p>
    <p className="demo-trust"><ShieldCheck size={17} aria-hidden/>قیمت‌ها ثبت‌شده‌اند و موجودی نامشخص است. استعلام فقط با برچسب «شبیه‌سازی» نمایش داده می‌شود. شروع سناریو یک گفت‌وگوی تازه با شرایط خودش باز می‌کند و پیام فقط با زدن ارسال فرستاده می‌شود.</p>
   </section>
   <ol className="demo-scenarios">
    {demoScenarios.map((scenario,index)=><li className="demo-scenario" key={scenario.id}>
     <header>
      <span className="demo-number">{fa(index+1)}</span>
      <div><h2>{scenario.title}</h2><p>{scenario.purpose}</p></div>
      <span className="demo-time">{scenario.duration}</span>
     </header>
     <div className="demo-actions">
      {scenario.mapQuery&&<Link className="demo-btn is-primary" href={`/bazaar?q=${encodeURIComponent(scenario.mapQuery)}`}><MapPinned size={17}/>شروع از بورس‌یاب لوستر</Link>}
      <Link className={`demo-btn ${scenario.mapQuery?'':'is-primary'}`} prefetch={false} href={`/chat?demo=${scenario.id}`}><MessageCircle size={17}/>شروع گفت‌وگوی این سناریو</Link>
      <Link className="demo-link" href={`/products/${scenario.session.product_id}`}><Package size={15}/>جزئیات کالای مرجع</Link>
     </div>
     <label className="demo-prompt">پیام آمادهٔ {scenario.title}<textarea readOnly rows={3} value={scenario.prompt}/></label>
     <ol className="demo-steps">{scenario.steps.map(step=><li key={step}>{step}</li>)}</ol>
     <blockquote>«{scenario.presenter}»</blockquote>
    </li>)}
   </ol>
   <section className="demo-checklist">
    <h2>پیش از ارائه</h2>
    <ul><li>در تنظیمات، اتصال مدل را بررسی کن؛ حالت قطعی را به‌عنوان پاسخ موفق مدل معرفی نکن.</li><li>در برنامه مراجعه، انتخاب‌های قبلی همین دستگاه را مرور کن؛ شروع سناریو آن‌ها را حذف نمی‌کند.</li><li>نقشه و عکس‌ها اینترنت می‌خواهند؛ فهرست فروشنده و نشانی متنی هم قابل نمایش است.</li><li>ساعت گزارش‌شده و فاصله مستقیم، باز بودن زنده یا زمان سفر را ثابت نمی‌کنند.</li></ul>
    <div className="demo-actions"><Link className="demo-btn" href="/settings">بررسی اتصال و منبع داده</Link><Link className="demo-btn" href="/visit-plan">برنامه مراجعه</Link><Link className="demo-link" href="/compare?products=product_344eec9b70e49b40068fdedc,product_457a1ad4f04876a5e7c4387a">مقایسه دو لپ‌تاپ سناریو</Link></div>
   </section>
  </div>
 </main>;
}
