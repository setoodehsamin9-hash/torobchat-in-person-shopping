import {test,expect,type Page} from '@playwright/test';
import type {ChatResponse} from '../../src/lib/contracts';
// Chromium may not retain streamed response bodies in CDP. Clone the actual
// browser response without changing its request, framing, or the UI reader.
async function captureChatWire(page:Page){
 await page.addInitScript(()=>{
  const original=window.fetch.bind(window);Object.assign(window,{chatWireResponses:[]});
  window.fetch=async(input,init)=>{
   const response=await original(input,init);
   if(String(input)==='/api/chat'){
    const copy=response.clone();
    void copy.text().then(body=>{
     const result=copy.headers.get('content-type')?.includes('application/x-ndjson')?body.trim().split('\n').map(line=>JSON.parse(line)).find(event=>event.type==='done')?.response:JSON.parse(body);
     (window as unknown as {chatWireResponses:unknown[]}).chatWireResponses.push(result);
    });
   }
   return response;
  };
 });
}
async function chatResult(page:Page,index:number):Promise<ChatResponse>{
 await expect.poll(()=>page.evaluate(()=> (window as unknown as {chatWireResponses:unknown[]}).chatWireResponses.length)).toBeGreaterThan(index);
 const result=await page.evaluate(index=>(window as unknown as {chatWireResponses:ChatResponse[]}).chatWireResponses[index],index);
 expect(result,'stream includes canonical completion').toBeTruthy();return result;
}
const camera='product_7cc2f9aa4265d40d8ec72d6e';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',r=>r.abort());});
test('root opens the in-person assistant instead of a separate catalog',async({page})=>{
 await page.goto('/');await expect(page).toHaveURL(/\/chat$/);await expect(page.getByRole('heading',{name:'اول مطمئن شو، بعد راه بیفت.'})).toBeVisible();
 await expect(page.getByRole('tab',{name:/پیگیری استعلام/})).toBeVisible();await expect(page.locator('.journey-steps')).toContainText('پیش از حرکت');
 expect(await page.getByRole('link',{name:'بازگشت به جست‌وجوی کالا'}).count()).toBe(0);
 const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
});
test('static navigation identity respects the reference palette',async({page},testInfo)=>{
 await page.goto('/chat');
 const mark=page.locator('.welcome-icon img');await expect(mark).toHaveAttribute('src','/brand/torob-radish.png');
 await expect.poll(()=>mark.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===76)).toBe(true);
 expect(await page.locator('.chat-main').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(15, 17, 23)');
 await page.screenshot({path:`test-results/in-person-welcome-${testInfo.project.name}.png`,fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>mark.evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain('/brand/torob-radish.png');
});
test('store shortcuts preserve the product and avoid AI requests',async({page})=>{
 await captureChatWire(page);
 await page.goto(`/chat?product_id=${camera}`);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'فروشگاه‌های همین کالا',exact:true}).click();
 const result=await response;expect(result.status()).toBe(200);
 expect(result.request().postDataJSON()).toMatchObject({interaction:'show_stores',session:{product_id:camera}});
 const payload=await chatResult(page,0);expect(payload.agent?.provider_requests).toBe(0);expect(payload.agent?.retrieval?.mode).toBe('skipped');
 await expect(page.locator('.message.assistant .offer-card').first()).toBeVisible();
 expect(payload.blocks.flatMap(block=>block.type==='offers'?block.offers:[]).every(offer=>offer.product_id===camera)).toBe(true);
 const nearby=page.waitForResponse(r=>r.url().endsWith('/api/chat')&&r.request().method()==='POST');await page.getByRole('button',{name:'نزدیک من',exact:true}).click();
 await nearby;const near=await chatResult(page,1);expect(near.agent?.provider_requests).toBe(0);expect(near.events).toHaveLength(0);expect(near.reply).toContain('نقطه‌ای روی نقشه');
});
test('route controls require disclosure and show an honest no-key state',async({page})=>{
 await page.goto(`/chat?product_id=${camera}`);
 await page.locator('.chat-filters summary').click();await page.locator('#neighborhood').selectOption({label:'مرکز تهران'});await page.locator('.chat-filters summary').click();
 await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('فروشنده‌های این محصول را نشان بده');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 const panel=page.locator('.journey-panel').first();await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'دریافت مسیر از نشان'})).toBeDisabled();
 await panel.getByRole('checkbox',{name:/ارسال نقطه انتخاب‌شده/}).check();await panel.getByRole('button',{name:'دریافت مسیر از نشان'}).click();await expect(panel.getByRole('status').filter({hasText:'زمان رسیدن نامشخص'})).toBeVisible();
});
test('simulated inquiry persists in the tracking switch without contacting a dataset phone',async({page})=>{
 await page.goto(`/chat?product_id=${camera}`);await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('فروشنده‌های این محصول را نشان بده');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 await page.locator('.message.assistant .offer-card').first().getByRole('button',{name:'آماده‌سازی استعلام'}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'بررسی هزینه استعلام'}).click();await expect(dialog.locator('.contact-quote')).toContainText('شبیه‌سازی');await dialog.getByRole('checkbox',{name:/هزینه و نوع این استعلام/}).check();await dialog.getByRole('button',{name:'شروع استعلام شبیه‌سازی'}).click();
 await expect(page.getByRole('tab',{name:/پیگیری استعلام/})).toHaveAttribute('aria-selected','true');await expect(page.locator('.contact-job').first()).toContainText('شبیه‌سازی');await page.reload();await page.getByRole('tab',{name:/پیگیری استعلام/}).click();await expect(page.locator('.contact-job').first()).toBeVisible();
 expect(await page.locator('a[href^="tel:"],a[href^="sms:"],a[href*="wa.me"]').count()).toBe(0);
});
