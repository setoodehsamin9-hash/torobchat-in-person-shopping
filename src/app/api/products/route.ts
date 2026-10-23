import {NextResponse} from 'next/server';
import {searchProducts} from '@/lib/catalog';
import {apiError,readParams,searchSchema} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(request:Request){try{const input=searchSchema.parse(readParams(request));return NextResponse.json(await searchProducts({...input,query:input.query??input.q}));}catch(e){return apiError(e);}}
