import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {projectPlaceLabel} from './project-coast-labels';

export type ThemeId = 'coast' | 'localities' | 'mangrove' | 'wetlands' | 'water';
export type TerritoryFeature = Feature<Geometry, Record<string, unknown>>;
export type TerritoryData = Record<ThemeId | 'context', FeatureCollection<Geometry, Record<string, unknown>>>;
export type Visibility = Record<ThemeId, boolean>;
export type Place = { id: string; name: string; coordinates: [number, number]; bounds: [number, number, number, number]; population: string; cvegeo: string; municipality?:string; minZoom?:number; source_url?:string };
export type MapConfig = { municipality_scope?:string; neighbour_places?:Place[]; focus_bounds: [number, number, number, number]; operational_bounds: [number, number, number, number]; overview_bounds: [number, number, number, number]; navigation_bounds: [number, number, number, number]; places: Place[]; prepared_on: string };
export type Source = { ID: string; Nombre: string; Institución: string; URL: string; Fecha: string; Actualización: string; CRS: string; Resolución: string; Licencia: string; Limitaciones: string; Tipo: string; Formato: string; Cobertura: string; Consulta: string; Enlaces_adicionales?: string[] };
export const themes: { id: ThemeId; title: string; source: string; date: string; color: string; description: string; limitation: string }[] = [
  { id: 'coast', title: 'Costa de referencia', source: 'S01', date: 'INEGI · 2025', color: '#edc68b', description: 'El contacto costero publicado por INEGI, a partir de insumos de 2023–2025.', limitation: 'Una referencia cartográfica. No representa una serie de erosión.' },
  { id: 'localities', title: 'Localidades', source: 'S02', date: 'INEGI · Marco 2025', color: '#c0cbce', description: 'Chelem, Chuburná y Progreso en el Marco Geoestadístico.', limitation: 'Límites geoestadísticos; no son predios ni deslindes jurídicos.' },
  { id: 'mangrove', title: 'Manglar', source: 'S12', date: 'CONABIO · 2020', color: '#56a88f', description: 'La cobertura de manglar documentada para 2020.', limitation: 'Escala 1:50,000. No certifica presencia o ausencia actual en un predio.' },
  { id: 'wetlands', title: 'Otros humedales', source: 'S13 · Clase 7', date: 'CONABIO · 2020', color: '#b2ad72', description: 'Otros humedales de la zona costera asociada al manglar.', limitation: 'No es un inventario universal de humedales ni una capa de inundación.' },
  { id: 'water', title: 'Cuerpos de agua', source: 'S13 · Clase 8', date: 'CONABIO · 2020', color: '#5aafc9', description: 'Cuerpos de agua identificados en el mismo estudio de coberturas.', limitation: 'La selección no garantiza cobertura completa de la laguna ni define una zona marina.' },
];
export const allVisible: Visibility = { coast: true, localities: true, mangrove: true, wetlands: true, water: true };
export const disclaimer = 'Este prototipo integra información pública disponible con fines de exploración, comunicación y diseño de una futura plataforma territorial. La delimitación de la Celda Chelem, las unidades internas y cualquier interpretación derivada deberán ser revisadas y validadas por especialistas en dinámica litoral y por las instancias correspondientes del Colectivo por la Costa.';
export function featureName(f: TerritoryFeature): string {
  const id = f.properties.theme as ThemeId;
  return id === 'localities' && typeof f.properties.name === 'string' ? projectPlaceLabel(f.properties.name) : themes.find(t => t.id === id)?.title ?? 'Elemento territorial';
}
