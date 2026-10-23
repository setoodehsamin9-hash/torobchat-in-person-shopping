import {normalizeText} from '../domain';

// Personal buying questions may use natural product and use-case words.
// Declarative prose remains restricted to process language; factual details
// are supplied by validated source cards.
const processVocabulary=new Set(normalizeText(`سلام درود وقت بخیر خوش آمدی ممنون حتما بله
برای خرید حضوری مراجعه دنبال چه کالایی کالا محصول محصولی مدل مدلها مدل‌های مدل‌ها
هستی هستید میخواهی می‌خواهی میخواهید می‌خواهید میخواهم می‌خواهم میخوای می‌خوای میخواید
می می‌کنیم میکنیم شرایط انتخابت مرتبط نتایج نتیجه پیشنهادهای فروشگاه فروشگاه‌ها فروشگاهها فروشنده فروشنده‌ها فروشندهها
چه کدام چی کاربرد کاربردت کاربردتان استفاده بیشتر اصلی مورد نظر نیاز نیازت نیازتان
بودجه بودجهات بودجه‌ات بودجهتان بودجه‌تان چقدر سقف حدود محدوده محله منطقه کجای تهران
ترجیح ترجیحت ترجیحتان میدهی می‌دهی میدهید می‌دهید دارید داری داری؟
انتخاب گزینه گزینهها گزینه‌ها پیشنهاد پیشنهادها این همین آنها اونها
بیایید بیا باهم با هم من ما شما تو بهت کمکت کمک کنم کنیم میکنم می‌کنم
بررسی مقایسه پیدا انتخاب دقیق دقیقتر دقیق‌تر راحت راحتتر راحت‌تر شروع ادامه قدم بعدی
اول ابتدا بعد سپس بهتر بهتره است رو را از به با بدون در تا که و یا هم مشخص کنی کنید
بدانم بدونم بگو بگویی بگویید توضیح بده بدهید دوست داری دارید لطفا لطفاً میکنی می‌کنی میکنید می‌کنید`).split(' '));

/** Model prose is only a short greeting, clarification or buying-process advice.
 * Prices, seller identity, inventory, hours and all factual fields stay in
 * validated, source-linked UI blocks; rejected prose never becomes evidence.
 */
export function safeModelGuidance(value:unknown):string|undefined{
 if(typeof value!=='string')return;
 const text=value.trim();if(!text||text.length>600||!/[\u0600-\u06ff]/u.test(text))return;
 if(/[0-9۰-۹٠-٩<>]|https?:|www\.|\b(?:sk-|Bearer\s)|(?:product|offer|shop)_|[\u202a-\u202e\u2066-\u2069]/iu.test(text))return;
 const normalized=normalizeText(text);
 if(/قیمت|تومان|ریال|موجود|گارانتی|ضمانت|تضمین|تایید|شماره|نشانی|ادرس|طبقه|واحد|امتیاز|ارزان ?ترین|ارزون ?ترین|باز است|باز هست|باز می ?باشد|تعطیل|تماس گرف|تماس برقرار|پیام (?:داد|فرست|ارسال)|ارسال شد|سفارش ثبت|خرید انجام/.test(normalized))return;
 // Advice must not declare an anonymous seller's property or location.
 if(/(?:فروشگاه|فروشنده|مغازه).*(?:به نام|نامش|واقع در|قرار دار|دارد|دارند|دارن|می ?فروش|می ?دهد|می ?دهند)/.test(normalized))return;
 const sentences=text.split(/(?<=[.!؟?\n])/u).map(s=>s.trim()).filter(Boolean);
 if(sentences.some(sentence=>{
  const plain=normalizeText(sentence);
  if(/^(?:سلام|درود|وقت بخیر|حتما|بله|ممنون|خوش آمدی)$/.test(plain))return false;
  const needsQuestion=/[؟?]$/.test(sentence)&&/(?:چه|کدام|کدوم|چی|چقدر|کجای|ترجیح|دنبال|کاربرد|بودجه|محدوده|می\s*خواهی|می\s*خوای)/.test(plain);
  if(needsQuestion&&!/انبار|رزرو|واقع در|به نام|تا شب|پرداخت کن|بهترین کیفیت/.test(plain))return false;
  const tokens=plain.split(' ').filter(Boolean);
  if(!tokens.length||tokens.some(token=>!processVocabulary.has(token)))return true;
  return !/(?:بررسی|مقایسه|پیدا|انتخاب)\s+(?:(?:می\s*)?(?:کنم|کنیم)|کنید)$/.test(plain);
 }))return;
 return text;
}
