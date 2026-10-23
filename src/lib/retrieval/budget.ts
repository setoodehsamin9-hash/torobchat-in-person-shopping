import { AsyncLocalStorage } from 'node:async_hooks';
const turns=new AsyncLocalStorage<{remaining:number}>();
export function withEmbeddingBudget<T>(maximum:number,work:()=>Promise<T>){return turns.run({remaining:maximum},work);}
export function consumeEmbeddingBudget(){const turn=turns.getStore();if(!turn)return;if(turn.remaining<=0)throw new Error('embedding_turn_limit');turn.remaining--;}
