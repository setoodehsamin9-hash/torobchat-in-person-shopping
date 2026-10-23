import { orchestrateChat } from '../../../lib/agent/orchestrator';
import { readSafeJson, jsonResponse, safeError } from '../../../lib/agent/http';
import {chatInputSchema} from '../../../lib/agent/schemas';
import {createChatStream} from '../../../lib/chat-stream';
export const runtime='nodejs';
export async function POST(request:Request){
  const started=performance.now();
  try{
    const input=chatInputSchema.parse(await readSafeJson(request));
    if(request.headers.get('accept')?.includes('application/x-ndjson'))return createChatStream((emit,signal)=>orchestrateChat(input,undefined,signal,emit),request.signal);
    return jsonResponse(await orchestrateChat(input,undefined,request.signal));
  }catch(error){return safeError(error,'chat',started);}
}
