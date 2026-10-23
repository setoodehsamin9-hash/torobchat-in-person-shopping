import { afterEach,describe,expect,it,vi } from 'vitest';
import { embeddingConfig,decodeEmbeddings,productDocument,reciprocalRankFusion } from '../src/lib/retrieval/core';

afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('embedding boundaries',()=>{
  it('keeps embedding credentials separate from the LLM and selects the requested OpenAI model',()=>{
    const c=embeddingConfig({AI_API_KEY:'llm-secret'});expect(c.configured).toBe(false);expect(c.model).toBe('text-embedding-3-small');expect(c.dimensions).toBe(1536);expect(c.base.href).toBe('https://ai.boxapi.ir/ai/v1');
    expect(embeddingConfig({EMBEDDING_MODEL:'text-embedding-3-large'}).dimensions).toBe(3072);
  });
  it('rejects unsafe endpoints and invalid dimensions instead of guessing',()=>{
    expect(()=>embeddingConfig({EMBEDDING_BASE_URL:['https://user','secret@example.com/v1'].join(':')})).toThrow();
    expect(()=>embeddingConfig({EMBEDDING_BASE_URL:'http://example.com/v1'})).toThrow();
    expect(()=>embeddingConfig({EMBEDDING_DIMENSIONS:'4096'})).toThrow();
  });
  it('restores out-of-order API results to the matching input products',()=>{
    expect(decodeEmbeddings({data:[{index:1,embedding:[0,2]},{index:0,embedding:[3,0]}]},2,2)).toEqual([[1,0],[0,1]]);
    expect(()=>decodeEmbeddings({data:[{index:0,embedding:[1,0]},{index:0,embedding:[0,1]}]},2,2)).toThrow();
    expect(()=>decodeEmbeddings({data:[{index:0,embedding:[Infinity,0]}]},1,2)).toThrow();
    expect(()=>decodeEmbeddings({data:[{index:0,embedding:[0,0]}]},1,2)).toThrow();
    expect(()=>decodeEmbeddings({data:[{index:0,embedding:[1,0,0]}]},1,2)).toThrow();
  });
  it('documents real specs but leaves changing prices, shop contacts and inventory out of vector text',()=>{
    const p={product_id:'p1',persian_title:'هدفون',model:'R50i',brand_name:'Anker',category_name:'هدفون',specs:[{key:'رابط',value:'بلوتوث'}],min_price_toman:123456,max_price_toman:999999,offer_count:2,image_urls:[]};
    const d=productDocument(p);expect(d.text).toContain('بلوتوث');expect(d.text).not.toContain('123456');expect(d.text).not.toContain('999999');const changedPrice={...p,min_price_toman:5};expect(d.hash).toBe(productDocument(changedPrice).hash);
    expect(Buffer.byteLength(productDocument({...p,specs:[{key:'شرح',value:'بلند'.repeat(5000)}]}).text)).toBeLessThanOrEqual(2400);
  });
  it('fuses lexical and semantic ranks without duplicates and keeps exact matches influential',()=>{
    const r=reciprocalRankFusion(['exact','shared'],['shared','meaning']);expect(r[0]).toBe('shared');expect(new Set(r).size).toBe(3);expect(r.indexOf('exact')).toBeLessThan(r.indexOf('meaning'));
  });
});
