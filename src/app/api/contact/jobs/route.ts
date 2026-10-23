import {readSafeJson,jsonResponse,safeError} from '@/lib/agent/http';
import {contactService} from '@/lib/contact/config';
import {contactOwner} from '@/lib/contact/http';
export const runtime='nodejs';
export async function GET(request:Request){try{const owner=contactOwner(request);return jsonResponse({jobs:await(await contactService()).list(owner)});}catch(error){return safeError(error,'contactJobs');}}
export async function POST(request:Request){try{const owner=contactOwner(request),body=await readSafeJson(request);return jsonResponse(await(await contactService()).create(owner,body),201);}catch(error){return safeError(error,'contactCreate');}}
