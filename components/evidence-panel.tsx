'use client';

import { ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { type Source } from '@/lib/territory';
import { SatelliteMedia } from './satellite-media';
import { S34_URL, AUTHORS_KMZ, GEOTUBE_URL } from '@/lib/problems';
import { STRUCTURES_ARTICLE, STRUCTURES_REPOSITORY } from '@/lib/coastal-structures';
import { GMW_SOURCE } from '@/lib/mangrove-history';
import type { ExplanationPoints as Points } from '@/lib/map-explanations';
import { ExplanationPoints } from './explanation-points';

function SourceEntry({ title, credit, points, children }: { title: string; credit: string; points: Points; children?: ReactNode }) {
  return <details className="source-entry">
    <summary><span className="source-kicker">{credit}</span><span className="source-name">{title}</span></summary>
    <div className="source-content"><ExplanationPoints points={points} />{children}</div>
  </details>;
}

export function EvidencePanel({ sources, focus, state, onRetry }: {
  sources: Source[]; focus: string | null; state: 'loading' | 'ready' | 'error'; onRetry: () => void;
}) {
  const ordered = focus ? [...sources.filter(s => s.ID === focus), ...sources.filter(s => s.ID !== focus)] : sources;
  const official: Record<string, Points> = {
    S01: [
      { label: 'Qué muestra.', text: 'La costa de referencia de INEGI, para ubicar el borde entre tierra y mar.' },
      { label: 'Años.', text: 'Edición 2025, con información de 2023–2025.' },
      { label: 'Uso.', text: 'Ayuda a orientarte. No es una medición de pérdida de playa entre años ni un límite de propiedad.' },
    ],
    S02: [
      { label: 'Qué muestra.', text: 'Las localidades del mapa de INEGI, con la población del Censo 2020.' },
      { label: 'Años.', text: 'El mapa corresponde al Marco de 2025; la población es de 2020.' },
      { label: 'Uso.', text: 'Los lugares ayudan a navegar. Sus áreas no son límites legales de predios.' },
    ],
    S12: [
      { label: 'Qué muestra.', text: 'Las zonas de manglar identificadas por CONABIO.' },
      { label: 'Año.', text: '2020. Es una capa de cobertura; los cambios de color anuales vienen de otra fuente: Global Mangrove Watch.' },
      { label: 'Uso.', text: 'Sirve como referencia regional. No certifica el manglar actual de cada propiedad.' },
    ],
    S13: [
      { label: 'Qué muestra.', text: 'Otros humedales y cuerpos de agua cercanos al manglar.' },
      { label: 'Año.', text: 'CONABIO, 2020.' },
      { label: 'Uso.', text: 'La selección no incluye toda la laguna ni todos los humedales. Tampoco predice inundaciones.' },
    ],
  };
  return <>
    <SourceEntry title="Erosión y acumulación de arena" credit="Torres-Freyermuth y col. · 2023" points={[
      { label: 'Qué muestra.', text: 'Sitios donde se midió el avance o retroceso medio de la costa, en metros por año.' },
      { label: 'Años.', text: '1986–2011, 2013–2021 y 2016–2021. Son periodos completos que se superponen, no datos de cada año.' },
      { label: 'Uso.', text: 'Las líneas conservan los valores publicados. Su largo no es playa perdida. No muestran la causa ni el estado de hoy.' },
    ]}>
      <a className="text-link" href={S34_URL} target="_blank" rel="noreferrer">Estudio original <ArrowUpRight /></a>
      <a className="text-link" href={AUTHORS_KMZ} target="_blank" rel="noreferrer">Datos de los autores <Download /></a>
      <a className="text-link" href="/data/problems/receipt.json" download>Preparación y verificación <Download /></a>
    </SourceEntry>
    <SourceEntry title="Cambios de manglar" credit="©Global Mangrove Watch · Bunting y col. · 2026 · CC BY 4.0" points={[
      { label: 'Colores.', text: 'Rojo: pérdida estimada. Turquesa: ganancia estimada. El manglar sin cambios no se colorea.' },
      { label: 'Años y área.', text: 'Cada año se compara con el anterior, entre 2011 y 2025. Los totales abarcan Chelem–Progreso. 1 km² equivale a 100 hectáreas.' },
      { label: 'Uso.', text: 'Estimaciones en cuadros de unos 30 m. Algunas fechas usan información de otros años. No prueban tala ni su causa; el borde no sigue cada árbol.' },
    ]}>
      <a className="text-link" href={GMW_SOURCE} target="_blank" rel="noreferrer">Fuente, método y licencia · 4.1.12 <ArrowUpRight /></a>
      <a className="text-link" href="/data/problems/gmw/manifest.json" target="_blank" rel="noreferrer">Años y superficies <ArrowUpRight /></a>
    </SourceEntry>
    <SourceEntry title="Geotubos de San Miguel y El Teresiano" credit="Torres-Freyermuth y col. · 2019 · CC BY 4.0" points={[
      { label: 'Qué muestra.', text: 'Obras con tubos de tela llenos de arena. Las seis líneas naranjas ubican su disposición histórica en San Miguel, no su ancho real.' },
      { label: 'Años.', text: 'Obras instaladas en 2017 y estudiadas hasta 2018. El vuelo de la figura es del 11 de abril de 2018.' },
      { label: 'Uso.', text: 'Desinflado no significa que todo el material se retiró. Los trazos no confirman el estado actual ni prueban que causaron erosión.' },
    ]}>
      <a className="text-link" href="https://doi.org/10.3390/w11040635" target="_blank" rel="noreferrer">Estudio y figuras <ArrowUpRight /></a>
      <a className="text-link" href={GEOTUBE_URL} target="_blank" rel="noreferrer">Estudio de playa 2016–2017 · Mendoza y col., 2022 <ArrowUpRight /></a>
      <a className="text-link" href="/data/problems/geotubes-evidence.json" target="_blank" rel="noreferrer">Registro de evidencia <ArrowUpRight /></a>
    </SourceEntry>
    <SourceEntry title="Muelles y escolleras dibujados" credit="©OpenStreetMap contributors · ODbL" points={[
      { label: 'Qué muestra.', text: 'Trazos morados de obras costeras, tomados del mapa colaborativo OpenStreetMap.' },
      { label: 'Fecha.', text: 'La fecha de edición indica cuándo cambió el mapa, no cuándo se construyó la obra.' },
      { label: 'Uso.', text: 'Ayuda a localizar obras para revisarlas. Una línea no indica el ancho, y el trazo no prueba daño ni presencia actual.' },
    ]}>
      <a className="text-link" href="/data/problems/structure-outlines.geojson" target="_blank" rel="noreferrer">Trazos y créditos de cada obra <ArrowUpRight /></a>
    </SourceEntry>
    <SourceEntry title="Espolones y otros puntos históricos" credit="Marin-Coria y col. · 2026 · CC BY 4.0" points={[
      { label: 'Qué incluye.', text: '359 puntos de Yucatán: 322 espolones, 12 escolleras, tres puertos y 22 muelles.' },
      { label: 'Años.', text: 'El archivo indica 1995 o 2019. No son fechas de construcción.' },
      { label: 'Uso.', text: 'Los puntos conservan las posiciones publicadas. No son contornos de las obras ni prueba de daño o de presencia actual.' },
    ]}>
      <a className="text-link" href={STRUCTURES_ARTICLE} target="_blank" rel="noreferrer">Estudio original <ArrowUpRight /></a>
      <a className="text-link" href={STRUCTURES_REPOSITORY} target="_blank" rel="noreferrer">Datos originales <ArrowUpRight /></a>
      <a className="text-link" href="/data/problems/structures-receipt.json" download>Preparación y verificación <Download /></a>
    </SourceEntry>
    <SourceEntry title="Imágenes de detalle · Esri" credit="Esri Wayback" points={[
      { label: 'Qué muestra.', text: 'Imágenes para explorar la costa con detalle. La calidad disponible cambia según el lugar y la fecha.' },
      { label: 'Años.', text: 'La fecha de captura es la toma de la foto. La edición es la publicación del mosaico; puede reunir fotos de días distintos.' },
      { label: 'Uso.', text: 'La fecha mostrada corresponde al centro de la vista. La marea no está corregida. Acercar más no añade información a la foto original.' },
    ]}>
      <a className="text-link" href="/data/history/wayback-chelem.json" target="_blank" rel="noreferrer">Consulta inicial de Chelem <ArrowUpRight /></a>
    </SourceEntry>
    <SourceEntry title="Imágenes anuales · Sentinel" credit="Copernicus · Microsoft Planetary Computer" points={[
      { label: 'Qué muestra.', text: '24 imágenes: una por año y sector. Cada cuadro representa unos 10 × 10 metros; sirve para cambios amplios, no obras pequeñas.' },
      { label: 'Años.', text: '2015–2026. Se eligió una imagen con poca nubosidad de escena; eso no garantiza que la playa esté libre de nubes.' },
      { label: 'Uso.', text: 'Acercar más no añade detalle. No hay corrección de marea ni mediciones de erosión hechas con estas imágenes en el mapa.' },
    ]}>
      <a className="text-link" href="/data/sentinel/manifest.json" target="_blank" rel="noreferrer">Fechas, sectores y selección <ArrowUpRight /></a>
      <a className="text-link" href="https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a" target="_blank" rel="noreferrer">Distribución de los datos <ArrowUpRight /></a>
    </SourceEntry>
    {state === 'loading' && <output>Cargando las fuentes…</output>}
    {state === 'error' && <div role="alert"><p>No se pudo cargar el catálogo.</p><Button variant="outline" onClick={onRetry}><RotateCcw /> Reintentar</Button></div>}
    {ordered.map(s => <details className="source-entry" key={s.ID} id={'source-' + s.ID} open={focus === s.ID || undefined}>
      <summary><span className="source-kicker">{s.ID} · {s.Institución}</span><span className="source-name">{s.Nombre}</span></summary>
      <div className="source-content"><ExplanationPoints points={official[s.ID] ?? [
        { label: 'Qué muestra.', text: s.Nombre + '.' },
        { label: 'Fecha.', text: s.Fecha + '.' },
        { label: 'Alcance.', text: s.Limitaciones },
      ]} /><a className="text-link" href={s.URL} target="_blank" rel="noreferrer">Fuente original <ArrowUpRight /></a></div>
    </details>)}
    <SourceEntry title="Mapa regional para orientarte" credit="S50 · INEGI · diciembre de 2025" points={[
      { label: 'Qué muestra.', text: 'Campeche, Quintana Roo y Yucatán en el fondo del mapa.' },
      { label: 'Año.', text: 'Marco Geoestadístico de diciembre de 2025.' },
      { label: 'Uso.', text: 'Ayuda a navegar. No define límites legales ni sustituye la costa de referencia.' },
    ]}>
      <a className="text-link" href="https://www.inegi.org.mx/servicios/catalogounico.html" target="_blank" rel="noreferrer">Documentación original <ArrowUpRight /></a>
    </SourceEntry>
    <div className="evidence-downloads">
      <a href="/data/sources.json" download className="text-link"><Download /> Catálogo completo de fuentes</a>
      <a href="/data/preparation.json" download className="text-link"><Download /> Cómo se prepararon los datos</a>
      <a href="/data/metadata-evidence.zip" download className="text-link"><Download /> Metadatos y condiciones</a>
      <a href="/data/research-catalogue.json" download className="text-link"><Download /> Catálogo de investigación</a>
    </div>
  </>;
}
export function AboutPanel() {
  return <>
    <SatelliteMedia place="chelem" />
    <ExplanationPoints points={[
      { label: 'Para qué sirve.', text: 'Explorar juntos la costa, sus cambios y las obras registradas. EVEN prepara este mapa para el Colectivo por la Costa.' },
      { label: 'Qué reúne.', text: 'Datos públicos con sus fechas y fuentes. Una zona sin marcas no significa que esté sana.' },
      { label: 'Qué falta.', text: 'El área de estudio es preliminar. Sus límites científicos y las causas de los cambios requieren revisión especialista.' },
    ]} />
    <p className="about-signature">Celda Chelem <span>Prototipo territorial</span></p>
  </>;
}
