'use client';

import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Source, type TerritoryFeature, type ThemeId } from '@/lib/territory';
import { populationLabel } from '@/lib/view';
import { ExplanationPoints } from './explanation-points';
import type { ExplanationPoints as Points } from '@/lib/map-explanations';
const scalarText=(value:unknown,fallback:string)=>typeof value==='string' || typeof value==='number'?String(value):fallback;

export function FeatureDetails({ feature, source, onEvidence }: { feature: TerritoryFeature; source?: Source; onEvidence: (id: string) => void }) {
  const p = feature.properties;
  const points: Record<ThemeId, Points> = {
    coast: [
      { label: 'Qué ves.', text: 'La línea de costa publicada por INEGI: una referencia para ubicar dónde termina la tierra y empieza el mar.' },
      { label: 'Años.', text: 'La edición es de 2025 y usa información de 2023–2025.' },
      { label: 'Qué significa.', text: 'Ayuda a orientarte. Esta línea sola no muestra cuánto avanzó o retrocedió la playa.' },
    ],
    localities: [
      { label: 'Qué ves.', text: scalarText(p.name, 'Localidad') + ': un área del mapa de INEGI, no el límite de una propiedad.' },
      { label: 'Población.', text: populationLabel(p.population_2020) + ' habitantes según el Censo 2020.' },
      { label: 'Año del mapa.', text: 'Marco de 2025. No fija límites legales de predios ni demuestra su situación actual.' },
    ],
    mangrove: [
      { label: 'Qué ves.', text: 'Zonas que CONABIO identificó como manglar.' },
      { label: 'Año.', text: '2020. Esta capa muestra la cobertura de ese año, no los cambios entre años.' },
      { label: 'Qué significa.', text: 'Es una referencia regional. No confirma si hoy hay manglar en cada propiedad ni dónde termina cada árbol.' },
    ],
    wetlands: [
      { label: 'Qué ves.', text: 'Otros humedales: zonas húmedas de la costa cercanas al manglar.' },
      { label: 'Año.', text: 'CONABIO, 2020.' },
      { label: 'Qué significa.', text: 'Esta selección no incluye todos los humedales ni señala qué lugares se van a inundar.' },
    ],
    water: [
      { label: 'Qué ves.', text: 'Zonas que el estudio identificó como cuerpos de agua.' },
      { label: 'Año.', text: 'CONABIO, 2020.' },
      { label: 'Qué significa.', text: 'Ayuda a ubicar el agua registrada. No representa toda la laguna ni delimita la zona marina.' },
    ],
  };
  return <>
    <ExplanationPoints points={points[p.theme as ThemeId] ?? [
      { label: 'Qué ves.', text: 'Un elemento de la cartografía recibida.' },
      { label: 'Fecha.', text: scalarText(p.date, 'Sin fecha disponible') + '.' },
      { label: 'Fuente.', text: source?.Institución ?? 'Consulta el registro original para conocer su alcance.' },
    ]} />
    <Button className="source-button" onClick={() => onEvidence(String(p.source_id))}>Ver fuente <ArrowUpRight /></Button>
    {source && <a className="text-link" href={source.URL} target="_blank" rel="noreferrer">Abrir fuente original <ArrowUpRight /></a>}
  </>;
}
