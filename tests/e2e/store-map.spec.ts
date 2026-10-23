import {test,expect,type Page,type Locator} from '@playwright/test';
test.use({actionTimeout:15000});
async function clickMapBackground(page:Page,map:Locator){
 await map.scrollIntoViewIfNeeded();
 const point=await map.evaluate(element=>{const r=element.getBoundingClientRect();for(let y=70;y<r.height-60;y+=35)for(let x=70;x<r.width-60;x+=35){const node=document.elementFromPoint(r.left+x,r.top+y);if(node&&element.contains(node)&&!node.closest('.leaflet-marker-icon,.leaflet-interactive,.leaflet-control,.map-caption'))return {x:r.left+x,y:r.top+y};}return null;});
 if(!point)throw new Error('No unobstructed map background found');
 await page.mouse.click(point.x,point.y);
}

test('category-store results show real product links on an OSM panel with working list and inquiry',async({page},testInfo)=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.goto('/chat');
 await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('فروشگاه‌هایی که کفش دارن رو روی نقشه نشون بده');
 await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 const response=page.locator('.message.assistant').last();await expect(response).toHaveAttribute('data-response-state','complete');
 const panel=response.getByRole('region',{name:'فروشگاه‌های دارای پیشنهاد واقعی'});
 await expect(panel).toBeVisible();await expect(panel.locator('.leaflet-container')).toBeVisible();
 await expect(panel).toContainText('OpenStreetMap');await expect(panel).toContainText('موجودی نامشخص');
 const match=panel.locator('.shopping-linked-store').first();await expect(match.locator('.source-label').first()).toBeVisible();
 await response.getByRole('button',{name:'منابع این پاسخ'}).click();const sources=page.getByRole('dialog',{name:'منابع و مراحل بررسی'});await expect(sources.locator('a[href^="/products/"]').first()).toBeVisible();await expect(sources.locator('a[href^="/shops/"]').first()).toBeVisible();await sources.getByRole('button',{name:'بستن',exact:true}).click();
 await panel.getByRole('button',{name:'فهرست فروشگاه‌ها',exact:true}).click();await expect(panel.getByRole('button',{name:'فهرست فروشگاه‌ها',exact:true})).toHaveAttribute('aria-pressed','true');await expect(panel.locator('.leaflet-container')).toHaveCount(0);
 await match.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/store-panel-${testInfo.project.name}.png`});
 await match.getByRole('button',{name:'آماده‌سازی استعلام'}).click();await expect(page.getByRole('dialog')).toContainText('شماره‌های دیتاست آزمایشی‌اند');
 expect(await page.locator('a[href^="tel:"],a[href^="sms:"],a[href*="wa.me"]').count()).toBe(0);
 const dimensions=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));expect(dimensions.s).toBeLessThanOrEqual(dimensions.w+1);
 await page.getByRole('dialog').getByRole('button',{name:'بستن',exact:true}).click();
 await panel.getByRole('button',{name:'نقشه فروشگاه‌ها',exact:true}).click();
 const marker=panel.locator('.shop-price-marker').nth(1);const targetId=await marker.getAttribute('data-offer-id');await marker.click();await expect(page).toHaveURL(/\/chat$/);await expect(panel.locator('.shopping-linked-store')).toHaveAttribute('data-offer-id',targetId!);
 const selectedId=await panel.locator('.shopping-linked-store').getAttribute('data-offer-id');
 await expect(panel.getByRole('link',{name:'باز کردن نقشه و فروشندگان'})).toHaveAttribute('href',new RegExp(`selected=${selectedId}`));
 await clickMapBackground(page,panel.locator('.leaflet-container'));
 await expect(page).toHaveURL(/\/map\?offers=/);await expect(page.getByRole('region',{name:'جزئیات پیشنهاد انتخاب‌شده'})).toHaveAttribute('data-offer-id',selectedId!);
 await page.getByRole('link',{name:'بازگشت به گفت‌وگو',exact:true}).click();await expect(page.locator('.message.user').last()).toContainText('فروشگاه‌هایی که کفش دارن');
});

test('dedicated map keeps all sellers while marker and list selection show only the chosen real offer',async({page,request})=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 const result=await(await request.get('/api/products/product_7cc2f9aa4265d40d8ec72d6e/offers?limit=5')).json();
 const offers=result.data as {offer_id:string;product_id:string;shop_id:string;shop:{lat:number|null;lon:number|null;name:string|null}}[];
 const distinct=offers.filter((offer,index)=>offer.shop.lat!==null&&offer.shop.lon!==null&&offers.findIndex(other=>other.shop_id===offer.shop_id)===index).slice(0,2);
 expect(distinct).toHaveLength(2);
 await page.goto(`/map?offers=${distinct.map(offer=>offer.offer_id).join(',')}`);
 await expect(page.getByRole('heading',{name:'نقشه و فروشندگان',exact:true})).toBeVisible();
 const markers=page.locator('.shop-price-marker');await expect(markers).toHaveCount(2);
 await markers.first().click();
 const details=page.getByRole('region',{name:'جزئیات پیشنهاد انتخاب‌شده'});await expect(details).toHaveCount(1);
 await expect(details).toHaveAttribute('data-offer-id',distinct[0].offer_id);
 await expect(details.locator('a[href^="/products/"]').first()).toHaveAttribute('href',`/products/${distinct[0].product_id}`);
 await page.locator(`[data-seller-offer="${distinct[1].offer_id}"]`).click();
 await expect(details).toHaveAttribute('data-offer-id',distinct[1].offer_id);
 await expect(page.locator('[data-seller-offer][aria-pressed="true"]')).toHaveCount(1);
 await expect(markers).toHaveCount(2);
 await expect(page.locator('.shop-price-marker[aria-pressed="true"]')).toHaveCount(1);
 await expect(details).not.toContainText(distinct[0].offer_id);
 await page.reload();await expect(page.getByRole('heading',{name:'نقشه و فروشندگان',exact:true})).toBeVisible();await expect(markers).toHaveCount(2);
 expect(await page.locator('a[href^="tel:"],a[href^="sms:"],a[href*="wa.me"]').count()).toBe(0);
 const dimensions=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));expect(dimensions.s).toBeLessThanOrEqual(dimensions.w+1);
});

test('map deep link rejects excess or malformed IDs without rendering untrusted data',async({request})=>{
 const excess=await request.get('/map?offers=offer_a,offer_b,offer_c,offer_d,offer_e,offer_f&price=1');
 expect(await excess.text()).toContain('حداکثر پنج');
 const malformed=await request.get('/map?offers=%3Cscript%3E');expect(await malformed.text()).toContain('شناسه‌های پیشنهاد معتبر نیستند');
});

test('opening the full map waits for canonical completion so returning preserves the chat',async({page,request})=>{
 const result=await(await request.get('/api/products/product_7cc2f9aa4265d40d8ec72d6e/offers?limit=1')).json();
 const product=await(await request.get('/api/products/product_7cc2f9aa4265d40d8ec72d6e')).json();
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.addInitScript(({offer,product})=>{
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   if(String(input)!=='/api/chat')return original(input,init);
   const encoder=new TextEncoder();let controller:ReadableStreamDefaultController<Uint8Array>;
   const block={type:'store_discovery',title:'نتیجه انتخاب‌شده',query:'کالای انتخابی',matches:[{offer,product}],limited:true};
   const response={reply:'پاسخ کامل',mode:'provider',blocks:[block],events:[],session:{}};
   const body=new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(encoder.encode(JSON.stringify({type:'block',block})+'\n'));}});
   Object.assign(window,{finishMapChat:()=>{controller.enqueue(encoder.encode(JSON.stringify({type:'done',response})+'\n'));controller.close();}});
   return new Response(body,{headers:{'content-type':'application/x-ndjson'}});
  };
 },{offer:result.data[0],product});
 await page.goto('/chat');await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('نقشه فروشندگان');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
 const preview=page.locator('.shopping-discovery-map');await expect(preview).toHaveCount(0);
 await page.evaluate(()=>{(window as unknown as {finishMapChat:()=>void}).finishMapChat();});const link=preview.locator('a.shopping-open-map');await expect(link).toHaveAttribute('aria-disabled','false');
 await link.click();await expect(page).toHaveURL(/\/map\?/);await page.getByRole('link',{name:'بازگشت به گفت‌وگو'}).click();await expect(page.locator('.message.user')).toContainText('نقشه فروشندگان');
});
