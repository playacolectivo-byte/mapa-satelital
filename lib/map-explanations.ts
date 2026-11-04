import type { EvidenceSelection } from './map-evidence';
import { isMangroveChange, type DatedMangroveComparison } from './mangrove-history';
import { publishedValues, researchSeries, type ErosionFeature, type ResearchSeries } from './problems';
import type { TransectPair } from './transect-pairs';

type ExplanationPoint = { label: string; text: string };
export type ExplanationPoints =
  | readonly [ExplanationPoint]
  | readonly [ExplanationPoint, ExplanationPoint]
  | readonly [ExplanationPoint, ExplanationPoint, ExplanationPoint];

const number = (value: number, digits = 2) => value.toLocaleString('es-MX', {
  maximumFractionDigits: digits,
});
// Keep small patches visible as non-zero areas without suggesting survey precision.
export const areaLabel = (hectares: number) =>
  `${number(hectares / 100, 4)} km² (${number(hectares, 2)} ha)`;
export function simpleDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return months[month - 1] ? `${day} de ${months[month - 1]} de ${year}` : null;
}

export function erosionExplanation(
  feature: ErosionFeature,
  _captureYear: number | null,
): ExplanationPoints {
  const p = feature.properties;
  const period = researchSeries.find((series) => series.id === p.series)!;
  const colors = p.category === 'Erosión Alta' ? 'Rojo: erosión alta.'
    : p.category === 'Erosión Baja' ? 'Amarillo: erosión baja.'
      : p.category === 'Estable' ? 'Gris: costa estable según el estudio.'
        : 'Turquesa: acumulación de arena según el estudio.';
  const change = p.rate < 0 ? `retroceso promedio de ${number(Math.abs(p.rate))} metros por año`
    : p.rate > 0 ? `avance promedio de ${number(p.rate)} metros por año`
      : 'cambio promedio de 0 metros por año';
  return [
    { label: 'Qué ves.', text: `${colors} La línea ubica el sitio; su largo no representa playa perdida.` },
    { label: 'Resultado.', text: `${period.period}: ${change}.` },
  ];
}

export function erosionBarExplanation(feature: ErosionFeature, series: ResearchSeries, captureYear: number | null): ExplanationPoints {
  const value = publishedValues(feature, series);
  if (value) return erosionExplanation({ ...feature, properties: { ...feature.properties, series, rate: value.rate, category: value.category } }, captureYear);
  const period = researchSeries.find((entry) => entry.id === series)!;
  return [
    { label: 'Esta barra.', text: 'La línea ubica un eje original de medición. La llave indica su frente de referencia gráfica.' },
    { label: 'Periodo.', text: `${period.period}: sin dato publicado para este eje. No se asigna cero ni se reutiliza una cifra de otro periodo.` },
    { label: 'Alcance.', text: 'El frente ayuda a leer el mapa; no añade mediciones al espacio entre ejes ni demuestra que la playa esté estable.' },
  ];
}

export function erosionPairExplanation(pair: TransectPair<ErosionFeature>, series: ResearchSeries, captureYear: number | null): ExplanationPoints {
  const period = researchSeries.find((entry) => entry.id === series)!;
  const point = (feature: ErosionFeature, label: string) => {
    const value = publishedValues(feature, series);
    return { label, text: !value ? 'Sin dato publicado para esta barra en el periodo elegido.'
      : value.category === 'Estable' ? `Cambio medio de ${number(Math.abs(value.rate))} m/año${value.rate < 0 ? ' hacia tierra' : value.rate > 0 ? ' hacia el mar' : ''}. El estudio lo clasifica como estable.`
        : `${value.rate < 0 ? 'Retroceso' : value.rate > 0 ? 'Avance' : 'Cambio'} medio de ${number(Math.abs(value.rate))} m/año. ${value.category.replace('Acreción', 'Acumulación')}.` };
  };
  const years = period.period.split('–').map(Number);
  const outside = captureYear !== null && (captureYear < years[0] || captureYear > years[1]);
  return [
    point(pair.a, 'Barra A.'),
    point(pair.b, 'Barra B.'),
    { label: 'Fecha y alcance.', text: `Alec et al. · ${period.period}. Son promedios del intervalo en los extremos; no hay medición continua del interior.${outside ? ` Referencia de otros años para la imagen de ${captureYear}.` : ''}` },
  ];
}

export function evidenceExplanation(
  selection: EvidenceSelection,
  comparison: DatedMangroveComparison | null,
  captureYear: number | null,
): ExplanationPoints {
  const p = selection.feature.properties;
  if (isMangroveChange(selection.feature)) {
    const same = comparison && comparison.year === p.year && comparison.previous_year === p.previous_year ? comparison : null;
    const loss = p.change === 'loss';
    return [
      { label: 'Qué pasó aquí.', text: loss
        ? 'Rojo: el mapa estima que esta zona perdió cobertura de manglar.'
        : 'Turquesa: el mapa estima que esta zona ganó cobertura de manglar.' },
      { label: 'Años y superficie.', text: `${p.previous_year} → ${p.year}: ${loss ? 'pérdida' : 'ganancia'} estimada de ${areaLabel(Number(p.area_ha))} sólo en la zona que elegiste.${same?.reference ? ` Es una referencia de otros años para la imagen de ${captureYear}.` : ''}` },
      { label: 'Cómo entenderlo.', text: loss
        ? 'La estimación usa cuadros de unos 30 × 30 m. No demuestra que talaron árboles ni explica la causa de esta pérdida.'
        : 'La estimación usa cuadros de unos 30 × 30 m. No confirma que plantaron árboles ni que esta zona fue restaurada.' },
    ];
  }
  if (selection.kind === 'geotubes') {
    const date = simpleDate(p.temporal_date);
    const dated = date && (p.temporal_state === 'present' || p.temporal_state === 'deflated');
    return [
      { label: 'Qué ves.', text: 'Un geotubo es un tubo de tela que se llena de arena. La línea naranja señala su ubicación histórica; no dibuja su ancho real.' },
      { label: 'Años y estado.', text: dated
        ? `${date}: el estudio lo reportó ${p.temporal_state === 'deflated' ? 'desinflado. Eso no significa que se retiró todo el material' : 'presente'}.`
        : `El estudio documenta obras de 2017–2018. No tenemos su estado confirmado${captureYear === null ? ' para esta imagen' : ` para ${captureYear}`}.` },
      { label: 'Qué significa.', text: 'Sirve para ubicar la obra estudiada. Este trazo no confirma su estado actual ni demuestra que causó erosión.' },
    ];
  }
  if (selection.kind === 'barriers') {
    const observed = simpleDate(p.temporal_date);
    const date = simpleDate(p.osm_timestamp);
    return [
      { label: 'Qué ves.', text: 'El trazo morado señala una obra costera en OpenStreetMap. Un contorno muestra la forma dibujada; una línea no indica el ancho.' },
      { label: 'Fecha.', text: p.temporal_state === 'present' && observed
        ? `Presencia registrada el ${observed}. Esa fecha no indica cuándo se construyó.`
        : `${date ? `Trazo editado el ${date}.` : 'No tenemos una fecha de construcción.'} La fecha del mapa no confirma su presencia en el año de la imagen.` },
      { label: 'Qué significa.', text: 'Ayuda a localizar la obra. El trazo por sí solo no demuestra daño a la playa ni quién lo causó.' },
    ];
  }
  return [
    { label: 'Qué ves.', text: 'CONABIO marcó esta zona como manglar perturbado: manglar con alteraciones.' },
    { label: 'Año.', text: 'Se usaron imágenes de enero a mayo de 2020. Es un mapa regional, no una revisión de cada árbol ni del estado de hoy.' },
    { label: 'Qué significa.', text: 'La alteración puede tener causas naturales o humanas. Esta capa no demuestra tala ni identifica a un responsable.' },
  ];
}
