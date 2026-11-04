export type RoadSearchRecord={id:string;road:string;km:number;coordinate:[number,number];kind:'official'|'interpolated';sources:string[];method?:string};
export function parseRoadKilometre(value:string):number|null{
 const normalized=value.trim().replace(/^km\s*/i,'').replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(normalized))return null;
 const n=Number(normalized);return Number.isFinite(n)&&n>=0&&Number.isInteger(n*2)?n:null;
}
export function findRoadKilometre(records:RoadSearchRecord[],road:string,value:string):RoadSearchRecord|null{
 const km=parseRoadKilometre(value);return km===null?null:records.find(r=>r.road===road&&r.km===km)??null;
}
