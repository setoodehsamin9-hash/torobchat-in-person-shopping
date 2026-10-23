import { test, expect } from '@playwright/test';
const camera='product_7cc2f9aa4265d40d8ec72d6e';
// Catches lost product identity or budget/installment constraints in the preview,
// and missing source traceability when results move into the chat UI.
test('chat preview preserves product and hard filters and exposes real sources',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.goto(`/chat?product_id=${camera}`);
 await page.locator('.chat-filters summary').click();
 await page.locator('#max-budget').fill('۲۰۰۰۰۰۰');
 await page.getByRole('checkbox',{name:/فقط اقساط حضوری/}).check();
 await page.locator('.chat-filters summary').click();
 await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('فروشنده‌های این محصول را نشان بده');
 await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 await expect(page.locator('.message.assistant .offer-card').first()).toBeVisible();
 await page.getByRole('button',{name:'منابع این پاسخ',exact:true}).click();
 const sources=page.getByRole('dialog',{name:'منابع و مراحل بررسی'});
 await expect(sources).toContainText(camera);
 await expect(sources.locator('a[href^="/shops/"]').first()).toBeVisible();
 await sources.getByRole('button',{name:'بستن'}).click();
 const previewButton=page.locator('.message.assistant .product-card button[aria-haspopup="dialog"]').first();
 await previewButton.click();
 const dialog=page.getByRole('dialog',{name:'پیش‌نمایش محصول'});
 await expect(dialog).toContainText(camera);
 await expect(dialog.locator('.offer-card')).toHaveCount(3);
 await expect(dialog).toContainText('موجودی تأیید نشده');
 expect(await dialog.locator('a[href^="tel:"],a[href*="wa.me"]').count()).toBe(0);
 await dialog.getByRole('button',{name:'بستن'}).click();
 await expect(previewButton).toBeFocused();
 const viewport=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 expect(viewport.s).toBeLessThanOrEqual(viewport.w+1);
});

test('chat preview fails honestly and stays dismissible when offers cannot load',async({page})=>{
 await page.goto('/chat');
 await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('هدفون انکر R50i');
 await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 await expect(page.locator('.message.assistant .product-card').first()).toBeVisible();
 await page.route('**/api/products/*/offers?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'خطای آزمایشی دریافت پیشنهادها'})}));
 await page.locator('.message.assistant .product-card button[aria-haspopup="dialog"]').first().click();
 const dialog=page.getByRole('dialog',{name:'پیش‌نمایش محصول'});
 await expect(dialog.getByRole('alert')).toContainText('خطای آزمایشی دریافت پیشنهادها');
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();
});
