import {askBazaar,bazaarAskSchema} from '@/lib/bazaar-ask';
import {findBazaars} from '@/lib/bazaar';
import {jsonResponse,readSafeJson,safeError} from '@/lib/agent/http';
export const runtime='nodejs';
export async function POST(request:Request){
  const started=performance.now();
  try{
    const input=bazaarAskSchema.parse(await readSafeJson(request));
    return jsonResponse(await askBazaar(input,await findBazaars(input.query)));
  }catch(error){return safeError(error,'bazaar_ask',started);}
}
