import type { UIBlock } from './contracts';
export function conversationContext(messages:{role:'user'|'assistant';text:string;blocks?:UIBlock[]}[]) {
  const products=new Map<string,{product_id:string;title:string}>();
  const offers=new Map<string,{offer_id:string;product_id:string;shop_id:string}>();
  for(const message of messages.slice(-6)){
    if(message.blocks?.some(b=>b.type==='products'||b.type==='product_comparison'||b.type==='offers'||b.type==='alternatives'||b.type==='store_discovery'))products.clear();
    for(const b of message.blocks??[]){
    const items=b.type==='store_discovery'?b.matches.map(m=>m.product):b.type==='products'||b.type==='product_comparison'?b.products:'product'in b?[b.product]:[];
    items.forEach(p=>products.set(p.product_id,{product_id:p.product_id,title:(p.persian_title??p.model??'نامشخص').slice(0,200)}));
    const entries=b.type==='store_discovery'?b.matches.map(m=>m.offer):b.type==='offers'||b.type==='offer_comparison'||b.type==='visit_plan'?b.offers:b.type==='alternatives'?b.same_product:[];
    entries.forEach(o=>offers.set(o.offer_id,{offer_id:o.offer_id,product_id:o.product_id,shop_id:o.shop_id}));
    if(b.type==='alternatives')b.similar_products.forEach(p=>products.set(p.product_id,{product_id:p.product_id,title:(p.persian_title??p.model??'نامشخص').slice(0,200)}));
  }
  }
  return {history:messages.slice(-6).map(m=>({role:m.role,text:m.text.slice(0,800)})),context:{products:[...products.values()].slice(-12),offers:[...offers.values()].slice(-20)}};
}
