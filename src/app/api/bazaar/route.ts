import {NextResponse} from 'next/server';
import {z} from 'zod';
import {findBazaars} from '@/lib/bazaar';
import {apiError,readParams} from '@/lib/db/api';
export const runtime='nodejs';
const schema=z.object({q:z.string().trim().min(2).max(120)});
export async function GET(request:Request){try{const {q}=schema.parse(readParams(request));return NextResponse.json(await findBazaars(q));}catch(e){return apiError(e);}}
