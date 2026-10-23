import {z} from 'zod';
import {filtersSchema,locationSchema} from '../agent/schemas';
export const journeyInputSchema=z.object({
  productId:z.string().min(1).max(160),offerIds:z.array(z.string().min(1).max(160)).min(1).max(6).refine(v=>new Set(v).size===v.length),
  origin:locationSchema,consent:z.literal(true),travelMode:z.enum(['car','walking']),strategy:z.enum(['nearest','connect']),filters:filtersSchema.default({}),
}).strict();
export type JourneyInput=z.infer<typeof journeyInputSchema>;
export type JourneyStop={offerId:string;shopId:string;name:string;lat:number;lng:number;recordedPriceToman:number|null};
export type JourneyRoute={path:[number,number][];distanceMeters:number;durationSeconds:number;stops:JourneyStop[];ordering:'single_destination'|'straight_line_heuristic';summary:string[]};
export type JourneyResult={status:'ready';source:'neshan';travelMode:JourneyInput['travelMode'];strategy:JourneyInput['strategy'];route:JourneyRoute;scope:string;candidateCount:number;partial:boolean;calculatedAt:string;note:string}|{status:'configuration_required'|'unavailable'|'daily_limit';source:'neshan';message:string};
