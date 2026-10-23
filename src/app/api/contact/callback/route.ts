import {readSafeJson,jsonResponse,safeError} from '@/lib/agent/http';
import {contactService} from '@/lib/contact/config';
import {callbackSecret} from '@/lib/contact/http';
import {handleCallback} from '@/lib/contact/gateway';
export const runtime='nodejs';
export async function POST(request:Request){try{const secret=callbackSecret(request),body=await readSafeJson(request);await handleCallback(await contactService(),secret,body);return jsonResponse({accepted:true});}catch(error){return safeError(error,'contactCallback');}}
