import {readSafeJson,jsonResponse,safeError} from '@/lib/agent/http';
import {contactService} from '@/lib/contact/config';
import {contactOwner} from '@/lib/contact/http';
import {z} from 'zod';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const owner=contactOwner(request);z.object({}).strict().parse(await readSafeJson(request));const{id}=await context.params;return jsonResponse(await(await contactService()).cancel(owner,id));}catch(error){return safeError(error,'contactCancel');}}
