'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type WaybackItem, type WaybackMetadata } from '@esri/wayback-core';
import { satellitePixelRatio, type SatelliteDetail } from '@/lib/satellite-detail';
import {analysisPhotoCandidate,esriPhotoMetadataZoom,orderedPhotoHintReleases,ESRI_TEMPORAL_MAX_ZOOM,type PhotoIntent} from '@/lib/esri-photo-options';
import { distinctLocalCaptures, captureIndex, mergePointMetadata, metadataCaptureDate, metadataProbeQueue, PointMetadataProbeQueue, isVerifiedHdYear, type PointProbeJob, type ScopedPointMetadata } from '@/lib/esri-captures';
import { loadReceivedEsriCatalogue, loadEsriEditions, fetchRenderedEsriMetadata,cachedRenderedEsriMetadata,type ReceivedCatalogue } from '@/lib/esri-catalogue';
import {coastalPhotoForYear,type CoastalPhotoOption} from '@/lib/esri-coastal-photos';
import {municipalPhotoOptions,municipalDatedOptions,municipalComparisonOptions,localMetadataBelongsToLocation,type PhotoLocation,type MunicipalPhotoCatalogue} from '@/lib/coastal-photo-scopes';
import municipalCatalogueJson from '@/lib/generated/municipal-photo-refined-catalogue.json';
import receivedCatalogueJson from '@/public/data/history/esri-local-captures.json';
import { ESRI_PROJECT_FIRST_YEAR } from '@/lib/calendar-time';
import { TimelineCache, captureMetadataKey } from '@/lib/timeline-cache';
import type { ImageSource,SourceAvailability } from './imagery-choice';
import { type ImageInfo } from './timeline-pill';
import { DateSourcePicker } from './date-source-picker';
import type { CaptureFrame } from '@/lib/temporal-evidence';
import type { StudyFlight } from '@/lib/study-flight';

const initialPoint: [number, number] = [-89.7429508, 21.275];
const receivedCatalogue=receivedCatalogueJson as unknown as ReceivedCatalogue;
const emptyValues: Record<number, WaybackMetadata> = {};
const emptyErrors: Record<number, true> = {};
const formatDate = (value: string, includeYear = true) => new Date(value + 'T00:00:00Z').toLocaleDateString('es-MX', {
  day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC',
});
type ReceivedSite = { name: string; coordinates: [number, number]; zoom: number; values: Record<number, WaybackMetadata> };
type Props = {
  firstYear?:number;lastYear?:number;scopeKey?:string;sourceAvailability?:SourceAvailability;
  comparisonPeriod?:string;
  displayedInfo?:ImageInfo|null;
  fallbackInfo?:ImageInfo|null;
  onFallbackRetry?:()=>void;
  fallbackLabel?:string;
  referenceYear?:number;
  year: number;
  onYearChange: (year: number) => void;
  onSource: (value: ImageSource) => void;
  active: boolean;
  center: [number, number] | null;
  viewZoom: number;
  detail: SatelliteDetail;
  selected: WaybackItem | null;
  onChange: (item: WaybackItem | null, activate?: boolean) => void;
  photoLocation:PhotoLocation|null;
  compatibleComparison?:boolean;
  scenarioReference?:boolean;
  selectedPhotoYear?:number;
  imageStatus: 'loading' | 'ready' | 'error';
  onInfo: (info: ImageInfo) => void;
  onMetadata: (info: ImageInfo) => void;
  onFrameChange: (frame: CaptureFrame) => void;
  onWarmFrames: (items: WaybackItem[]) => void;
  flightSelected: StudyFlight | null;
  onFlightChange: (flight: StudyFlight | null) => void;
  localCaptureDates: Record<string, string> | null;
  flights: StudyFlight[];
};

export function SatelliteTimeline({ firstYear=ESRI_PROJECT_FIRST_YEAR,lastYear=new Date().getUTCFullYear(),scopeKey,sourceAvailability,comparisonPeriod,displayedInfo, year, onYearChange, onSource, active, center, viewZoom, detail, selected, onChange,photoLocation,compatibleComparison=false,scenarioReference=false,selectedPhotoYear, imageStatus, onInfo, onMetadata, onFrameChange, onWarmFrames, flightSelected }: Props) {
  const [point, setPoint] = useState(initialPoint);
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<WaybackItem[]>(receivedCatalogue.items);
  const [sites, setSites] = useState<ReceivedSite[]>(receivedCatalogue.sites);
  const [metadataCache] = useState(() => new TimelineCache<WaybackMetadata>(512));
  const [probes] = useState(() => new PointMetadataProbeQueue<WaybackMetadata>());
  const [viewMetadata, setViewMetadata] = useState<ScopedPointMetadata | null>(null);
  const [catalogueState, setCatalogueState] = useState<{ key: string; status: 'ready' | 'error' } | null>(null);
  const [offeredScope, setOfferedScope] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<{ key: string; status: 'loading' | 'ready' | 'error' } | null>(null);
  const bootstrapped = useRef(false);
  const metadataZoom=esriPhotoMetadataZoom(viewZoom,satellitePixelRatio());
  const manualPhoto=useRef<PhotoIntent|null>(null);
  const [requestedPhoto,setRequestedPhoto]=useState<PhotoIntent|null>(null);
  const analysisRequest=useRef({year,chapter:scopeKey??'current'});
  useLayoutEffect(()=>{
    if(manualPhoto.current&&(manualPhoto.current.year!==year||manualPhoto.current.chapter!==(scopeKey??'current')))manualPhoto.current=null;
  },[year,scopeKey]);
  const longitude = center?.[0] ?? point[0], latitude = center?.[1] ?? point[1];
  const releaseNum = selected?.releaseNum;
  const viewKey = `${longitude},${latitude}:${metadataZoom}`;
  const scope = `${viewKey}:attempt-${attempt}`;
  const currentView = useRef<string | null>(null);
  useLayoutEffect(() => { currentView.current = active && !flightSelected ? viewKey : null; }, [active, flightSelected, viewKey]);
  const metadataKey = releaseNum === undefined ? '' : captureMetadataKey(releaseNum, longitude, latitude, metadataZoom);
  const values = viewMetadata?.key === viewKey ? viewMetadata.values : emptyValues;
  const errors = viewMetadata?.key === viewKey ? viewMetadata.errors : emptyErrors;
  const metadata = releaseNum === undefined ? null : values[releaseNum] ?? metadataCache.peek(metadataKey) ?? null;
  const catalogueKey = 'shared-edition-catalogue';
  const callbacks = useRef({ selected, flightSelected, onChange,onYearChange });
  useLayoutEffect(() => { callbacks.current = { selected, flightSelected, onChange,onYearChange }; }, [selected, flightSelected, onChange,onYearChange]);

  useEffect(() => {
    if (!active || Math.hypot(longitude - point[0], latitude - point[1]) < 0.06) return;
    const timer = window.setTimeout(() => setPoint([longitude, latitude]), 650);
    return () => window.clearTimeout(timer);
  }, [active, longitude, latitude, point]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let stopped = false;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    function mergeAvailable(available: WaybackItem[]) {
      if (stopped) return;
      const today = new Date().toISOString().slice(0, 10);
      const received = available.filter((item) => item.releaseDateLabel <= today);
      if (!received.length) return;
      setItems((previous) => {
        const next = [...new Map([...previous, ...received].map((item) => [item.releaseNum, item])).values()].sort((a, b) => a.releaseDateLabel.localeCompare(b.releaseDateLabel));
        return previous.length === next.length && previous.every((item, index) => item.releaseNum === next[index].releaseNum && item.itemURL === next[index].itemURL) ? previous : next;
      });
      setCatalogueState({ key: catalogueKey, status: 'ready' });
      // Bootstrap once so the selected edition's point metadata can resolve.
      // Neither a late catalogue nor point metadata may replace a user's map.
      if (!callbacks.current.selected && !callbacks.current.flightSelected && !bootstrapped.current) {
        bootstrapped.current = true;
        const newest = [...receivedCatalogue.items].filter(item=>item.releaseDateLabel<=today).sort((a, b) => b.releaseDateLabel.localeCompare(a.releaseDateLabel))[0]??received[0];
        callbacks.current.onChange(newest, false);
      }
    }
    const received = loadReceivedEsriCatalogue(controller.signal).then(data=>{if(!stopped)setSites(data.sites);mergeAvailable(data.items);return data.items;});
    const official = loadEsriEditions(controller.signal).then(available=>{mergeAvailable(available);return available;});
    void Promise.allSettled([received,official]).then(results=>{
      if(!stopped && results.every(result=>result.status==='rejected'))setCatalogueState({key:catalogueKey,status:'error'});
    }).finally(()=>window.clearTimeout(timeout));
    return () => { stopped = true; controller.abort(); window.clearTimeout(timeout); };
  }, [active, attempt]);

  // Received dates apply only to the exact audited point and zoom.
  useEffect(() => {
    const exact = sites.find((site) => site.zoom === metadataZoom && Math.abs(site.coordinates[0] - longitude) < 1e-7 && Math.abs(site.coordinates[1] - latitude) < 1e-7);
    if (!exact) return;
    for (const [release, value] of Object.entries(exact.values)) {
      void metadataCache.load(captureMetadataKey(Number(release), longitude, latitude, metadataZoom), () => Promise.resolve(value)).then((cached) => {
        setViewMetadata((previous) => mergePointMetadata(previous, currentView.current, { viewKey, release: Number(release), value: cached }));
      });
    }
  }, [sites, longitude, latitude, metadataZoom, viewKey, metadataCache]);

  const availableItems = useMemo(() => selected && !items.some((item) => item.releaseNum === selected.releaseNum) ? [...items, selected] : items, [items, selected]);
  const preferredReleases = useMemo(() => {
    const nearest = [...sites].sort((a, b) => Math.hypot(a.coordinates[0] - longitude, a.coordinates[1] - latitude) - Math.hypot(b.coordinates[0] - longitude, b.coordinates[1] - latitude))[0];
    return nearest ? orderedPhotoHintReleases(nearest.values) : [];
  }, [sites, longitude, latitude]);
  const ordered = useMemo(() => metadataProbeQueue(availableItems, releaseNum, preferredReleases), [availableItems, releaseNum, preferredReleases]);

  useEffect(() => {
    if (!active || flightSelected) { probes.activate(null); return; }
    probes.activate(scope, (state) => setQueueState((previous) => previous?.key === scope && previous.status === state.status ? previous : { key: scope, status: state.status }));
    // Individual queries retain their deadlines and the bounded request pool.
    return () => probes.activate(null);
  }, [active, flightSelected, scope, probes]);
  useEffect(() => {
    if (!active || flightSelected || !ordered.length) return;
    const publish = (release: number, value: WaybackMetadata | null) => {
      setViewMetadata((previous) => mergePointMetadata(previous, currentView.current, { viewKey, release, value }));
    };
    const jobs: PointProbeJob<WaybackMetadata>[] = [];
    // Hydrate all previously received dates, including editions beyond the
    // bounded network batch. A reload cannot truncate the menu at its first hit.
    for(const item of availableItems){
      const key=captureMetadataKey(item.releaseNum,longitude,latitude,metadataZoom);
      const saved=metadataCache.peek(key)??cachedRenderedEsriMetadata(item,longitude,latitude,metadataZoom);
      if(saved)publish(item.releaseNum,saved);
    }
    for (const item of ordered) {
      const key = captureMetadataKey(item.releaseNum, longitude, latitude, metadataZoom);
      const cached = metadataCache.peek(key)??cachedRenderedEsriMetadata(item,longitude,latitude,metadataZoom);
      if (cached) {
        void metadataCache.load(key, () => Promise.resolve(cached)).then((value) => publish(item.releaseNum, value));
        continue;
      }
      jobs.push({ key,
        read: signal => metadataCache.load(key, () => fetchRenderedEsriMetadata(item, longitude, latitude, metadataZoom, signal),signal),
        onValue: (value) => publish(item.releaseNum, value),
        onError: () => setViewMetadata((previous) => mergePointMetadata(previous, currentView.current, { viewKey, release: item.releaseNum, error: true })),
      });
    }
    // Existing exact-point SDK calls only. No bbox, footprints or spatial grid.
    // Feed the same ledger; catalogue/selection updates never restart its budget.
    const timer = window.setTimeout(() => { setOfferedScope(scope); probes.offer(scope, jobs); }, 400);
    return () => window.clearTimeout(timer);
  }, [active, flightSelected, ordered, availableItems, scope, viewKey, longitude, latitude, metadataZoom, metadataCache, probes]);
  useEffect(() => () => probes.dispose(), [probes]);

  const captures = useMemo(() => distinctLocalCaptures(availableItems, values).filter(capture=>isVerifiedHdYear(capture.year,capture.year,capture.date,capture.metadata.resolution)), [availableItems, values]);
  const comparisonOptions=useMemo(()=>compatibleComparison?(scenarioReference?municipalDatedOptions:municipalComparisonOptions)(availableItems,municipalCatalogueJson as unknown as MunicipalPhotoCatalogue,photoLocation?.municipality??null,photoLocation?.coordinates??initialPoint,17,photoLocation?.coordinates).filter(value=>value.year>=firstYear&&value.year<=lastYear):[],[compatibleComparison,scenarioReference,availableItems,photoLocation,firstYear,lastYear]);
  const browsingOptions=useMemo(()=>compatibleComparison?[]:municipalPhotoOptions(availableItems,municipalCatalogueJson as unknown as MunicipalPhotoCatalogue,photoLocation?.municipality??null,[longitude,latitude],metadataZoom,localMetadataBelongsToLocation([longitude,latitude],photoLocation,sites)?captures:[]).filter(value=>value.year>=firstYear&&value.year<=lastYear),[compatibleComparison,availableItems,photoLocation,longitude,latitude,metadataZoom,sites,captures,firstYear,lastYear]);
  const datedOptions=compatibleComparison?comparisonOptions:browsingOptions;
  const checking = offeredScope !== scope || queueState?.key !== scope || queueState.status === 'loading';
  const stops = captures;
  const captureDate = flightSelected?.date ?? metadataCaptureDate(metadata);
  const datedReference=compatibleComparison?datedOptions.find(option=>option.item.releaseNum===releaseNum&&option.year===(scenarioReference?selectedPhotoYear??year:year)):null;
  const exactYear = Number(captureDate?.slice(0,4)) === year;
  const selectedIndex = captureIndex(stops, captureDate);
  const partialFailure=!!captureDate && queueState?.key===scope && queueState.status==='error';
  const failed = !exactYear && (!!(releaseNum !== undefined && errors[releaseNum]) || queueState?.key === scope && queueState.status === 'error' || catalogueState?.key === catalogueKey && catalogueState.status === 'error');
  const capture = captureDate ? formatDate(captureDate) : datedReference ? formatDate(datedReference.date)+' · referencia local' : failed ? 'No se pudo consultar la fecha al centro' : checking ? 'Consultando captura al centro…' : 'Sin fecha publicada al centro a esta escala';
  const enlarged = viewZoom > (detail.nativeZoom??ESRI_TEMPORAL_MAX_ZOOM)-(satellitePixelRatio()>1?1:0)+0.05;
  const title = flightSelected?.title ?? 'Esri · captura al centro';
  const edition = flightSelected ? undefined : selected?.releaseDateLabel;
  const provider = flightSelected?.attribution ?? (metadata ? `${metadata.provider} · ${metadata.source}` : 'Esri World Imagery / Wayback');
  const resolution = flightSelected?.resolution ?? (metadata?.resolution ? `${metadata.resolution} m/píxel declarado` : 'Resolución en consulta');
  const imageNote = flightSelected?.note ?? `${!captureDate&&datedReference?'La fecha de referencia corresponde a un punto revisado de esta zona; la fecha al centro no está confirmada a esta escala. ':''}${year !== Number(captureDate?.slice(0, 4)) && captureDate ? 'Año de análisis elegido: ' + year + '; fotografía al centro: ' + captureDate.slice(0, 4) + '. ' : ''}${enlarged ? 'La imagen ya está ampliada más allá de su detalle disponible. ' : ''}El menú corresponde a ${photoLocation?photoLocation.municipality:'la zona elegida en Explorar toda la costa'}. Cambiar el año conserva la posición y el zoom. Las fechas se verificaron en puntos de esa zona; pueden variar dentro del municipio y según la escala. No certifican cobertura completa del mismo año ni medición de erosión. Esri y sus proveedores conservan la atribución.`;
  const imageUrl = flightSelected?.sourceUrl ?? 'https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata';
  const info: ImageInfo = { frameKey:releaseNum===undefined?undefined:'esri:'+releaseNum,pointScope:viewKey,title, capture, captureDate, edition, provider, resolution, resolutionMeters:metadata?.resolution, note: imageNote, url: imageUrl, queryPending: checking, queryFailed:failed, requestedYear: year };
  useEffect(() => {
    if (active) onMetadata({ frameKey:releaseNum===undefined?undefined:'esri:'+releaseNum,pointScope:viewKey,title, capture, captureDate, edition, provider, resolution, resolutionMeters:metadata?.resolution, note: imageNote, url: imageUrl, queryPending: checking, queryFailed:failed, requestedYear: year });
  }, [active, title, capture, captureDate, edition, provider, resolution, metadata?.resolution, imageNote, imageUrl, checking, failed, year, releaseNum,viewKey,onMetadata]);
  useEffect(() => {
    // Transport key stays compatible with the renderer; dated slider identity
    // is capture.key. Refining metadata never swaps the selected edition.
    if (active && releaseNum !== undefined && !flightSelected) onFrameChange({ key: 'esri:' + releaseNum, source: 'esri', date: captureDate, center: [longitude, latitude] });
  }, [active, releaseNum, captureDate, longitude, latitude, onFrameChange, flightSelected]);
  const comparisonIndex=datedOptions.findIndex(option=>option.year===(scenarioReference?selectedPhotoYear??year:year));
  const warmItem=compatibleComparison?(datedOptions[comparisonIndex+1]??datedOptions[comparisonIndex-1])?.item:selectedIndex===null?undefined:stops[selectedIndex+1]?.item??stops[selectedIndex-1]?.item;
  useEffect(() => {
    onWarmFrames([]);
    if (!active || imageStatus !== 'ready' || !warmItem) return;
    const timer = window.setTimeout(() => onWarmFrames([warmItem]), 250);
    return () => window.clearTimeout(timer);
  }, [active, imageStatus, warmItem, viewKey, onWarmFrames]);

  // Calendar identity is global and never changes with local availability.
  // An exact local acquisition is required; no earlier/later year's fallback.

  const selectCapture=useCallback((capture:CoastalPhotoOption,changeYear=true)=>{
    if(compatibleComparison){bootstrapped.current=true;if(changeYear)callbacks.current.onYearChange(capture.year);return;}
    const intent={chapter:scopeKey??'current',year:capture.year,date:capture.date,release:capture.item.releaseNum};
    bootstrapped.current=true;manualPhoto.current=intent;setRequestedPhoto(intent);
    callbacks.current.onChange(capture.item,false);
    if(changeYear)callbacks.current.onYearChange(capture.year);
  },[scopeKey,setRequestedPhoto,compatibleComparison]);
  useEffect(()=>{
    const previous=analysisRequest.current,chapter=scopeKey??'current';analysisRequest.current={year,chapter};
    if(!active||flightSelected||compatibleComparison)return;
    if(!compatibleComparison&&previous.chapter===chapter&&previous.year===year)return;
    if(!compatibleComparison&&manualPhoto.current?.chapter===chapter&&manualPhoto.current.year===year)return;
    const exact=coastalPhotoForYear(datedOptions,year,[longitude,latitude]);
    if(exact&&selected?.releaseNum!==exact.item.releaseNum){
      bootstrapped.current=true;
      callbacks.current.onChange(exact.item,false);
    }
  },[active,year,scopeKey,datedOptions,flightSelected,longitude,latitude,compatibleComparison,selected?.releaseNum]);
  const candidate=analysisPhotoCandidate(datedOptions.filter(value=>value.local),year,captureDate,scopeKey??'current',requestedPhoto,{first:firstYear,last:lastYear});
  const candidateRelease = candidate?.item.releaseNum;
  useEffect(() => {
    if (!active || compatibleComparison || flightSelected || candidateRelease === undefined) return;
    if(manualPhoto.current?.chapter===(scopeKey??'current')&&manualPhoto.current.year===year)return;
    if (selected?.releaseNum !== candidateRelease && candidate) onChange(candidate.item, false);
  }, [active,compatibleComparison, flightSelected, candidateRelease, candidate, selected?.releaseNum, onChange,scopeKey,year]);
  const shown=displayedInfo?.captureDate;
  const referenceNote=displayedInfo?'Análisis '+year+' · '+(shown?'Foto '+formatDate(shown):displayedInfo.capture):'Análisis '+year+' · fecha de la imagen en consulta';
  const selectedDate=requestedPhoto?.chapter===(scopeKey??'current')&&requestedPhoto.year===year&&requestedPhoto.release===releaseNum?requestedPhoto.date:captureDate;
  const photoYears=[...new Set(datedOptions.map(value=>value.year))];
  const pointYear=Number(captureDate?.slice(0,4));
  const pointMismatch=!!photoLocation&&!!captureDate&&pointYear!==year&&imageStatus==='ready';
  return <DateSourcePicker source="detail" value={compatibleComparison?String(scenarioReference?selectedPhotoYear??year:year):selectedDate?.slice(0,4)??''}
    options={photoYears.map(value=>({value:String(value),label:String(value)}))}
    label={photoLocation?'Años de '+photoLocation.municipality:'Elige un municipio'} availability={sourceAvailability} status={imageStatus}
    emptyLabel={photoLocation?'Sin comparación compatible en este periodo':'Selecciona un municipio'}
    caption={(photoLocation?photoLocation.municipality+' · ':'')+(comparisonPeriod?'Estudio '+comparisonPeriod+' · '+referenceNote:referenceNote)}
    notice={!photoLocation?scenarioReference?'Resultados en toda la costa. Elige un municipio para consultar sus fotos.':'Elige un municipio para comparar.':pointMismatch?scenarioReference?'Análisis '+year+' · foto de '+pointYear+'. Los trazos discontinuos muestran estimaciones con referencia fija.':'Foto al centro: '+pointYear+'. Las barras sólo aparecen donde la captura coincide con '+year+'.':partialFailure||failed?<>No se pudo consultar la fecha al centro. <button onClick={()=>{probes.retry();setAttempt(n=>n+1);}}>Reintentar</button></>:undefined}
    onDate={value=>{const next=coastalPhotoForYear(datedOptions,Number(value),[longitude,latitude]);if(next)selectCapture(next);}}
    onSource={onSource} onInfo={()=>onInfo(displayedInfo??info)}
    onRetry={()=>{probes.retry();setAttempt(value=>value+1);if(selected)onChange({...selected});else bootstrapped.current=false;}}
  />;
}
