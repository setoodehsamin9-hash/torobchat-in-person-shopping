/** Public contact contracts. Never include phone numbers, registry entries or secrets. */
export type ContactMode = 'simulation' | 'live';
export type ContactChannel = 'voice' | 'sms';
export type ContactStatus = 'queued' | 'dialing' | 'sending' | 'waiting' | 'completed' | 'unanswered' | 'cancelled' | 'dispatch_uncertain' | 'failed';
export type ContactQuoteRequest = {offerId:string; channel:ContactChannel; mode:ContactMode};
export type ContactQuote = {id:string;offerId:string;shopId:string;productId:string;channel:ContactChannel;mode:ContactMode;maxCostToman:number|null;expiresAt:string;available:boolean;unavailableReason:string|null;disclosure:string};
export type ContactJobRequest = {quoteId:string;approved:boolean;approvedMaxCostToman:number;idempotencyKey:string};
export type ContactEvent = {status:ContactStatus;at:string;message:string};
export type ContactResult = {outcome:'available'|'not_available'|'unanswered'|'price_changed'|'unknown';reportedPriceToman:number|null;source:'simulation'|'gateway_report';verificationStatus:'simulated'|'unknown';reportedAt:string};
export type ContactJob = {id:string;offerId:string;shopId:string;productId:string;channel:ContactChannel;mode:ContactMode;status:ContactStatus;maxCostToman:number;chargedCostToman:number;createdAt:string;updatedAt:string;events:ContactEvent[];result:ContactResult|null;disclosure:string};
export type ContactJobsResponse = {jobs:ContactJob[]};
export type ContactGatewayCallback = {eventId:string;jobId:string;status:'dialing'|'sending'|'waiting'|'completed'|'unanswered'|'failed';chargedCostToman:number;result?:{outcome:ContactResult['outcome'];reportedPriceToman:number|null}};
