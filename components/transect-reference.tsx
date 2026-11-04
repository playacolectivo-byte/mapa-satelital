'use client';
import { spanDistanceLabel, type BarFootprint, type TransectIndex } from '@/lib/transect-pairs';

export function TransectReferenceHeader({ footprint, index, onSelect }: { footprint: BarFootprint; index: TransectIndex; onSelect: (id: string) => void }) {
  const previous = index.previous.get(footprint.id), next = index.next.get(footprint.id);
  return <div className="transect-reference-header" data-reference-bar={footprint.id} data-front-m={footprint.frontM ?? 'unknown'} data-axis-length-m={footprint.axisLengthM}>
    <div className="transect-span-heading"><h2>Esta barra · {footprint.id}</h2><div className="transect-span-navigation">
      <button type="button" aria-label="Barra anterior" disabled={!previous} onClick={() => previous && onSelect(previous.properties.idPol_Tran)}>←</button>
      <button type="button" aria-label="Barra siguiente" disabled={!next} onClick={() => next && onSelect(next.properties.idPol_Tran)}>→</button>
    </div></div>
    <details className="compact-details"><summary>Referencia técnica del eje</summary>
      <p className="transect-axis-length">Eje original: {spanDistanceLabel(footprint.axisLengthM)}. Su longitud no mide playa perdida.</p>
      <p className="transect-reference-note">Separación gráfica asignada entre vecinas: {footprint.frontM === null ? 'sin asignar' : spanDistanceLabel(footprint.frontM)}.{footprint.partial ? ' Parcial en el extremo.' : ''} No es la extensión científica del dato.</p>
    </details>
  </div>;
}
