'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ImageryChoice, type ImageSource, type SourceAvailability } from './imagery-choice';
import { SettledSelection } from '@/lib/settled-selection';
import { timelineIndex } from '@/lib/calendar-time';

export type ImageInfo = {
  frameKey?: string;
  pointScope?:string;
  title: string;
  capture: string;
  captureDate?: string | null;
  queryPending?: boolean;
  queryFailed?: boolean;
  requestedYear?: number;
  edition?: string;
  provider: string;
  resolution: string;
  resolutionMeters?: number | null;
  note: string;
  url?: string;
};

export function TimelinePill({
  source,
  year,
  value,
  count,
  label,
  status,
  onChange,
  onSource,
  onInfo,
  onRetry,
  detailLabel,
  onScrubChange,
  rangeLabel,
  infoLabel = 'Información de la imagen',
  captureLabel,
  selectionScopeKey,
  commitOnRelease = false,
  onPreviewIndex,
  notice,
  yearAtIndex,
  rangeStartLabel,
  rangeEndLabel,
  rangeDescription,
  sourceAvailability,
  sourceControls,
}: {
  source: ImageSource;
  year: string;
  value: number | null;
  count: number;
  label: string;
  status: 'loading' | 'ready' | 'error';
  onChange: (index: number) => void;
  onSource: (source: ImageSource) => void;
  onInfo: () => void;
  onRetry?: () => void;
  detailLabel?: string;
  onScrubChange?: (scrubbing: boolean) => void;
  rangeLabel?: string;
  infoLabel?: string;
  captureLabel?: string;
  selectionScopeKey?: string;
  commitOnRelease?: boolean;
  onPreviewIndex?: (index: number) => void;
  notice?: ReactNode;
  yearAtIndex?: (index: number) => string;
  rangeStartLabel?: string;
  rangeEndLabel?: string;
  rangeDescription?: string;
  sourceAvailability?:SourceAvailability;
  sourceControls?:ReactNode;
}) {
  const [settler] = useState(()=>new SettledSelection());
  const [queuedIndex,setQueuedIndex]=useState<number|null>(null);
  const pointer = useRef<number | null>(null);
  const animation = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const sent = useRef(value);
  const dragCount = useRef(count);
  const [draft, setDraft] = useState<{ index: number; count: number; pointer: number | null; source: ImageSource; scope: string | undefined; externalValue: number | null; externalCount: number } | null>(null);
  const [draftScope,setDraftScope]=useState({source,selectionScopeKey});
  if(draftScope.source!==source || draftScope.selectionScopeKey!==selectionScopeKey){setDraftScope({source,selectionScopeKey});setDraft(null);setQueuedIndex(null);}
  const change = useRef(onChange);
  const scrub = useRef(onScrubChange);
  useLayoutEffect(() => { change.current = onChange; scrub.current = onScrubChange; }, [onChange, onScrubChange]);
  useEffect(() => {
    if (pointer.current === null) {
      sent.current = value === null ? null : timelineIndex(value, count);
    }
  }, [value, count]);
  useEffect(() => {
    settler.cancel();
    pending.current = null;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    if (pointer.current !== null) {
      pointer.current = null;
      scrub.current?.(false);
    }
  }, [source, selectionScopeKey, settler]);
  useEffect(
    () => () => {
      settler.cancel();
      if (animation.current !== null) cancelAnimationFrame(animation.current);
    },
    [settler],
  );
  function emit(index: number, force = false, released = false) {
    pending.current = null;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    const next = timelineIndex(index, pointer.current === null ? count : dragCount.current);
    setDraft({ index: next, count: dragCount.current, pointer: released ? null : pointer.current, source, scope: selectionScopeKey, externalValue: value, externalCount: count });
    if (!force && next === sent.current) return;
    sent.current = next;
    // One settled selection drives data, metadata and tiles. Preview remains
    // immediate; rapid release/key sequences never start intermediate loads.
    setQueuedIndex(next);
    onPreviewIndex?.(next);
    settler.request(next, selected=>{change.current(selected);setQueuedIndex(null);scrub.current?.(false);});
  }
  function position(event: PointerEvent<HTMLInputElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (event.clientX - box.left - 6) / Math.max(1, box.width - 12)),
    );
    return Math.round(fraction * Math.max(0, dragCount.current - 1));
  }
  function preview(index: number) {
    const next = timelineIndex(index, dragCount.current);
    pending.current = next;
    setDraft((previous) => previous?.index === next && previous.pointer === pointer.current ? previous : { index: next, count: dragCount.current, pointer: pointer.current, source, scope: selectionScopeKey, externalValue: value, externalCount: count });
    onPreviewIndex?.(next);
  }
  function schedule(index: number) {
    pending.current = timelineIndex(index, count);
    if (animation.current !== null) return;
    // One selection per paint. Do not replay every intervening year after a
    // drag; all annual stops remain selectable and arrow keys still move by 1.
    animation.current = requestAnimationFrame(() => {
      animation.current = null;
      if (pending.current !== null) emit(pending.current);
    });
  }
  const currentDraft = draft?.source === source && draft.scope === selectionScopeKey ? draft : null;
  const dragging = currentDraft !== null && currentDraft.pointer !== null;
  const optimistic = currentDraft && (dragging || queuedIndex!==null || !commitOnRelease && currentDraft.externalValue === value && currentDraft.externalCount === count);
  const displayCount = dragging ? currentDraft.count : count;
  const requestedIndex = optimistic ? currentDraft.index : value;
  const displayIndex = requestedIndex === null ? null : timelineIndex(requestedIndex, displayCount);
  const previewYear = (dragging || queuedIndex!==null) && yearAtIndex && displayIndex !== null ? yearAtIndex(displayIndex) : null;
  const displayYear = previewYear ?? year;
  const displayLabel = previewYear ? (dragging?'Suelta para ver el fondo de ':'Preparando el año ') + previewYear : label;
  return (
    <section
      className="timeline-pill"
      aria-label="Línea del tiempo"
      aria-busy={status === 'loading' || dragging || queuedIndex!==null}
      data-selection-phase={dragging?'preview':queuedIndex!==null?'settling':'committed'}
      data-year={displayYear}
      data-timeline-count={count}
      data-timeline-index={displayIndex}
      data-selection-state={displayIndex === null ? 'unresolved' : 'located'}
    >
      {sourceControls??<ImageryChoice
        value={source}
        onChange={nextSource=>{
          settler.cancel();setQueuedIndex(null);setDraft(null);pointer.current=null;sent.current=value;
          scrub.current?.(false);onSource(nextSource);
        }}
        detailLabel={detailLabel}
        availability={sourceAvailability}
      />}
      <span className="timeline-divider" aria-hidden="true" />
      <button
        className="timeline-year"
        title={displayLabel + ' · ' + infoLabel}
        aria-label={displayLabel + '. ' + infoLabel}
        onClick={onInfo}
      >
        <span
          className="timeline-year-number"
          aria-live="polite"
          aria-atomic="true"
        >
          {displayYear}
        </span>
        {captureLabel && !previewYear && <span className="timeline-capture-day" style={{ display: 'block', fontSize: 10, lineHeight: 1.15, whiteSpace: 'nowrap', marginTop: 3 }}>{captureLabel}</span>}
      </button>
      <fieldset className="timeline-track" aria-label={rangeDescription ?? 'Selección de fecha'}>
      {rangeDescription && <legend className="timeline-range-description">{rangeDescription}</legend>}
      <input
        className="timeline-range"
        type="range"
        min={0}
        max={Math.max(0, displayCount - 1)}
        step={1}
        value={displayIndex ?? 0}
        data-selection-state={displayIndex === null ? 'unresolved' : 'located'}
        disabled={displayCount < 1 || displayCount === 1 && displayIndex !== null}
        aria-label={
          rangeLabel ?? (source === 'detail' ? 'Imagen histórica Esri' : source === 'archive' ? 'Año del mapa con fondo de archivo' : 'Captura Sentinel')
        }
        aria-valuetext={displayIndex === null ? 'La fecha actual aún no está ubicada en estas capturas. ' + displayLabel : displayLabel}
        onPointerDown={(event) => {
          if (event.button !== 0 || count < 1) return;
          event.preventDefault();
          settler.cancel();setQueuedIndex(null);
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = event.pointerId;
          dragCount.current = count;
          onScrubChange?.(true);
          if (commitOnRelease) preview(position(event));
          else emit(position(event));
        }}
        onPointerMove={(event) => {
          if (pointer.current === event.pointerId) {
            if (commitOnRelease) preview(position(event));
            else schedule(position(event));
          }
        }}
        onPointerUp={(event) => {
          if (pointer.current !== event.pointerId) return;
          emit(position(event), commitOnRelease, true);
          pointer.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          onScrubChange?.(false);
        }}
        onPointerCancel={() => {
          settler.cancel();setQueuedIndex(null);sent.current=value;
          pointer.current = null;
          if (animation.current !== null)
            cancelAnimationFrame(animation.current);
          animation.current = null;
          pending.current = null;
          setDraft(null);
          onScrubChange?.(false);
        }}
        onLostPointerCapture={() => {
          if (pointer.current === null) return;
          settler.cancel();setQueuedIndex(null);sent.current=value;
          pointer.current = null;
          if (animation.current !== null)
            cancelAnimationFrame(animation.current);
          animation.current = null;
          pending.current = null;
          setDraft(null);
          onScrubChange?.(false);
        }}
        onChange={(event) => pointer.current !== null && commitOnRelease ? preview(Number(event.target.value)) : emit(Number(event.target.value))}
        onKeyDown={(event) => {
          if(pointer.current!==null){event.preventDefault();return;}
          const delta = ['ArrowRight', 'ArrowUp', 'PageUp'].includes(event.key) ? 1
            : ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key) ? -1 : 0;
          if (!delta && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          // Home/End are explicit selections, even while the current capture's
          // metadata is unresolved and the controlled thumb temporarily sits at 0.
          if (count < 1) return;
          emit(event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
            : sent.current === null ? (delta < 0 ? count - 1 : 0) : sent.current + delta,
            event.key === 'Home' || event.key === 'End' || sent.current === null);
        }}
      />
      {(rangeStartLabel || rangeEndLabel) && <span className="timeline-endpoints">
        <span>{rangeStartLabel}</span><span>{rangeEndLabel}</span>
      </span>}
      </fieldset>
      <button
        className={'timeline-state is-' + status}
        aria-label={
          status === 'error'
            ? 'Error de imagen. Reintentar'
            : status === 'loading'
              ? 'Cargando imagen'
              : infoLabel
        }
        title={status === 'error' ? 'Reintentar' : label}
        onClick={status === 'error' && onRetry ? onRetry : onInfo}
      >
        <span />
      </button>
      {(previewYear || notice || status !== 'ready') && (
        <output className="timeline-loading-note">
          {previewYear ? dragging?'Suelta para ver este año':'Preparando el año '+previewYear : notice ?? (status === 'error'
            ? 'Imagen incompleta · reintentar'
            : year === '—'
              ? 'Consultando fecha…'
              : 'Cargando imagen…')}
        </output>
      )}
    </section>
  );
}
