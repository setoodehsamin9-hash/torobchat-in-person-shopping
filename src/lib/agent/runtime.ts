import { query } from '../db/client';

function limit(name:string,fallback:number,min:number,max:number) {
  const value=Number(process.env[name]);
  return Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
}
export function agentConfig() {
  const base=new URL(process.env.AI_BASE_URL||'https://api.openai.com/v1');
  if(base.username||base.password||base.search||base.hash)throw new Error('نشانی سرویس مدل نامعتبر است');
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new Error('سرویس مدل باید HTTPS یا loopback محلی باشد');
  return {
    base,provider:process.env.AI_PROVIDER||'openai-compatible',model:process.env.AI_MODEL||'gpt-4.1-mini',
    configured:Boolean(process.env.AI_API_KEY),
    requests:limit('AI_MAX_REQUESTS_PER_TURN',3,1,4),tools:limit('AI_MAX_TOOL_CALLS',6,1,8),
    outputTokens:limit('AI_MAX_OUTPUT_TOKENS',800,128,1600),
    dailyLimit:limit('AI_DAILY_REQUEST_LIMIT',100,1,10000),timeoutMs:limit('AI_TIMEOUT_MS',30000,3000,60000),
  };
}
let quotaReady:Promise<unknown>|undefined;
async function prepareQuota() {
  if(!quotaReady)quotaReady=query(`CREATE TABLE IF NOT EXISTS ai_usage_daily (day text PRIMARY KEY,requests integer NOT NULL DEFAULT 0,prompt_tokens bigint NOT NULL DEFAULT 0,completion_tokens bigint NOT NULL DEFAULT 0)`).catch(error=>{quotaReady=undefined;throw error;});
  await quotaReady;
}
function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export async function reserveModelRequest(dailyLimit:number) {
  await prepareQuota();
  const rows=await query(`INSERT INTO ai_usage_daily(day,requests) VALUES ($1,1) ON CONFLICT(day) DO UPDATE SET requests=ai_usage_daily.requests+1 WHERE ai_usage_daily.requests<$2 RETURNING requests`,[today(),dailyLimit]);
  if(!rows.length)throw new Error('daily_limit');
}
export async function recordModelUsage(prompt:number,completion:number) {
  await query('UPDATE ai_usage_daily SET prompt_tokens=prompt_tokens+$2,completion_tokens=completion_tokens+$3 WHERE day=$1',[today(),Math.max(0,Math.floor(prompt)),Math.max(0,Math.floor(completion))]);
}
export async function agentStatus() {
  const config=agentConfig(); await prepareQuota();
  const rows=await query<{requests:number;prompt_tokens:string;completion_tokens:string}>('SELECT requests,prompt_tokens::text,completion_tokens::text FROM ai_usage_daily WHERE day=$1',[today()]);
  return {configured:config.configured,provider:config.provider,model:config.model,endpoint_host:config.base.host,
    limits:{requests_per_turn:config.requests,tools_per_turn:config.tools,output_tokens_per_request:config.outputTokens,daily_requests:config.dailyLimit,timeout_ms:config.timeoutMs},
    usage:{day:today(),requests:rows[0]?.requests??0,remaining_requests:Math.max(0,config.dailyLimit-(rows[0]?.requests??0)),prompt_tokens:rows[0]?.prompt_tokens??'0',completion_tokens:rows[0]?.completion_tokens??'0'},
    note:'شمارش درخواست‌ها سقف همین برنامه است؛ مصرف و هزینه سرویس بالادستی مستقل است. توکن‌های گزارش‌شده تضمین هزینه نیستند.'};
}
