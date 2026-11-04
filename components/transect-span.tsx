'use client';
import { spanDistanceLabel, transectSpan, type TransectPair, type TransectPairIndex } from '@/lib/transect-pairs';

export function TransectSpanHeader({ pair, index, onSelect }: { pair: TransectPair; index: TransectPairIndex; onSelect: (barId: string) => void }) {
  const span = transectSpan(pair);
  const previous = index.previous.get(pair.id), next = index.next.get(pair.id);
  return <div className="transect-span-header" data-transect-pair={pair.id} data-distance-m={span.distanceM}>
    <div className="transect-span-heading"><h2>Tramo entre barras</h2><div className="transect-span-navigation">
      <button type="button" aria-label="Tramo anterior" disabled={!previous} onClick={() => previous && onSelect(previous.a.properties.idPol_Tran)}>←</button>
      <button type="button" aria-label="Tramo siguiente" disabled={!next} onClick={() => next && onSelect(next.a.properties.idPol_Tran)}>→</button>
    </div></div>
    <p className="transect-span-distance">{spanDistanceLabel(span.distanceM)}<span>Separación entre los centros de las barras</span></p>
    <p className="transect-span-ids"><span>A · {span.aId}</span><span>B · {span.bId}</span></p>
  </div>;
}
