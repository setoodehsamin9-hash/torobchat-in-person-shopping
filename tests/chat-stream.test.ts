import {describe,it,expect,vi,afterEach} from 'vitest';
import {createChatStream} from '../src/lib/chat-stream';
import {streamChat} from '../src/lib/chat-stream-client';
import type {ChatResponse} from '../src/lib/contracts';
const canonical:ChatResponse={reply:'سلام! چه کالایی برای خرید حضوری می‌خواهی؟',mode:'provider',blocks:[],events:[],session:{}};
const encoder=new TextEncoder();
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('bounded progressive chat protocol',()=>{
 it('delivers real task progress before the task resolves and ends with canonical state',async()=>{
  let finish!:(r:ChatResponse)=>void;
  const gate=new Promise<ChatResponse>(resolve=>{finish=resolve;});
  const response=createChatStream(async emit=>{emit({type:'status',message:'در حال بررسی'});return gate;});
  expect(response.headers.get('content-type')).toContain('application/x-ndjson');
  const reader=response.body!.getReader();const first=await reader.read();expect(new TextDecoder().decode(first.value)).toContain('در حال بررسی');
  finish(canonical);let rest='';for(;;){const part=await reader.read();if(part.done)break;rest+=new TextDecoder().decode(part.value);}
  const events=rest.trim().split('\n').map(s=>JSON.parse(s));expect(events.some(e=>e.type==='text')).toBe(true);expect(events.at(-1)).toEqual({type:'done',response:canonical});
 });
 it('uses a sanitized error and never serializes a raw provider/SQL exception',async()=>{
  const response=createChatStream(async()=>{throw new Error('private-database-error');});const text=await response.text();
  expect(text).toContain('"type":"error"');expect(text).not.toContain('private-database-error');expect(text).not.toContain('"type":"done"');
 });
 it('aborts the work when the consumer cancels the stream',async()=>{
  let signal:AbortSignal|undefined;const response=createChatStream(async(_emit,s)=>{signal=s;return new Promise(()=>{});});
  const reader=response.body!.getReader();await reader.cancel();expect(signal?.aborted).toBe(true);
 });
 it('parses UTF-8 across chunks and requires a final canonical response',async()=>{
  const wire=encoder.encode(JSON.stringify({type:'text',delta:'سلام'})+'\n'+JSON.stringify({type:'done',response:canonical})+'\n');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(new ReadableStream({start(c){for(let i=0;i<wire.length;i+=3)c.enqueue(wire.slice(i,i+3));c.close();}}),{headers:{'content-type':'application/x-ndjson'}})));
  const seen:string[]=[];expect(await streamChat({},e=>seen.push(e.type))).toEqual(canonical);expect(seen).toEqual(['text','done']);
 });
 it('rejects a truncated stream instead of treating partial cards as a finished answer',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({type:'text',delta:'ناتمام'})+'\n',{headers:{'content-type':'application/x-ndjson'}})));
  await expect(streamChat({},()=>{})).rejects.toThrow('کامل');
 });
 it('rejects malformed or oversized frames and honours non-200 JSON errors',async()=>{
  for(const wire of ['{bad}\n',JSON.stringify({type:'text',delta:'x'.repeat(2100000)})+'\n']){
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(wire,{headers:{'content-type':'application/x-ndjson'}})));await expect(streamChat({},()=>{})).rejects.toThrow();
  }
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'مبدأ درخواست معتبر نیست.'},{status:403})));await expect(streamChat({},()=>{})).rejects.toThrow('مبدأ');
 });
 it('accepts legacy JSON without performing a retry or another API request',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(canonical)));
  expect(await streamChat({},()=>{})).toEqual(canonical);expect(fetch).toHaveBeenCalledTimes(1);
 });
});
