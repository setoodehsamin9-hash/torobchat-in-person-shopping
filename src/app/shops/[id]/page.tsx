import { ShopScreen } from '@/components/detail-screens';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ShopScreen id={id}/>;}
