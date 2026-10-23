import { test, expect } from '@playwright/test';
const camera='product_7cc2f9aa4265d40d8ec72d6e';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',r=>r.abort());});
async function noOverflow(page:import('@playwright/test').Page){const box=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(box.scroll).toBeLessThanOrEqual(box.width+1);}

test('chat-first entry and real product deep link',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page).toHaveURL(/\/chat$/);await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{level:1})).toBeVisible();await noOverflow(page);
 const search=await(await request.get('/api/products?query='+encodeURIComponent('هدفون انکر R50i')+'&limit=1')).json();expect(search.data.length).toBe(1);
 await page.goto('/products/'+search.data[0].product_id);await expect(page.locator('.product-detail h1')).toBeVisible();await page.reload();await expect(page.locator('.product-detail h1')).toBeVisible();await noOverflow(page);expect(errors).toEqual([]);
});

test('strict financing, Persian budget, manual location, source truth',async({page})=>{
 await page.goto(`/products/${camera}`);await expect(page.locator('.offer-card').first()).toBeVisible();await expect(page.locator('.offers-section h2')).toContainText('۲۳');
 await page.getByRole('checkbox',{name:/فقط اقساط حضوری/}).check();await expect(page.locator('.offer-card')).toHaveCount(5);await page.locator('#max-budget').fill('۲۰۰۰۰۰۰');await expect(page.locator('.offer-card')).toHaveCount(3);
 await page.locator('#neighborhood').selectOption({label:'مرکز تهران'});await expect(page.locator('.offer-card').first()).toContainText('کیلومتر مستقیم');
 await page.locator('#radius').fill('1');await expect(page.locator('.offer-card').first()).toBeVisible();await noOverflow(page);
 await expect(page.locator('.offer-card').first()).toContainText('موجودی تأیید نشده');expect(await page.locator('a[href^="tel:"],a[href*="wa.me"],a[href^="sms:"]').count()).toBe(0);
 await page.screenshot({path:`test-results/filters-${test.info().project.name}.png`,fullPage:true});
});

test('standalone chat renders real tool-driven product cards and persists history',async({page})=>{
 await page.goto('/chat');await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('هدفون انکر R50i تا ۲ میلیون');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();await expect(page.locator('.message.assistant')).toBeVisible();await expect(page.locator('.message.assistant .product-card').first()).toBeVisible();await expect(page.locator('.mode-label')).toContainText(/قطعی|هوشمند/);await page.getByText('مراحل بررسی اطلاعات',{exact:true}).click();await expect(page.locator('.tool-step').first()).toBeVisible();await noOverflow(page);await page.reload();await expect(page.locator('.message.assistant .product-card').first()).toBeVisible();
 await page.screenshot({path:`test-results/chat-${test.info().project.name}.png`,fullPage:true});
});

test('inquiry simulation, alternatives and visit plan remain explicit',async({page})=>{
 await page.goto(`/products/${camera}`);await expect(page.locator('.offer-card').first()).toBeVisible();await page.locator('.offer-card').first().getByRole('button',{name:'افزودن به برنامه'}).click();await page.locator('.offer-card').first().getByRole('button',{name:'آماده‌سازی استعلام'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('textbox')).not.toHaveValue('');await expect(dialog).toContainText('شماره‌های دیتاست آزمایشی‌اند');
 await dialog.getByRole('combobox',{name:'نتیجه استعلام'}).selectOption('not_available');await dialog.getByRole('button',{name:'ثبت نتیجه شبیه‌سازی'}).click();await expect(dialog.locator('.contact-timeline')).toContainText('ناموجود');await expect(dialog.locator('.contact-timeline')).toContainText('شبیه‌سازی');
 await dialog.getByRole('button',{name:/دیدن فروشگاه یا کالای جایگزین/}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.alternative-panel')).toBeVisible();await noOverflow(page);
 await page.goto('/visit-plan');await expect(page.locator('.visit-plan')).toBeVisible();await expect(page.locator('.visit-checklist input').first()).toBeVisible();await page.locator('.visit-checklist input').first().check();await page.reload();await expect(page.locator('.visit-checklist input').first()).toBeChecked();await noOverflow(page);
});

test('product and same-product seller comparisons work',async({page,request})=>{
 const search=await(await request.get('/api/products?query='+encodeURIComponent('هدفون انکر R50i')+'&limit=2')).json();expect(search.data.length).toBe(2);
 await page.goto(`/compare?products=${search.data.map((p:{product_id:string})=>p.product_id).join(',')}`);await expect(page.locator('.comparison-table')).toBeVisible();await expect(page.locator('.comparison-table thead th')).toHaveCount(3);await noOverflow(page);
 const offers=await(await request.get(`/api/products/${camera}/offers?limit=2`)).json();await page.goto(`/compare?product=${camera}&offers=${offers.data.map((o:{offer_id:string})=>o.offer_id).join(',')}`);await expect(page.locator('.comparison-table')).toBeVisible();await expect(page.locator('.comparison-table')).toContainText('موجودی');await noOverflow(page);
});

test('API/empty/missing-product errors are honest and settings load',async({page,request})=>{
 const empty=await(await request.get('/api/products?query='+encodeURIComponent('محصولکاملاًناموجود۱۲۳۴۵۶'))).json();expect(empty.data).toHaveLength(0);
 await page.goto('/products/product_missing_record');await expect(page.locator('.error-state')).toBeVisible();await page.goto('/settings');await expect(page.getByRole('heading',{level:1})).toBeVisible();await noOverflow(page);
 await page.route('**/api/chat',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'خطای آزمایشی اتصال دیتابیس'})}));await page.goto('/chat');await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('هدفون');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();await expect(page.locator('.error-state')).toContainText('خطای آزمایشی');
});

test('exact selected product survives handoff into standalone chat',async({page})=>{
 await page.goto(`/products/${camera}`);await expect(page.locator('.product-detail h1')).toBeVisible();await page.getByRole('link',{name:/انتخاب با کمک ترب‌چت/}).click();await expect(page).toHaveURL(/\/chat/);await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('فروشنده‌های این محصول را نشان بده');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();await expect(page.locator('.message.assistant .offer-card').first()).toBeVisible();await expect(page.locator(`.message.assistant a[href='/products/${camera}']`)).toBeVisible();
});

test('shop detail shows real declared schedule rather than unknown',async({page,request})=>{
 const response=await(await request.get(`/api/products/${camera}/offers?limit=10`)).json();
 const offer=response.data.find((o:{shop:{weekly_hours:Record<string,{status:string;shifts:{start_time:string;end_time:string}[]}>}})=>Object.values(o.shop.weekly_hours).some(h=>h.status==='declared'&&h.shifts.some(s=>s.start_time!==s.end_time)));
 const entry=Object.values(offer.shop.weekly_hours as Record<string,{status:string;shifts:{start_time:string;end_time:string}[]}>).find(h=>h.status==='declared'&&h.shifts.some(s=>s.start_time!==s.end_time))!;const shift=entry.shifts.find(s=>s.start_time!==s.end_time)!;
 await page.goto(`/shops/${offer.shop_id}`);await expect(page.locator('.hours-list')).toContainText(shift.start_time.slice(0,5));await noOverflow(page);
});

test('conversation history restores its own budget and shopping context',async({page},info)=>{
 await page.goto('/chat');const composer=page.getByRole('textbox',{name:'پیام شما به دستیار خرید'});const send=page.getByRole('button',{name:'ارسال پیام',exact:true});
 await composer.fill('هدفون انکر R50i تا ۲ میلیون');await send.click();await expect(page.locator('.message.assistant')).toHaveAttribute('data-response-state','complete');
 if(info.project.name==='mobile')await page.getByRole('button',{name:'نمایش تاریخچه'}).click();await page.getByRole('button',{name:'گفت‌وگوی جدید',exact:true}).click();
 await composer.fill('شارژر اپل ۲۰ وات تا ۵ میلیون');await send.click();await expect(page.locator('.message.assistant')).toHaveAttribute('data-response-state','complete');
 if(info.project.name==='mobile')await page.getByRole('button',{name:'نمایش تاریخچه'}).click();await page.getByRole('button',{name:'هدفون انکر R50i تا ۲ میلیون',exact:true}).click();
 const request=page.waitForRequest(r=>r.url().endsWith('/api/chat')&&r.method()==='POST');await composer.fill('فروشنده نزدیکش کجاست؟');await send.click();const body=(await request).postDataJSON();expect(body.session.maxPrice).toBe(2000000);expect(body.session.query.toLowerCase()).toContain('r50i');
});
