import {describe,it,expect} from 'vitest';
import {visibleChatBlocks} from '../src/lib/chat-presentation';
import type {UIBlock} from '../src/lib/contracts';

describe('stored chat presentation migration',()=>{
 it('removes legacy unsolicited retrieval panels without deleting explicit comparison cards',()=>{
  const blocks:UIBlock[]=[{type:'products',title:'گزینه‌های بازیابی‌شده از دیتاست؛ انتخاب نهایی با شماست',products:[]},{type:'product_comparison',products:[]}];
  expect(visibleChatBlocks(blocks)).toEqual([blocks[1]]);
 });
});

it('keeps alternatives instead of internal product candidates, including similar-only alternatives',()=>{
 const product={product_id:'p1',persian_title:null,brand_name:null,category_name:null,model:null,image_urls:[],specs:[],min_price_toman:null,max_price_toman:null,offer_count:0};
 const alternative:UIBlock={type:'alternatives',product,same_product:[],similar_products:[{...product,product_id:'p2'}],explanation:'ثبت‌شده'};
 expect(visibleChatBlocks([{type:'products',title:'داخلی',products:[product]},alternative])).toEqual([alternative]);
});

it('keeps only the final seller panel when discovery finds no matching offers',()=>{
 const product={product_id:'p1',persian_title:null,brand_name:null,category_name:null,model:null,image_urls:[],specs:[],min_price_toman:null,max_price_toman:null,offer_count:0};
 const final:UIBlock={type:'store_discovery',title:'نتیجه نهایی',query:'کفش',matches:[],limited:true};
 expect(visibleChatBlocks([{type:'products',title:'نامزد داخلی',products:[product]},final])).toEqual([final]);
});
