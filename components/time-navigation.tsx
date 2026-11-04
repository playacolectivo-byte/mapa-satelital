'use client';

import { ArrowLeft, ArrowRight, ChevronDown, Info, LocateFixed } from 'lucide-react';
import { Slider } from '@base-ui/react/slider';
import { Button } from '@/components/ui/button';
import type { HistoricalManifest } from '@/lib/history';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

type Props = {
  history: HistoricalManifest | null; error: boolean; epoch: string | null;
  onChange: (id: string | null) => void; onDetails: () => void; onCoverage: () => void;
  covered: boolean | null; loading: boolean; imageError: boolean; onRetry: () => void;
  expanded: boolean; onExpandedChange: (open: boolean) => void; onReturn: () => void;
};

export function TimeNavigation({ history, error, epoch, onChange, onDetails, onCoverage, covered, loading, imageError, onRetry, expanded, onExpandedChange, onReturn }: Props) {
  const index = Math.max(0, history?.epochs.findIndex(e => e.id === epoch) ?? 0);
  const current = history?.epochs[index];
  return <section className="time-navigation satellite-timeline archive-timeline" aria-label="Línea del tiempo de imágenes">
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <div className="time-heading">
        <Button variant="ghost" size="icon" onClick={onReturn} aria-label="Volver al histórico satelital" title="Volver al histórico satelital"><ArrowLeft /></Button>
        <div className="archive-date"><p className="eyebrow">Archivo INEGI · fecha de vuelo</p><h2>{current?.label ?? 'Cargando archivo…'}</h2></div>
        <CollapsibleTrigger className="timeline-disclosure" aria-label={expanded ? 'Contraer detalles del archivo' : 'Desplegar detalles del archivo'}><span>{expanded ? 'Menos' : 'Detalles'}</span><ChevronDown /></CollapsibleTrigger>
      </div>
      {!history ? <p className="time-note" role={error ? 'alert' : 'status'}>{error ? 'No se pudo cargar el archivo de imágenes.' : 'Preparando las fechas verificadas…'}{error && <Button variant="ghost" onClick={onRetry}>Reintentar</Button>}</p> : <>
        <div className="time-track-row">
          <Button variant="ghost" size="icon" aria-label="Fecha anterior" disabled={index === 0} onClick={() => onChange(history.epochs[index - 1].id)}><ArrowLeft /></Button>
          <div className="time-track">
            <Slider.Root value={index} min={0} max={Math.max(1, history.epochs.length - 1)} step={1} largeStep={1} disabled={history.epochs.length < 2} onValueChange={value => onChange(history.epochs[value].id)}>
              <Slider.Control className="time-slider-control">
                <Slider.Track className="time-slider-track"><Slider.Indicator className="time-slider-indicator" /><Slider.Thumb className="time-slider-thumb" aria-label="Fecha de la fotografía aérea" getAriaValueText={(_, value) => history.epochs[value]?.label ?? ''} /></Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <div className="time-ticks">{history.epochs.map(e => <button key={e.id} aria-pressed={e.id === epoch} onClick={() => onChange(e.id)}>{e.short_label}</button>)}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fecha siguiente" disabled={index === history.epochs.length - 1} onClick={() => onChange(history.epochs[index + 1].id)}><ArrowRight /></Button>
        </div>
        {(imageError || covered === false) && <div className="archive-coverage-note" role={imageError ? 'alert' : 'status'}><span>{imageError ? 'No se pudo cargar esta imagen.' : 'Sin imagen de esta fecha en el centro.'}</span><Button variant="ghost" onClick={imageError ? onRetry : onCoverage}>{imageError ? 'Reintentar' : 'Ver cobertura'}</Button></div>}
        <CollapsibleContent className="timeline-details">
          <output className="satellite-date-detail">{loading ? 'Cargando fotografía aérea…' : `Ortofoto INEGI · píxel original de ${current?.resolution_m} m`}</output>
          <div className="satellite-actions"><Button variant="ghost" onClick={onCoverage}><LocateFixed />Ver cobertura</Button><Button variant="ghost" onClick={onDetails}><Info />Fechas y fuentes</Button></div>
          <p className="time-note">Dos fechas documentadas. Sin imágenes intermedias ni mediciones de erosión. Ampliar más no añade detalle.</p>
        </CollapsibleContent>
      </>}
    </Collapsible>
  </section>;
}

export function HistoryDetails({ history }: { history: HistoricalManifest | null }) {
  if (!history) return <p className="fine-print">El archivo de imágenes todavía no está disponible.</p>;
  return <div className="history-details">
    <p className="reading-intro">Desliza entre fotografías aéreas con fecha de vuelo documentada. El encuadre se conserva para comparar el mismo lugar.</p>
    <div className="notice"><p>Las imágenes permiten una lectura visual. No trazan límites catastrales ni prueban tasas de erosión. Ampliar una imagen no mejora su resolución original.</p></div>
    {history.epochs.map(e => <details className="source-entry" key={e.id} open>
      <summary><span className="source-name">{e.label}</span><span className="fine-print">INEGI · blanco y negro · píxel de {e.resolution_m} m</span></summary>
      <div className="source-content">
        <p>Fecha de vuelo a precisión de mes. No se atribuye un día exacto. La cobertura se obtiene de cada raster recibido; fuera de ella no se muestra otra fecha.</p>
        {history.frames.filter(f => f.epoch === e.id).map(f => <div className="historical-source" key={f.id}>
          <p><strong>{f.sheet}</strong> · UPC {f.id}</p>
          <a href={f.catalogue_url} target="_blank" rel="noreferrer">Ficha INEGI</a>{' · '}<a href={f.metadata_url} target="_blank" rel="noreferrer">Metadatos del original</a>
          {f.note && <p className="fine-print">{f.note}</p>}
        </div>)}
      </div>
    </details>)}
    <details className="reading-details"><summary>Cómo se prepararon las imágenes</summary><p>{history.method}</p><p>La muestra de visualización es de aproximadamente 2.23 m para 1995 y 1.11 m para 2005 en este corredor; los píxeles originales son de 2 y 1 m. El zoom adicional magnifica la imagen disponible.</p><p>Los rectángulos discontinuos delimitan cobertura de imágenes, no la celda litoral ni predios. Los cinco temas vectoriales mantienen sus propias fechas de 2020–2025 y se ocultan inicialmente al entrar al archivo.</p><p>El ensayo S32 de 1995 conserva cero controles aceptados. Esta visualización no georreferencia la figura S32 ni acepta controles nuevos.</p></details>
    <details className="reading-details"><summary>Satélite reciente y detalle de predios</summary><p>Esri World Imagery combina fechas, sensores y resoluciones. Las fechas conocidas en puntos de consulta no describen todo el mosaico. Para reconocer un predio legalmente hace falta una cartografía catastral autorizada, todavía no incorporada.</p></details>
    <p className="fine-print">{history.attribution} <a href="/data/history/manifest.json" target="_blank" rel="noreferrer">Consultar manifiesto de visualización</a>.</p>
  </div>;
}
