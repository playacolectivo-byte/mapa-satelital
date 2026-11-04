'use client';
import { useEffect, useMemo } from 'react';
import type { ImageSource } from './imagery-choice';
import { TimelinePill, type ImageInfo } from './timeline-pill';
import {
  sceneContains,
  sentinelDate,
  type SentinelManifest,
  type SentinelScene,
} from '@/lib/sentinel';
import type { Point } from '@/lib/view';
import type { CaptureFrame } from '@/lib/temporal-evidence';
import { calendarYears, MAP_FIRST_YEAR } from '@/lib/calendar-time';

export function SentinelTimeline({
  year,
  onYearChange,
  error,
  manifest,
  selected,
  center,
  status,
  onChange,
  onSource,
  onRetry,
  onInfo,
  onMetadata,
  onFrameChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
  error: boolean;
  manifest: SentinelManifest | null;
  selected: SentinelScene | null;
  center: Point | null;
  status: 'loading' | 'ready' | 'error';
  onChange: (scene: SentinelScene) => void;
  onSource: (source: ImageSource) => void;
  onRetry: () => void;
  onInfo: (info: ImageInfo) => void;
  onMetadata: (info: ImageInfo) => void;
  onFrameChange: (frame: CaptureFrame) => void;
}) {
  const covered = !selected || !center || sceneContains(selected, center);
  const info = useMemo<ImageInfo>(
    () => ({
      title: 'Imagen Sentinel',
      capture: selected
        ? sentinelDate(selected.datetime) +
          ' · ' +
          new Date(selected.datetime).toLocaleTimeString('es-MX', {
            timeZone: 'UTC',
            hour12: false,
          }) +
          ' UTC'
        : 'Sin captura seleccionada',
      captureDate: selected?.datetime.slice(0, 10) ?? null,
      provider: 'Copernicus Sentinel-2 · Microsoft Planetary Computer',
      resolution: '10 m/píxel',
      note: `${selected && Number(selected.datetime.slice(0, 4)) !== year ? 'Año elegido: ' + year + '; se muestra una referencia de ' + selected.datetime.slice(0, 4) + '. ' : ''}${!covered ? 'El centro está fuera de esta escena. ' : ''}Capturas recibidas por año y sector. Ampliar no añade detalle. Marea no incorporada.`,
      url: selected?.metadata_url,
    }),
    [selected, covered, year],
  );
  useEffect(() => {
    onMetadata(info);
  }, [info, onMetadata]);
  useEffect(() => {
    if (selected)
      onFrameChange({
        key: 'sentinel:' + selected.id,
        source: 'sentinel',
        date: selected.datetime.slice(0, 10),
        center,
      });
  }, [selected, center, onFrameChange]);
  return (
    <TimelinePill
      source="sentinel"
      year={String(year)}
      value={Math.max(0, year - MAP_FIRST_YEAR)}
      count={calendarYears(MAP_FIRST_YEAR, new Date().getUTCFullYear()).length}
      label={
        selected
          ? 'Año ' + year + ' · captura ' + sentinelDate(selected.datetime)
          : 'Cargando capturas Sentinel'
      }
      status={error || !covered ? 'error' : status}
      onSource={onSource}
      onChange={(i) => {
        onYearChange(MAP_FIRST_YEAR + i);
      }}
      onRetry={onRetry}
      onInfo={() => onInfo(info)}
    />
  );
}
