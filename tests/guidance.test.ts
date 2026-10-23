import {describe,it,expect} from 'vitest';
import {safeModelGuidance} from '../src/lib/agent/guidance';
describe('non-factual conversational model guidance',()=>{
 it('keeps a natural Persian greeting and a useful buying question',()=>{
  const message='سلام! برای خرید حضوری دنبال چه کالایی هستی؟';
  expect(safeModelGuidance(message)).toBe(message);
 });
 it('keeps an actionable suggestion without turning it into a seller fact',()=>{
  const message='برای شروع، بهتره کاربردت رو مشخص کنی تا گزینه‌ها رو دقیق‌تر بررسی کنیم.';
  expect(safeModelGuidance(message)).toBe(message);
 });
 it.each(['قیمت امروز ۱۰۰ تومان است.','این فروشگاه موجود دارد.','با فروشنده تماس گرفتم.','فروشگاه الان باز است.','موجودی تأیید شد.','گارانتی معتبر دارد.','این ارزان‌ترین فروشگاه است.','سفارش ثبت شد.','<img src=x onerror=alert(1)>','از https://example.test بخر','شماره فروشنده 09000000000 است.'])('does not accept an unsupported model fact: %s',message=>{
  expect(safeModelGuidance(message)).toBeUndefined();
 });
 it('rejects oversized text instead of truncating potentially unsafe content',()=>expect(safeModelGuidance('سلام '.repeat(160))).toBeUndefined());
 it.each(['همین حالا توی انبار فروشنده هست.','با فروشنده صحبت کردم و کالا را برایت رزرو کردم.','برای این هدفون باید دو میلیون پرداخت کنی.','فروشگاه تا شب کار می‌کند.','این فروشنده بهترین کیفیت را دارد.'])('rejects non-numeric fabricated claims outside the process vocabulary: %s',text=>expect(safeModelGuidance(text)).toBeUndefined());
});

it.each(['پیشنهادهای مرتبط و فروشگاه‌ها را برای مراجعه حضوری بررسی می‌کنم.','شرایط انتخابت را با هم بررسی می‌کنیم.'])('keeps natural first-person process phrasing without factual seller assertions: %s',message=>expect(safeModelGuidance(message)).toBe(message));

it.each([
 'برای پیدا کردن فروشگاه‌های لامپ برای مراجعه حضوری، کدام محدودهٔ تهران برات مناسب است؟',
 'لامپ را برای چه فضایی می‌خواهی؛ اتاق، آشپزخانه یا فضای باز؟',
 'لامپ آفتابی می‌خواهی یا مهتابی؟',
 'حتماً! لامپ رو برای خونه می‌خوای یا محل کار؟',
])('keeps a natural needs question without asserting seller facts: %s',message=>expect(safeModelGuidance(message)).toBe(message));

it.each(['این فروشگاه تا شب کار می‌کند؟','همین حالا توی انبار فروشنده هست؟','این فروشنده بهترین کیفیت را دارد؟'])('does not disguise a seller assertion as a buying question: %s',message=>expect(safeModelGuidance(message)).toBeUndefined());
