import type { StudyFlight } from './study-flight';
export type HistoricalBackground = StudyFlight & { year:number; product_id:string; image_kind:'rgb'|'green_band'; image_sha256:string };
export type HistoricalBackgroundManifest = { schema_version:1; frames:HistoricalBackground[]; missing_years:number[]; limits:string };
export function validateHistoricalBackgroundManifest(input:unknown):HistoricalBackgroundManifest {
  const data=input as HistoricalBackgroundManifest;
  if(data?.schema_version!==1||!Array.isArray(data.frames)||!Array.isArray(data.missing_years))throw new Error('Archivo histórico inválido');
  const years=new Set<number>();
  for(const frame of data.frames){
    if(!Number.isInteger(frame.year)||years.has(frame.year)||!frame.date?.startsWith(String(frame.year)+'-')||!Number.isFinite(Date.parse(frame.date))||
      !frame.image?.startsWith('/data/historical-background/frames/')||!frame.bounds?.every(Number.isFinite)||frame.bounds.length!==4||frame.bounds[0]>=frame.bounds[2]||frame.bounds[1]>=frame.bounds[3]||
      !['rgb','green_band'].includes(frame.image_kind)||!/^[a-f0-9]{64}$/.test(frame.image_sha256))throw new Error('Imagen histórica sin fecha o cobertura válida');
    years.add(frame.year);
  }
  return data;
}
export function exactHistoricalBackground(manifest:HistoricalBackgroundManifest|null,year:number) {
  return manifest?.frames.find(frame=>frame.year===year)??null;
}
// Explicitly labelled earlier reference; never a future capture or a new year.
export function earlierHistoricalReference(manifest:HistoricalBackgroundManifest|null,year:number) {
  return manifest?.frames.filter(frame=>frame.year<year).sort((a,b)=>b.date.localeCompare(a.date))[0]??null;
}
export function inBackgroundCoverage(frame:HistoricalBackground,point:[number,number]|null) {
  if(!point)return true;
  const [w,s,e,n]=frame.bounds;
  return point[0]>=w&&point[0]<=e&&point[1]>=s&&point[1]<=n;
}
