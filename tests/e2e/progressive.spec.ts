import {test,expect,type Page} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BrandMark} from '../../src/components/brand-mark';

test('idle branding uses a static PNG while response branding may animate',()=>{
 expect(renderToStaticMarkup(createElement(BrandMark))).toContain('src="/brand/torob-radish.png"');
 expect(renderToStaticMarkup(createElement(BrandMark,{busy:true}))).toContain('src="/brand/torob-radish.gif"');
});

const partial='می‌توانیم انتخابت را مرحله‌به‌مرحله بررسی کنیم.';
const canonical='انتخابت را با داده‌های ثبت‌شده بررسی می‌کنیم.';
async function controlledStream(page:Page){
 await page.addInitScript(({partial,canonical})=>{
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   if(String(input)!=='/api/chat')return originalFetch(input,init);
   const encoder=new TextEncoder();let controller:ReadableStreamDefaultController<Uint8Array>;
   const response={reply:canonical,mode:'provider',blocks:[{type:'products',title:'پیشنهادهای ثبت‌شده',products:[]}],events:[],session:{},agent:{request_id:'controlled',phases:[],provider_requests:1,tool_calls:0,model:'test-model',provider:'test-provider'}};
   const body=new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(encoder.encode(JSON.stringify({type:'status',message:'در حال بررسی درخواست شما'})+'\n'));c.enqueue(encoder.encode(JSON.stringify({type:'block',block:response.blocks[0]})+'\n'));c.enqueue(encoder.encode(JSON.stringify({type:'text',delta:partial})+'\n'));}});
   Object.assign(window,{finishChatStream:()=>{controller.enqueue(encoder.encode(JSON.stringify({type:'done',response})+'\n'));controller.close();}});
   init?.signal?.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
   return new Response(body,{headers:{'content-type':'application/x-ndjson'}});
  };
 },{partial,canonical});
}
async function send(page:Page){await page.getByRole('textbox',{name:'پیام شما به دستیار خرید'}).fill('برای خرید کمکم کن');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();}
test('only the active assistant animates and result cards wait for canonical completion',async({page})=>{
 await controlledStream(page);await page.goto('/chat');
 for(const selector of ['.chat-header','.chat-sidebar','.welcome-icon'])await expect(page.locator(`${selector} img`).first()).toHaveAttribute('src','/brand/torob-radish.png');
 await send(page);
 const assistant=page.locator('.message.assistant');await expect(assistant).toContainText(partial);await expect(assistant).not.toContainText('پیشنهادهای ثبت‌شده');await expect(assistant).toHaveAttribute('data-response-state','streaming');
 await expect(assistant.locator('.assistant-avatar img')).toHaveAttribute('src','/brand/torob-radish.gif');
 await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>assistant.locator('.assistant-avatar img').evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain('/brand/torob-radish.png');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('torob-conversations')||'[]').flatMap((c:{messages:{role:string}[]})=>c.messages).some((m:{role:string})=>m.role==='assistant'))).toBe(false);
 await page.evaluate(()=>{(window as unknown as {finishChatStream:()=>void}).finishChatStream();});
 await expect(assistant).toHaveAttribute('data-response-state','complete');await expect(assistant).toContainText(canonical);await expect(assistant).toContainText('پیشنهادهای ثبت‌شده');await expect(assistant).toContainText('test-provider');await expect(assistant).toContainText('test-model');
 await expect(assistant.locator('.assistant-avatar img')).toHaveAttribute('src','/brand/torob-radish.png');
 await page.reload();await expect(page.locator('.message.assistant')).toContainText(canonical);await expect(page.locator('.message.assistant .assistant-avatar img')).toHaveAttribute('src','/brand/torob-radish.png');
});
test('stopping keeps partial results visibly incomplete and does not persist an assistant completion',async({page})=>{
 await controlledStream(page);await page.goto('/chat');await send(page);await expect(page.locator('.message.assistant')).toContainText(partial);
 await page.getByRole('button',{name:'توقف',exact:true}).click();await expect(page.locator('.message.assistant')).toHaveAttribute('data-response-state','cancelled');await expect(page.locator('.message.assistant')).toContainText('پاسخ متوقف شد');
 await expect(page.locator('.message.assistant .assistant-avatar img')).toHaveAttribute('src','/brand/torob-radish.png');await page.reload();await expect(page.locator('.message.assistant')).toHaveCount(0);
});
test('a stream failure keeps partial evidence and explains that completion failed',async({page})=>{
 await page.addInitScript(()=>{const fetchOriginal=window.fetch.bind(window);window.fetch=async(input,init)=>String(input)==='/api/chat'?new Response(JSON.stringify({type:'text',delta:'در حال بررسی انتخاب شما'})+'\n'+JSON.stringify({type:'error',message:'ارتباط با سرویس قطع شد'})+'\n',{headers:{'content-type':'application/x-ndjson'}}):fetchOriginal(input,init);});
 await page.goto('/chat');await send(page);await expect(page.locator('.message.assistant')).toHaveAttribute('data-response-state','error');await expect(page.locator('.message.assistant')).toContainText('پاسخ کامل نشد');await expect(page.locator('.message.assistant')).toContainText('در حال بررسی انتخاب شما');
});
