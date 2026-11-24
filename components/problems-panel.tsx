'use client';
import { useEffect, useRef } from 'react';
import { LocateFixed, ArrowUpRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  S34_URL,
  researchSeries,
  type ErosionFeature,
  type ResearchSeries,
} from '@/lib/problems';
import type { IssueType, IssueVisibility } from '@/lib/coastal-issues';
import type { Bounds } from '@/lib/view';
import { StructuresPanel, type StructuresPanelProps } from './structures-panel';
import { ExplanationPoints } from './explanation-points';
import { CoastalEvolutionDetails } from './coastal-evolution';
import type { EvolutionIndex } from '@/lib/coastal-evolution';
import { erosionExplanation, erosionBarExplanation, evidenceExplanation } from '@/lib/map-explanations';
import { type BarFootprint, type TransectIndex } from '@/lib/transect-pairs';
import { TransectReferenceHeader } from './transect-reference';
import type { CaptureFrame } from '@/lib/temporal-evidence';
import {
  type DatedMangroveComparison,
} from '@/lib/mangrove-history';
import {
  evidenceColors,
  geotubeBounds,
  nearestGroyneGroup,
  evidenceTitle,
  evidenceSource,
  type EvidenceLayers,
  type EvidenceKind,
  type EvidenceSelection,
} from '@/lib/map-evidence';

export function ProblemsPanel({
  evolution,
  structures,
  areaBounds,
  series,
  onSeries,
  followsTime,
  onFollowsTime,
  visible,
  onVisible,
  status,
  selected,
  footprint,
  barIndex,
  onBarSelect,
  onNavigate,
  onRetry,
  issueVisibility,
  onIssueVisibility,
  evidence,
  showGeotubeControl,
  showGroynesControl,
  evidenceStatus,
  evidenceSelected,
  onEvidenceRetry,
  referencesVisible,
  onReferencesVisible,
  captureFrame,
  historicalReferences,
  onHistoricalReferences,
  studyMatched,
  mangrove,
}: {
  evolution: { enabled: boolean; index: EvolutionIndex | null; year: number; status: 'loading' | 'ready' | 'error'; onEnabled: (value: boolean) => void; onRetry: () => void };
  mangrove: {
    comparison: DatedMangroveComparison | null;
    status: 'loading' | 'ready' | 'error';
    captureYear: number | null;
    bounds: Bounds;
    reference2020: boolean;
    onReference2020: (visible: boolean) => void;
  };
  areaBounds: Bounds;
  captureFrame: CaptureFrame | null;
  historicalReferences: boolean;
  onHistoricalReferences: (visible: boolean) => void;
  studyMatched: boolean;
  evidence: EvidenceLayers;
  showGeotubeControl: boolean;
  showGroynesControl: boolean;
  evidenceStatus: Record<EvidenceKind, 'loading' | 'ready' | 'error'>;
  evidenceSelected: EvidenceSelection | null;
  onEvidenceRetry: () => void;
  referencesVisible: boolean;
  onReferencesVisible: (visible: boolean) => void;
  structures: StructuresPanelProps;
  issueVisibility: IssueVisibility;
  onIssueVisibility: (id: IssueType, value: boolean) => void;
  series: ResearchSeries;
  onSeries: (s: ResearchSeries) => void;
  followsTime: boolean;
  onFollowsTime: (follows: boolean) => void;
  visible: boolean;
  onVisible: (v: boolean) => void;
  status: 'loading' | 'ready' | 'error';
  selected: ErosionFeature | null;
  footprint: BarFootprint | null;
  barIndex: TransectIndex<ErosionFeature> | null;
  onBarSelect: (barId: string) => void;
  onNavigate: (bounds: Bounds) => void;
  onRetry: () => void;
}) {
  const active = researchSeries.find((s) => s.id === series)!;
  const root = useRef<HTMLDivElement>(null);
  const visibleGeotubeBounds = geotubeBounds(evidence.geotubes);
  const groyneGroup = nearestGroyneGroup(evidence.groynes, captureFrame?.center ?? null);
  const selectedStructure = evidenceSelected?.kind === 'vegetation' ? null : evidenceSelected;
  const selectionKey = selectedStructure
    ? String(selectedStructure.feature.id ?? selectedStructure.feature.properties.record_id)
    : footprint?.id ?? selected?.properties.idPol_Tran;
  useEffect(() => {
    if (selectionKey) root.current?.closest('.floating-panel-body')?.scrollTo({ top: 0 });
  }, [selectionKey]);
  return (
    <div ref={root} className="problems-panel compact-problems">
      {selectedStructure && (
        <article className="compact-selection" aria-live="polite" data-explanation="evidence">
          <h2>{evidenceTitle(selectedStructure)}</h2>
          <ExplanationPoints points={evidenceExplanation(selectedStructure, mangrove.comparison, mangrove.captureYear)} />
          <a className="compact-link" href={evidenceSource(selectedStructure)} target="_blank" rel="noreferrer">
            Ver fuente <ArrowUpRight />
          </a>
        </article>
      )}
      {evolution.enabled && evolution.index && (footprint || selected) && <CoastalEvolutionDetails index={evolution.index} year={evolution.year} id={footprint?.id ?? selected!.properties.idPol_Tran} published={footprint ? barIndex?.byId.get(footprint.id) : selected} />}
      {!evolution.enabled && (footprint || selected) && (
        <article className="compact-selection" aria-live="polite" data-explanation="erosion">
          <small>Investigación publicada · Alec y colaboradores · {active.period}</small>
          {footprint && barIndex ? <><TransectReferenceHeader footprint={footprint} index={barIndex} onSelect={onBarSelect} /><ExplanationPoints points={erosionBarExplanation(barIndex.byId.get(footprint.id)!, series, mangrove.captureYear)} /></> : selected && <><h2>{selected.properties.category.replace('Acreción', 'Acumulación de arena')}</h2><ExplanationPoints points={erosionExplanation(selected, mangrove.captureYear)} /></>}
          <a className="compact-link" href={S34_URL} target="_blank" rel="noreferrer">
            Ver estudio original <ArrowUpRight />
          </a>
        </article>
      )}

      <div className={'problem-toggle ' + (visible ? 'is-on' : '')}>
        <i className="problem-swatch is-erosion" />
        <label htmlFor="erosion-visible">Erosión</label>
        <button
          className="problem-locate"
          title="Ver erosión en el mapa"
          aria-label="Ver cobertura de erosión"
          onClick={() => {
            onVisible(true);
            onNavigate(areaBounds);
          }}
        >
          <LocateFixed />
        </button>
        <Switch
          id="erosion-visible"
          aria-label="Erosión"
          checked={visible}
          onCheckedChange={onVisible}
        />
      </div>
      <div className="problem-group">
        <div className={'problem-toggle ' + (issueVisibility.barriers ? 'is-on' : '')}>
          <i className="problem-swatch" style={{ background: evidenceColors.barriers }} />
          <label htmlFor="issue-barriers">Muelles y escolleras</label>
          {evidenceStatus.barriers === 'error' ? (
            <button className="problem-locate" aria-label="Reintentar Muelles y escolleras" onClick={onEvidenceRetry}>↻</button>
          ) : (
            <button className="problem-locate" title="Localizar Muelles y escolleras" aria-label="Localizar Muelles y escolleras" disabled={evidenceStatus.barriers !== 'ready'} onClick={() => {
              onIssueVisibility('barriers', true);
              onNavigate(areaBounds);
            }}><LocateFixed /></button>
          )}
          <Switch id="issue-barriers" aria-label="Muelles y escolleras" checked={issueVisibility.barriers} onCheckedChange={(value) => onIssueVisibility('barriers', value)} disabled={evidenceStatus.barriers !== 'ready'} />
        </div>
        {showGroynesControl && (
          <div className={'problem-toggle ' + (issueVisibility.groynes && groyneGroup ? 'is-on' : '')}>
            <i className="problem-swatch" style={{ background: evidenceColors.groynes }} />
            <label htmlFor="issue-groynes">Espolones</label>
            {evidenceStatus.groynes === 'error' ? (
              <button className="problem-locate" aria-label="Reintentar espolones" onClick={onEvidenceRetry}>↻</button>
            ) : (
              <button
                className="problem-locate"
                title={groyneGroup ? `Localizar espolones de ${groyneGroup.locality}` : 'Sin espolones revisados en esta imagen'}
                aria-label="Localizar espolones"
                disabled={!groyneGroup}
                onClick={() => {
                  if (!groyneGroup) return;
                  onIssueVisibility('groynes', true);
                  onNavigate(groyneGroup.bounds);
                }}
              ><LocateFixed /></button>
            )}
            <Switch id="issue-groynes" aria-label="Espolones" checked={issueVisibility.groynes && !!groyneGroup} onCheckedChange={(value) => onIssueVisibility('groynes', value)} disabled={!groyneGroup} />
          </div>
        )}
        {showGeotubeControl && (
          <div className={'problem-toggle ' + (issueVisibility.geotubes ? 'is-on' : '')}>
            <i className="problem-swatch" style={{ background: evidenceColors.geotubes }} />
            <label htmlFor="issue-geotubes">Geotubos</label>
            {evidenceStatus.geotubes === 'error' ? (
              <button className="problem-locate" aria-label="Reintentar Geotubos" onClick={onEvidenceRetry}>↻</button>
            ) : (
              <button className="problem-locate" title="Localizar geotubos" aria-label="Localizar geotubos" disabled={!visibleGeotubeBounds} onClick={() => {
                if (!visibleGeotubeBounds) return;
                onIssueVisibility('geotubes', true);
                onNavigate(visibleGeotubeBounds);
              }}><LocateFixed /></button>
            )}
            <Switch id="issue-geotubes" aria-label="Geotubos" checked={issueVisibility.geotubes} onCheckedChange={(value) => onIssueVisibility('geotubes', value)} disabled={evidenceStatus.geotubes !== 'ready'} />
          </div>
        )}
      </div>
      <details className="compact-details problem-evidence-details">
        <summary>Evidencia y fuentes</summary>
        <p>Estimación del proyecto · asistida por ChatGPT. Base fija: 1993. Continua: ambos extremos observados. Discontinua: base o extremo estimado con la tendencia de Alec. Sin base de 1993 compatible, no se calcula cambio; una base modelada nunca se presenta como medición de 1993.</p>
        {evolution.status === 'error' && <button className="compact-link" onClick={evolution.onRetry}>Reintentar posiciones</button>}
        {!evolution.enabled && <details className="compact-details">
          <summary>Erosión · {active.period}</summary>
          <label className="sr-only" htmlFor="research-series">
            Periodo del estudio
          </label>
          <label className="reference-toggle">
            <input
              type="checkbox"
              checked={followsTime}
              onChange={(e) => onFollowsTime(e.target.checked)}
            />
            Seguir año de la imagen
          </label>
          <select
            id="research-series"
            className="structure-select"
            value={series}
            onChange={(e) => onSeries(e.target.value as ResearchSeries)}
          >
            {researchSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.period}
              </option>
            ))}
          </select>
          {status === 'loading' && <output>Cargando…</output>}
          {status === 'error' && <button onClick={onRetry}>Reintentar</button>}
          <a
            className="compact-link"
            href={S34_URL}
            target="_blank"
            rel="noreferrer"
          >
            Torres-Freyermuth y col., 2023 <ArrowUpRight />
          </a>
          <ExplanationPoints points={[
            { label: 'Colores.', text: 'Rojo: erosión alta. Amarillo: erosión baja. Gris: estable. Turquesa: acumulación de arena.' },
            { label: 'Medida.', text: 'Al tocar una barra verás su frente de referencia en metros, el largo de la línea y la medición de ese eje. La llave es una referencia gráfica entre los puntos medios hacia sus vecinas.' },
            { label: 'Años.', text: 'Son promedios en metros por año del periodo elegido. El cambio pudo variar cada año. Un tramo sin líneas no indica ausencia de erosión.' + (!studyMatched ? ' La foto queda fuera de ese periodo.' : '') },
          ]} />
        </details>}
        <details className="compact-details">
          <summary>Trazos y fuentes</summary>
          <label className="reference-toggle">
            <input
              type="checkbox"
              checked={historicalReferences}
              onChange={(e) => onHistoricalReferences(e.target.checked)}
            />{' '}
            Mostrar referencias históricas
          </label>
          <ExplanationPoints points={[
            { label: 'Imagen.', text: captureFrame?.date ? 'Fecha al centro: ' + captureFrame.date + '.' : 'La fecha al centro aún está en consulta.' },
            { label: 'Con fecha.', text: 'Las marcas cambian cuando existe una observación para esa captura. No suponemos lo ocurrido en años sin datos.' },
            { label: 'Referencias.', text: 'Los otros trazos sirven para ubicar información antigua. No confirman que la obra siga ahí ni cuándo se construyó.' },
          ]} />
          <a className="compact-link" href="/data/problems/structure-outlines.geojson" target="_blank" rel="noreferrer">
            Estructuras · {evidence.barriers?.features.length ?? '…'} · datos y créditos <ArrowUpRight />
          </a>
        </details>
        <StructuresPanel
          {...structures}
          referencesVisible={referencesVisible}
          onReferencesVisible={onReferencesVisible}
        />
      </details>
    </div>
  );
}
