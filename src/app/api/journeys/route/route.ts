import {planJourney} from '@/lib/journeys/service';
import {readSafeJson,jsonResponse,safeError} from '@/lib/agent/http';
export const runtime='nodejs';
export async function POST(request:Request){try{return jsonResponse(await planJourney(await readSafeJson(request)));}catch(error){return safeError(error,'planJourney');}}
