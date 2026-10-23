import {jsonResponse,safeError} from '@/lib/agent/http';
import {contactService} from '@/lib/contact/config';
import {contactOwner} from '@/lib/contact/http';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const owner=contactOwner(request),{id}=await context.params;return jsonResponse(await(await contactService()).get(owner,id));}catch(error){return safeError(error,'contactJob');}}
