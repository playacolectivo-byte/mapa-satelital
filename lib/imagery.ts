export type ImageryPlace = 'chelem' | 'chuburna' | 'progreso' | 'yucalpeten';
export type ImageryRecord = { id: ImageryPlace; name: string; coordinates: [number, number]; capture: string; sensor: string; source: string; resolution: string; accuracy: string; release: string };
export const imagery: Record<ImageryPlace, ImageryRecord> = {
  chelem: { id:'chelem', name:'Chelem', coordinates:[-89.7429508,21.275], capture:'13 feb 2025', sensor:'WorldView-3', source:'Vantor', resolution:'0.31 m', accuracy:'5 m', release:'Raster Basemaps 2026.R07' },
  chuburna: { id:'chuburna', name:'Chuburná', coordinates:[-89.8162,21.257], capture:'23 mar 2025', sensor:'WorldView-3', source:'Vantor', resolution:'0.31 m', accuracy:'5 m', release:'Raster Basemaps 2026.R07' },
  progreso: { id:'progreso', name:'Progreso', coordinates:[-89.6636,21.288], capture:'14 abr 2025', sensor:'GeoEye-2', source:'Vantor', resolution:'0.34 m', accuracy:'5 m', release:'Raster Basemaps 2026.R07' },
  yucalpeten: { id:'yucalpeten', name:'Yucalpetén', coordinates:[-89.721,21.285], capture:'21 sep 2023', sensor:'WorldView-2', source:'Vantor', resolution:'0.5 m', accuracy:'5 m', release:'Raster Basemaps 2026.R07' },
};
export const imageryService = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
export function closestImagery([lon,lat]:[number,number]): ImageryRecord {
  return Object.values(imagery).reduce((a,b)=>(lon-b.coordinates[0])**2+(lat-b.coordinates[1])**2 < (lon-a.coordinates[0])**2+(lat-a.coordinates[1])**2 ? b:a);
}
