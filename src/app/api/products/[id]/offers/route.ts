import {NextResponse} from 'next/server';
import {getProductOffers} from '@/lib/catalog';
import {apiError,idSchema,offerSchema,readParams} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;idSchema.parse(id);return NextResponse.json(await getProductOffers(id,offerSchema.parse(readParams(request))));}catch(e){return apiError(e);}}
