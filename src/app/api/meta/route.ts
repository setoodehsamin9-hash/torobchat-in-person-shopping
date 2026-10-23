import {NextResponse} from 'next/server';
import {getCategories,getRegions,getCounts} from '@/lib/catalog';
import {apiError} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(){try{const [categories,regions,counts]=await Promise.all([getCategories(),getRegions(),getCounts()]);return NextResponse.json({categories,regions,counts});}catch(e){return apiError(e);}}
