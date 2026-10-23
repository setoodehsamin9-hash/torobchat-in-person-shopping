import type { EnrichedOffer, Product, UIBlock } from '../contracts';

/** Presentation budget for one assistant turn, shared across tool calls.
 * Inputs must already be validated tool results. This only selects existing
 * records; it cannot establish provenance or replace the database boundary.
 * Internal retrieval candidates should not enter this presentation window.
 */
export class RecommendationWindow {
  private count=0;
  private readonly products=new Set<string>();
  private readonly shops=new Set<string>();
  private readonly offers=new Set<string>();

  private takeProduct(product:Product):boolean{
    if(this.count>=5||this.products.has(product.product_id))return false;
    this.products.add(product.product_id);this.count++;return true;
  }

  private takeOffer(product:Product,offer:EnrichedOffer):boolean{
    if(this.count>=5||offer.product_id!==product.product_id||offer.shop_id!==offer.shop.shop_id||this.shops.has(offer.shop_id)||this.offers.has(offer.offer_id))return false;
    this.products.add(product.product_id);this.shops.add(offer.shop_id);this.offers.add(offer.offer_id);this.count++;return true;
  }

  apply(blocks:UIBlock[]):UIBlock[]{
    return blocks.flatMap((block):UIBlock[]=>{
      switch(block.type){
        case 'products':{
          const products=block.products.filter(product=>this.takeProduct(product));
          return !products.length&&block.products.length?[]:[{...block,products}];
        }
        case 'offers':{
          const offers=block.offers.filter(offer=>this.takeOffer(block.product,offer));
          return !offers.length&&block.offers.length?[]:[{...block,offers}];
        }
        case 'store_discovery':{
          const matches=block.matches.filter(match=>this.takeOffer(match.product,match.offer));
          return !matches.length&&block.matches.length?[]:[{...block,matches}];
        }
        case 'alternatives':{
          const same_product=block.same_product.filter(offer=>this.takeOffer(block.product,offer));
          const similar_products=block.similar_products.filter(product=>this.takeProduct(product));
          return !same_product.length&&!similar_products.length&&(block.same_product.length||block.similar_products.length)?[]:[{...block,same_product,similar_products}];
        }
        default:return [block];
      }
    });
  }
}
