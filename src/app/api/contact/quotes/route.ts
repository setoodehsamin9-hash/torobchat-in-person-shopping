import {readSafeJson,jsonResponse,safeError} from '@/lib/agent/http';
import {contactService} from '@/lib/contact/config';
import {contactOwner} from '@/lib/contact/http';
export const runtime='nodejs';
export async function POST(request:Request){try{const owner=contactOwner(request),body=await readSafeJson(request);return jsonResponse(await(await contactService()).quote(owner,body));}catch(error){return safeError(error,'contactQuote');}}
