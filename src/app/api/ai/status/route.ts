import { agentStatus } from '@/lib/agent/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{return Response.json(await agentStatus(),{headers:{'cache-control':'no-store'}});}
 catch{return Response.json({error:'وضعیت سرویس مدل در دسترس نیست.'},{status:503});}
}
