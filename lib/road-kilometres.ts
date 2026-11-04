import type { Feature, FeatureCollection, Point } from 'geojson';

export type RoadKilometreProperties = {
  id_km: number;
  km: number;
  fecha_act: string;
  calirepr: string;
  source_feature_id: string;
  source_layer: string;
  road_name: string;
  road_code: string;
  road_source_feature_id: string;
  road_id_red: number;
  road_association_status: string;
  road_association_distance_m: number;
  chainage_origin: null;
  chainage_origin_status: string;
};
export type RoadKilometre = Feature<Point, RoadKilometreProperties>;
export type RoadKilometres = FeatureCollection<Point, RoadKilometreProperties>;

/** Accept only received markers with literal km values and a reviewed road match. */
export function validateRoadKilometres(value: unknown): RoadKilometres {
  const data = value as RoadKilometres | null;
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Kilometraje no válido');
  const ids = new Set<string>();
  for (const feature of data.features) {
    const p = feature.properties, xy = feature.geometry?.coordinates;
    if (feature.geometry?.type !== 'Point' || !Array.isArray(xy) || xy.length !== 2 || !xy.every(Number.isFinite)
      || xy[0] < -90.5 || xy[0] > -89.05 || xy[1] < 20.8 || xy[1] > 21.5
      || !p || !Number.isFinite(p.km) || p.km < 1 || !Number.isInteger(p.id_km)
      || p.source_layer !== 'RNC2025:poste_de_referencia' || p.source_feature_id !== feature.id
      || p.road_association_status !== 'spatially_associated' || !p.road_name || p.road_name === 'N/D'
      || !p.road_source_feature_id || !Number.isInteger(p.road_id_red)
      || !Number.isFinite(p.road_association_distance_m) || p.road_association_distance_m > 25
      || p.chainage_origin !== null || p.chainage_origin_status !== 'not_published_in_source_layer'
      || !/^\d{4}-\d{2}-\d{2}/.test(p.fecha_act) || ids.has(p.source_feature_id)) throw new Error('Poste kilométrico sin procedencia completa');
    ids.add(p.source_feature_id);
  }
  return data;
}

export const ROAD_KILOMETRE_MIN_ZOOM = 13.5;
type ScreenPoint = { x: number; y: number };
/** Both renderers use the same viewport and collision rules, independent of year. */
export function visibleRoadKilometres(data: RoadKilometres, zoom: number, width: number, height: number,
  project: (coordinates: [number, number]) => ScreenPoint, occupied: ScreenPoint[] = []): RoadKilometre[] {
  if (zoom < ROAD_KILOMETRE_MIN_ZOOM) return [];
  const visible: RoadKilometre[] = [], used = [...occupied];
  for (const feature of data.features) {
    const point = project(feature.geometry.coordinates as [number, number]);
    if (point.x < 28 || point.x > width - 28 || point.y < 90 || point.y > height - 100
      || used.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 88)) continue;
    visible.push(feature); used.push(point);
    if (visible.length >= 24) break;
  }
  return visible;
}

export function roadKilometreLabel(feature: RoadKilometre): string {
  return 'km ' + String(feature.properties.km);
}

export function createRoadKilometreButton(feature: RoadKilometre, activate: () => void): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'road-kilometre-label';
  button.textContent = roadKilometreLabel(feature); button.dataset.roadKilometreId = feature.properties.source_feature_id;
  button.setAttribute('aria-label', roadKilometreLabel(feature) + ' · ' + feature.properties.road_name + ' · Ver fuente');
  button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'road-kilometre-explanation');
  button.title = feature.properties.road_name + ' · RNC 2025 · referencia de carretera';
  button.addEventListener('click', event => { event.stopPropagation(); activate(); });
  return button;
}

/** Source strings are rendered as text; a road km is never a coastal distance. */
export function createRoadKilometreExplanation(feature: RoadKilometre, closePopup: () => void): HTMLElement {
  const p = feature.properties, article = document.createElement('article');
  article.id = 'road-kilometre-explanation'; article.className = 'bar-marker-explanation road-kilometre-explanation';
  article.setAttribute('role', 'region'); article.setAttribute('aria-label', roadKilometreLabel(feature) + ' · ' + p.road_name);
  const header = document.createElement('header'), title = document.createElement('h3'), close = document.createElement('button');
  title.textContent = roadKilometreLabel(feature) + ' · carretera'; close.type = 'button'; close.className = 'bar-help-close';
  close.textContent = '×'; close.setAttribute('aria-label', 'Cerrar referencia kilométrica'); close.addEventListener('click', closePopup);
  header.appendChild(title); header.appendChild(close); article.appendChild(header);
  const list = document.createElement('ul');
  for (const text of [
    p.road_name + (p.road_code && !['N/D', 'N/A'].includes(p.road_code) ? ' · carretera ' + p.road_code : '') + '. Asociación por cercanía a la red oficial.',
    'Es una marca de carretera, no distancia de playa.',
    'RNC 2025 · SICT-IMT / INEGI. Registro actualizado el ' + p.fecha_act.slice(0, 10) + '; esta referencia no cambia con el año del mapa.',
  ]) { const item = document.createElement('li'); item.textContent = text; list.appendChild(item); }
  article.appendChild(list);
  const details = document.createElement('details'); details.className = 'bar-help-science';
  const summary = document.createElement('summary'); summary.textContent = 'Procedencia y criterio';
  const technical = document.createElement('p'); technical.textContent = 'Poste ' + p.source_feature_id + ' · id_km ' + p.id_km
    + '. Tramo ' + p.road_source_feature_id + ' · id_red ' + p.road_id_red + '. Asociación espacial derivada a ' + p.road_association_distance_m
    + ' m; no es un vínculo publicado por la fuente. Se conservaron coordenadas, número de kilómetro y fecha originales. Selección del proyecto; INEGI no valida esta asociación.';
  const source = document.createElement('a'); source.href = 'https://rnc.imt.mx/'; source.target = '_blank'; source.rel = 'noreferrer'; source.textContent = 'Consultar RNC del Instituto Mexicano del Transporte';
  details.appendChild(summary); details.appendChild(technical); details.appendChild(source); article.appendChild(details);
  article.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePopup(); } });
  return article;
}
