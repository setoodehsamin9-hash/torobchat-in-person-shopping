import {NextResponse} from 'next/server';
import {searchShops} from '@/lib/catalog';
import {apiError,readParams,searchSchema} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(request:Request){try{const v=searchSchema.parse(readParams(request));return NextResponse.json(await searchShops(v.query??v.q??'',v.page,v.limit));}catch(e){return apiError(e);}}
