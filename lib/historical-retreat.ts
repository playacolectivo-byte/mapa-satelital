import records from './generated/historical-retreat-rates.json' with {type:'json'};
export type HistoricalRate={id:string;label:string;first:number;last:number;minimumRate:number;maximumRate:number;sourceUrl:string;sourcePages:string;geometry:null;statisticalUncertaintyKnown:boolean;eligibleAsObservedBar:boolean;allowLinearScenario?:boolean;structuralBreakYear?:number};
export const historicalRates=records as HistoricalRate[];
/** A regional constant-rate scenario, not a measured annual shoreline. Never
 * extrapolate beyond the period actually reported by the historical source. */
export function historicalRetreat(rate:HistoricalRate,year:number){
 if(!Number.isInteger(year)||year<rate.first||year>rate.last)return null;
 if(rate.allowLinearScenario===false&&year!==rate.last)return null;
 const years=year-rate.first;
 return {years,minimum:Math.round(rate.minimumRate*years*100)/100,maximum:Math.round(rate.maximumRate*years*100)/100};
}
