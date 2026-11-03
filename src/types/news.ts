export interface EconomicEvent {
 id:string; dateUtc:string; event:string; category:string; country:string; countryCode:string|null;
 currency:string; impact:3; previous:string|null; forecast:string|null; actual:string|null;
 reference:string|null; providerUpdatedAt:string|null;
}
export interface EconomicCalendarResponse {
 events:EconomicEvent[]; status:'ok'|'stale'; timezone:string; checkedAt:string;
 fetchedAt:string; providerUpdatedAt:string|null;
}
