import {test,expect} from '@playwright/test';

test('demo provides three scenarios and starts with independent purchase constraints',async({page},testInfo)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('torob-conversations',JSON.stringify([{id:'previous',title:'خرید قبلی',messages:[{id:'old',role:'user',text:'خرید قبلی'}],session:{maxPrice:1,installmentOnly:true,region:'محدوده قبلی'}}]));
  localStorage.setItem('torob-purchase-session-v1',JSON.stringify({maxPrice:1,installmentOnly:true,region:'محدوده قبلی',product_id:'product_previous'}));
 });
 let chatRequests=0;page.on('request',request=>{if(request.url().endsWith('/api/chat'))chatRequests++;});
 await page.goto('/demo');
 await expect(page.getByRole('heading',{name:'سه مسیر برای نمایش خرید حضوری'})).toBeVisible();
 await expect(page.getByRole('link',{name:'شروع گفت‌وگوی این سناریو'})).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/demo-guide-${testInfo.project.name}.png`,fullPage:true});
 await page.getByRole('link',{name:'شروع گفت‌وگوی این سناریو'}).first().click();
 await expect(page.getByRole('textbox',{name:'پیام شما به دستیار خرید'})).toHaveValue(/R50i/);
 await expect(page.locator('.message.user')).toHaveCount(0);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('torob-purchase-session-v1')||'{}'));
 expect(session.maxPrice).toBe(2_000_000);expect(session.installmentOnly).not.toBe(true);
 expect(session.region).toBeUndefined();expect(session.product_id).toBe('product_92ac53fa75e18e8e73f20b56');
 expect(chatRequests).toBe(0);
 const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('torob-conversations')||'[]'));
 expect(history.some((entry:{id:string})=>entry.id==='previous')).toBe(true);
});

test('lighting demo links its district map and a specific product without inherited constraints',async({page})=>{
 await page.goto('/demo');
 await expect(page.getByRole('link',{name:'شروع از بورس‌یاب لوستر'})).toHaveAttribute('href',/\/bazaar\?q=/);
 await page.getByRole('link',{name:'شروع گفت‌وگوی این سناریو'}).nth(2).click();
 await expect(page.getByRole('textbox',{name:'پیام شما به دستیار خرید'})).toHaveValue(/لوستر مدرن ستاره/);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('torob-purchase-session-v1')||'{}'))).toMatchObject({maxPrice:8_000_000,product_id:'product_d2954b7897fef7bd2171b3ca'});
});

test('credit demo restores its own installment and budget constraints',async({page})=>{
 await page.goto('/chat?demo=credit-laptop');
 await expect(page.getByRole('textbox',{name:'پیام شما به دستیار خرید'})).toHaveValue(/Vostro 5581/);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('torob-purchase-session-v1')||'{}'))).toMatchObject({installmentOnly:true,maxPrice:70_000_000,product_id:'product_344eec9b70e49b40068fdedc'});
 if(!await page.getByRole('link',{name:'راهنمای سناریوهای دمو'}).isVisible())await page.getByRole('button',{name:'نمایش تاریخچه'}).click();
 await expect(page.getByRole('link',{name:'راهنمای سناریوهای دمو'})).toBeVisible();
 expect(await page.locator('a[href^="tel:"],a[href^="sms:"],a[href*="wa.me"]').count()).toBe(0);
});

test('headphone demo continues through simulated unavailability to an alternative visit',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.goto('/chat?demo=headphone');
 await expect(page.getByRole('textbox',{name:'پیام شما به دستیار خرید'})).toHaveValue(/R50i/);
 await page.getByRole('button',{name:'فروشگاه‌های همین کالا',exact:true}).click();
 await page.locator('.message.assistant .offer-card').first().getByRole('button',{name:'آماده‌سازی استعلام'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('منبع نتیجه').selectOption('simulation');
 await dialog.getByRole('combobox',{name:'نتیجه استعلام'}).selectOption('not_available');
 await dialog.getByRole('button',{name:'ثبت نتیجه شبیه‌سازی',exact:true}).click();
 await expect(dialog.locator('.contact-timeline')).toContainText('شبیه‌سازی: ناموجود');
 await dialog.getByRole('button',{name:/دیدن فروشگاه یا کالای جایگزین/}).click();
 const alternatives=page.locator('.alternative-panel');
 await expect(alternatives).toContainText('ابتدا همان کالا، در فروشگاه دیگر');
 await alternatives.locator('.offer-card').first().getByRole('button',{name:'افزودن به برنامه'}).click();
 await page.goto('/visit-plan');
 await expect(page.getByRole('heading',{name:'چک‌لیست قبل از مراجعه'})).toBeVisible();
 await expect(page.locator('.visit-stop')).toHaveCount(1);
 expect(await page.locator('a[href^="tel:"],a[href^="sms:"],a[href*="wa.me"]').count()).toBe(0);
});
