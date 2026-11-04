'use client';
import { useEffect, useRef } from 'react';
import { LocateFixed, ArrowUpRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  SAN_MIGUEL_VIEW,
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
  GMW_SOURCE,
  type DatedMangroveComparison,
} from '@/lib/mangrove-history';
import {
  evidenceKinds,
  evidenceColors,
  evidenceViews,
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
  const selectionKey = evidenceSelected
    ? String(evidenceSelected.feature.id ?? evidenceSelected.feature.properties.record_id)
    : footprint?.id ?? selected?.properties.idPol_Tran;
  useEffect(() => {
    if (selectionKey) root.current?.closest('.floating-panel-body')?.scrollTo({ top: 0 });
  }, [selectionKey]);
  return (
    <div ref={root} className="problems-panel compact-problems">
      {evidenceSelected && (
        <article className="compact-selection" aria-live="polite" data-explanation="evidence">
          <h2>{evidenceSelected.kind === 'geotubes'
            ? 'Geotubo G' + String(evidenceSelected.feature.properties.id).slice(-2).replace(/^0/, '')
            : evidenceTitle(evidenceSelected)}</h2>
          <ExplanationPoints points={evidenceExplanation(evidenceSelected, mangrove.comparison, mangrove.captureYear)} />
          <a className="compact-link" href={evidenceSource(evidenceSelected)} target="_blank" rel="noreferrer">
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
      {evidenceKinds.map((kind) => {
        const label =
          kind === 'barriers'
            ? 'Muelles y escolleras'
            : kind === 'geotubes'
              ? 'Geotubos'
              : 'Cambios de manglar';
        return (
          <div key={kind} className="problem-group">
            <div
              className={
                'problem-toggle ' + (issueVisibility[kind] ? 'is-on' : '')
              }
            >
              <i
                className="problem-swatch"
                style={{
                  background:
                    kind === 'vegetation'
                      ? 'linear-gradient(90deg,#f46c55 50%,#4fc4ad 50%)'
                      : evidenceColors[kind],
                }}
              />
              <label htmlFor={'issue-' + kind}>{label}</label>
              {evidenceStatus[kind] === 'error' ? (
                <button
                  className={
                    'problem-locate' +
                    (kind === 'geotubes' ? ' geotube-locate' : '')
                  }
                  aria-label={'Reintentar ' + label}
                  onClick={onEvidenceRetry}
                >
                  ↻
                </button>
              ) : (
                <button
                  className={
                    'problem-locate' +
                    (kind === 'geotubes' ? ' geotube-locate' : '')
                  }
                  title={'Localizar ' + label}
                  aria-label={'Localizar ' + label}
                  disabled={evidenceStatus[kind] !== 'ready'}
                  onClick={() => {
                    onIssueVisibility(kind, true);
                    onNavigate(
                      kind === 'barriers'
                        ? areaBounds
                        : kind === 'vegetation'
                          ? mangrove.bounds
                          : evidenceViews[kind],
                    );
                  }}
                >
                  {kind === 'geotubes' ? 'Ver' : <LocateFixed />}
                </button>
              )}
              <Switch
                id={'issue-' + kind}
                aria-label={label}
                checked={issueVisibility[kind]}
                onCheckedChange={(v) => {
                  onIssueVisibility(kind, v);
                }}
                disabled={evidenceStatus[kind] !== 'ready'}
              />
            </div>
            {kind === 'vegetation' && issueVisibility.vegetation && (
              <div className="mangrove-year-summary" aria-live="polite">
                {mangrove.comparison ? (
                  <>
                    <span>
                      {mangrove.comparison.previous_year} →{' '}
                      {mangrove.comparison.year}
                      {mangrove.comparison.reference
                        ? ' · referencia para ' + mangrove.captureYear
                        : ''}
                    </span>
                    <div>
                      <span className="is-loss">
                        Pérdida{' '}
                        {(
                          mangrove.comparison.loss_area_m2 / 10000
                        ).toLocaleString('es-MX', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        ha
                      </span>
                      <span className="is-gain">
                        Ganancia{' '}
                        {(
                          mangrove.comparison.gain_area_m2 / 10000
                        ).toLocaleString('es-MX', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        ha
                      </span>
                    </div>
                    <small>Cobertura estimada · 30 m · corredor completo</small>
                  </>
                ) : (
                  <span>
                    {mangrove.status === 'error'
                      ? 'No se pudo cargar la serie anual'
                      : mangrove.status === 'loading'
                        ? 'Cargando serie anual…'
                        : mangrove.captureYear === null
                          ? 'Fecha de captura en consulta'
                          : 'Manglar: sin comparación para ' + mangrove.captureYear}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
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
          <summary>Cobertura de manglar · GMW</summary>
          <ExplanationPoints points={[
            { label: 'Colores.', text: 'Rojo: pérdida estimada de manglar. Turquesa: ganancia estimada. El manglar sin cambios no se colorea.' },
            { label: 'Años y área.', text: 'Se compara cada año con el anterior, entre 2011 y 2025. Los totales son de todo Chelem–Progreso. 1 km² equivale a 100 hectáreas.' },
            { label: 'Alcance.', text: 'Son estimaciones en cuadros de unos 30 m. Algunas fechas se completaron con información de otros años. No prueban tala ni su causa; no sumes los años como zonas distintas.' },
          ]} />
          <a
            className="compact-link"
            href={GMW_SOURCE}
            target="_blank"
            rel="noreferrer"
          >
            Bunting y col., 2026 · Global Mangrove Watch 4.1.12 · CC BY 4.0{' '}
            <ArrowUpRight />
          </a>
          <label className="reference-toggle">
            <input
              type="checkbox"
              checked={mangrove.reference2020}
              onChange={(event) => {
                mangrove.onReference2020(event.target.checked);
                if (event.target.checked) onHistoricalReferences(true);
              }}
            />
            Referencia CONABIO · perturbado 2020
          </label>
        </details>
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
          {evidenceKinds.map((kind) => (
            <a className="compact-link" key={kind}
              href={'/data/problems/' + (kind === 'barriers' ? 'structure-outlines' : kind === 'geotubes' ? 'geotube-historical-axes' : 'disturbed-mangrove-2020') + '.geojson'}
              target="_blank" rel="noreferrer">
              {kind === 'barriers' ? 'Estructuras' : kind === 'geotubes' ? 'Geotubos' : 'Manglar perturbado'} · {evidence[kind]?.features.length ?? '…'} · datos y créditos <ArrowUpRight />
            </a>
          ))}
        </details>
        <StructuresPanel
          {...structures}
          referencesVisible={referencesVisible}
          onReferencesVisible={onReferencesVisible}
        />
        <details className="compact-details geotube-evidence">
          <summary>Figura de los geotubos</summary>
          <a
            className="geotube-figure"
            href="/data/problems/geotubes-2019-figure5.png"
            target="_blank"
            rel="noreferrer"
          >
            <img // oxlint-disable-line next/no-img-element -- preserve the published scientific figure without image transformations
              loading="lazy"
              decoding="async"
              src="/data/problems/geotubes-2019-figure5.png"
              alt="Figura 5: vuelo del 11 de abril de 2018 en San Miguel, con la disposición de los geotextiles señalada en negro por los autores"
            />
          </a>
          <small className="geotube-credit">
            Torres-Freyermuth y col., 2019 · Fig. 5 · CC BY 4.0
          </small>
          <a
            className="compact-link"
            href="/data/problems/geotubes-2019-figure3.png"
            target="_blank"
            rel="noreferrer"
          >
            Ver disposición de los dos casos <ArrowUpRight />
          </a>
          <button
            className="compact-link"
            onClick={() => onNavigate(SAN_MIGUEL_VIEW)}
          >
            Ver sector San Miguel <LocateFixed />
          </button>
          <ExplanationPoints points={[
            { label: '2017.', text: 'El Teresiano se instaló en mayo y San Miguel en junio–julio. En noviembre hubo un retiro parcial en San Miguel.' },
            { label: '2018.', text: 'El vuelo mostrado es del 11 de abril. En junio el estudio reportó los geotubos de San Miguel desinflados; eso no confirma que se retiró todo el material.' },
            { label: 'En el mapa.', text: 'Las seis líneas ubican la disposición histórica. No son bordes físicos medidos; su ancho real y su estado actual no están confirmados.' },
          ]} />
          <a className="compact-link" href="https://doi.org/10.3390/w11040635" target="_blank" rel="noreferrer">Estudio y figuras · CC BY 4.0 <ArrowUpRight /></a>
          <a className="compact-link" href="/data/problems/geotubes-evidence.json" target="_blank" rel="noreferrer">Registro de evidencia <ArrowUpRight /></a>
        </details>
        <details className="compact-details">
          <summary>Por localizar</summary>
          <ExplanationPoints points={[
            { label: 'Dunas y vegetación.', text: 'Todavía no hay contornos verificados para señalar su retiro.' },
            { label: 'Divisiones artificiales.', text: 'También falta comprobar dónde y cuándo se hicieron.' },
            { label: 'Manglar.', text: 'La capa de cambios no sustituye esa revisión ni demuestra quién causó una alteración.' },
          ]} />
        </details>
      </details>
    </div>
  );
}
