import type {UIBlock} from './contracts';
import {RecommendationWindow} from './agent/result-window';

/** Apply the current presentation policy to local history as well as new turns.
 * Legacy retrieval panels are internal candidates, never recommendations.
 */
export function visibleChatBlocks(blocks:UIBlock[]):UIBlock[]{
 const withoutSeeds=blocks.filter(block=>block.type!=='products'||!block.title.startsWith('گزینه‌های بازیابی‌شده از دیتاست'));
 const hasSellers=withoutSeeds.some(block=>block.type==='offers'||block.type==='store_discovery'||block.type==='alternatives'||block.type==='product_comparison'||block.type==='offer_comparison');
 return new RecommendationWindow().apply(hasSellers?withoutSeeds.filter(block=>block.type!=='products'):withoutSeeds);
}
