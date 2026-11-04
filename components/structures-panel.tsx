'use client';
import { ArrowUpRight } from 'lucide-react';
import {
  structureTypes,
  STRUCTURES_REPOSITORY,
  type StructureData,
  type StructureFeature,
  type StructureFilter,
} from '@/lib/coastal-structures';
import type { Bounds } from '@/lib/view';
import { ExplanationPoints } from './explanation-points';
export type StructuresPanelProps = {
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  data: StructureData | null;
  filtered: StructureData | null;
  status: 'loading' | 'ready' | 'error';
  filter: StructureFilter;
  selected: StructureFeature | null;
  onFilter: (filter: StructureFilter) => void;
  onLocate: (feature: StructureFeature) => void;
  onCoverage: (bounds: Bounds) => void;
  onRetry: () => void;
};
export function StructuresPanel({
  expanded,
  onExpandedChange,
  data,
  filtered,
  status,
  filter,
  selected,
  onFilter,
  onLocate,
  onRetry,
  referencesVisible,
  onReferencesVisible,
}: StructuresPanelProps & {
  referencesVisible: boolean;
  onReferencesVisible: (visible: boolean) => void;
}) {
  return (
    <details
      className="compact-details structures-details"
      open={expanded}
      onToggle={(e) => onExpandedChange(e.currentTarget.open)}
    >
      <summary>
        Espolones y otros puntos · {filtered?.features.length ?? '…'}
      </summary>
      {status === 'error' ? (
        <button onClick={onRetry}>Reintentar inventario</button>
      ) : status === 'loading' ? (
        <output>Cargando…</output>
      ) : (
        <>
          <label className="reference-toggle">
            <input
              type="checkbox"
              checked={referencesVisible}
              onChange={(e) => onReferencesVisible(e.target.checked)}
            />{' '}
            Mostrar puntos publicados
          </label>
          <label className="sr-only" htmlFor="structure-type">
            Tipo de estructura
          </label>
          <select
            id="structure-type"
            className="structure-select"
            value={filter}
            onChange={(e) => onFilter(e.target.value as StructureFilter)}
          >
            <option value="all">Todas · 359</option>
            {structureTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} · {t.count}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="structure-record">
            Localizar un registro
          </label>
          <select
            id="structure-record"
            className="structure-select"
            value={selected?.properties.record_id ?? ''}
            onChange={(e) => {
              const f = data?.features.find(
                (f) => f.properties.record_id === e.target.value,
              );
              if (f) onLocate(f);
            }}
          >
            <option value="">Localizar registro…</option>
            {filtered?.features.map((f) => (
              <option key={f.id} value={f.properties.record_id}>
                {f.properties.type_label} · {f.properties.Year} ·{' '}
                {f.properties.record_id}
              </option>
            ))}
          </select>
          {selected && (
            <article className="compact-selection" aria-live="polite" data-explanation="structure">
              <h2>{selected.properties.type_label}</h2>
              <ExplanationPoints points={[
                { label: 'Qué ves.', text: 'El punto ubica una obra del inventario publicado. No dibuja su forma ni su tamaño.' },
                { label: 'Año del archivo.', text: String(selected.properties.Year) + '. Es una referencia del inventario, no la fecha de construcción.' },
                { label: 'Qué significa.', text: 'Ayuda a localizar la obra para revisarla. No confirma su estado actual ni demuestra que causó daño a la playa.' },
              ]} />
              <button
                className="compact-link"
                onClick={() => onLocate(selected)}
              >
                Centrar registro <ArrowUpRight />
              </button>
            </article>
          )}
        </>
      )}
      <details className="compact-details">
        <summary>Fuente y fechas</summary>
        <ExplanationPoints points={[
          { label: 'Qué incluye.', text: '359 puntos de obras costeras en Yucatán, publicados por Marin-Coria y colaboradores en 2026.' },
          { label: 'Años.', text: 'El archivo indica 1995 o 2019. No son fechas de construcción ni confirman que la obra siga ahí.' },
          { label: 'Uso.', text: 'Los puntos ayudan a buscar las obras. No muestran su contorno ni prueban un daño.' },
        ]} />
        <a
          className="compact-link"
          href={STRUCTURES_REPOSITORY}
          target="_blank"
          rel="noreferrer"
        >
          Datos originales <ArrowUpRight />
        </a>
      </details>
    </details>
  );
}
