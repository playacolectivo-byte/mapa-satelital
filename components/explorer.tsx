'use client';
import {hasPcAnnualBackdrop} from '@/lib/pc-annual-backdrop';
import {usePcAnnualBackdrop} from '@/lib/use-pc-annual-backdrop';
import {annualBackdropForYear,type AnnualBackdrop} from '@/lib/annual-backdrop';
import { retainDatedEsriDuringProbe, isVerifiedHdYear } from '@/lib/esri-captures';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Minus,
  Plus,
  LocateFixed,
  Waves,
  ArrowUpRight,
  Image as ImageIcon,
} from 'lucide-react';
import type { WaybackItem } from '@esri/wayback-core';
import { Button } from '@/components/ui/button';
import { fetchJsonAsset } from '@/lib/data-delivery';
import {getMunicipalJson,scopeAsset,municipalityHref,type MunicipalityScope} from '@/lib/municipal-pages';
import {RoadKilometreSearch} from './road-kilometre-search';
import type {RoadSearchRecord} from '@/lib/road-search';
import municipalityPages from '@/lib/generated/municipality-pages.json';
import {validateCoastalScenario,type CoastalScenario} from '@/lib/coastal-scenario';
import {SCENARIO_YEARS,scenarioReferencePhoto,type CoastalResultView} from '@/lib/coastal-result-view';
import {createCoastalImageAlignment} from '@/lib/coastal-image-alignment';
import {applyCoastal100mGrid,type Coastal100mGrid} from '@/lib/coastal-100m-grid';
import coastal100mGrid from '@/public/data/shorelines/photo-alignment/coastal-100m-grid-20261106.json';
import {photoCoastComparison,compatiblePhotoCoastLayer,displayedPhotoCoastPresentation,validatePhotoCoast,type PhotoCoastPresentation,type PhotoCoastData} from '@/lib/photo-coast';
import photoCoastVersion from '@/lib/generated/photo-coast-revised-version.json';
import photoVisualReview from '@/public/data/shorelines/photo-alignment/revised-visual-review.json';
import photoSourceReviewJson from '@/public/data/shorelines/photo-alignment/revised-source-review.json';
import {compatibleSourceLayer,type PhotoSourceReview} from '@/lib/photo-source-review';
import {applyPhotoVisualReview} from '@/lib/photo-visual-review';
import {applyPhotoDigitization,type PhotoDigitization} from '@/lib/photo-digitization';
import photoDigitization from '@/public/data/shorelines/photo-alignment/manual-digitization-20261103.json';
import westProgresoReview from '@/public/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json';
import userShorelineGuides from '@/public/data/shorelines/photo-alignment/user-guides-2011-20261105.json';
import {applyUserShorelineGuides,type UserShorelineGuides} from '@/lib/user-shoreline-guides';
import {projectCoastLabel} from '@/lib/project-coast-labels';
import {applyPhotoPilotReview,type PhotoPilotReview} from '@/lib/photo-pilot-review';
import scenarioVersion from '@/lib/generated/coastal-scenario-version.json';
import { loadMangroveYear } from '@/lib/mangrove-map';
import { validateRoadKilometres, type RoadKilometres } from '@/lib/road-kilometres';
import { TerritoryMap, type MapHandle } from './territory-map';
import { FloatingPanel } from './floating-panel';
import { SatelliteTimeline } from './satellite-timeline';
import { SentinelTimeline } from './sentinel-timeline';
import { ExplanationPoints } from './explanation-points';
import { LittoralTimeline, LittoralPilotPanel, LittoralLegend, LittoralBackgroundDate } from './littoral-pilot';
import { validateLittoralSeries, littoralCutForYear, littoralYearBounds, littoralMapData, littoralAxisData, littoralChangeLabels, littoralMapPoints, littoralRuler, type LittoralSeries } from '@/lib/littoral-series';
import { datedChoiceForYear } from '@/lib/calendar-time';
import { createTransectIndex, barFootprint } from '@/lib/transect-pairs';
import { createEvolutionIndex, evolutionMapData, evolutionComparison, evolutionRuler, evolutionBarLabels, validateEvolutionCatalogue, type EvolutionCatalogue } from '@/lib/coastal-evolution';
import { CoastalEvolutionDetails, CoastalEvolutionLegend } from './coastal-evolution';
import { validateHistoricalManifest, historicalEpochForYear, historicalEpochBounds, historicalEpochCovered, combineHistoricalManifests, type HistoricalManifest, type ArchiveKind } from '@/lib/history';
import { CoastalAnalysisControls } from './coastal-analysis-controls';
import {CoastalCoverageSummary} from './coastal-coverage-summary';
import {assessmentCoverage,municipalCoverage,type SeriesManifest,type CoverageYears} from '@/lib/coastal-coverage';
import {CoastalPeriodSections,type CoastalChapter} from './coastal-period-sections';
import {municipalPhotoYears,municipalDatedOptions,municipalComparisonOptions,municipalComparisonYears,compatibleAnalysisYear,municipalPhotoLocation,type PhotoLocation,type MunicipalPhotoCatalogue} from '@/lib/coastal-photo-scopes';
import reviewedMunicipalPhotoCatalogueJson from '@/lib/generated/municipal-photo-reviewed-catalogue.json';
import {CoastalPlacePicker} from './coastal-place-picker';
import receivedPhotoCatalogueJson from '@/public/data/history/esri-local-captures.json';
import {chapterBounds,initialChapterYears,withChapterYear} from '@/lib/coastal-chapters';
const municipalPhotoCatalogueJson=reviewedMunicipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue;
const HistoricalDocumentViewer=lazy(()=>import('./historical-document-viewer').then(module=>({default:module.HistoricalDocumentViewer})));
const HistoricalErosionSummary=lazy(()=>import('./historical-erosion-summary').then(module=>({default:module.HistoricalErosionSummary})));
import { loadCoastalLayer, peekCoastalLayer, type CoastalAnalysisData, type ShorelinePair } from '@/lib/coastal-analysis';
import { ArchiveControls } from './archive-controls';
import { validateCoverageRegistry, qualifiedHistoricalManifest, completeYearReview, type HistoricalCoverageRegistry } from '@/lib/history-coverage';
import { historicalContextForYear } from '@/lib/historical-context';
import { validateAlecTrends, type AlecTrendCatalogue } from '@/lib/alec-trend';
import { createEvolutionSpatialIndex, evolutionInventoryInView } from '@/lib/evolution-viewport';
import { geometryBounds, type Bounds } from '@/lib/view';
import { DateSourcePicker } from './date-source-picker';
import { useSatelliteDetail } from '@/lib/satellite-detail';
import {esriPhotoMetadataZoom,ESRI_TEMPORAL_MAX_ZOOM} from '@/lib/esri-photo-options';
import {cachedRenderedEsriMetadata} from '@/lib/esri-catalogue';
import {satellitePixelRatio} from '@/lib/satellite-detail';
import { initialIssues, type IssueVisibility } from '@/lib/coastal-issues';
import type {
  MapConfig,
  Source,
  TerritoryData,
  Visibility,
  Place,
} from '@/lib/territory';
import {
  researchSeries,
  publishedPeriodForYear,
  selectPublishedPeriod,
  type ErosionData,
  type ErosionFeature,
  type ResearchSeries,
} from '@/lib/problems';
import type { ImageSource } from './imagery-choice';
import type { ImageInfo } from './timeline-pill';
import type { SentinelManifest } from '@/lib/sentinel';
import { coastalViews, CHELEM_PROGRESO_OVERVIEW } from '@/lib/coastal-views';
import {
  createTemporalEvidenceResolver,
  studyMatchesCapture,
  type CaptureFrame,
  type TemporalRegistry,
} from '@/lib/temporal-evidence';
import {
  isEvidenceData,
  type EvidenceKind,
  type EvidenceLayers,
  type EvidenceSelection,
  type EvidenceData,
} from '@/lib/map-evidence';
import {
  mangroveComparisonForYear,
  type MangroveManifest,
} from '@/lib/mangrove-history';
import {
  isStructureData,
  structureView,
  type StructureData,
  type StructureFeature,
  type StructureFilter,
} from '@/lib/coastal-structures';

const EvidencePanel = lazy(() =>
  import('./evidence-panel').then((m) => ({ default: m.EvidencePanel })),
);
const ProblemsPanel = lazy(() =>
  import('./problems-panel').then((m) => ({ default: m.ProblemsPanel })),
);
const EarthPanel = lazy(() =>
  import('./earth-panel').then((m) => ({ default: m.EarthPanel })),
);
type Panel = 'problems' | 'sources' | 'image' | 'earth' | 'pilot' | null;
type Status = 'loading' | 'ready' | 'error';
type DatedRasterMetadata={key:string;info:ImageInfo;label:string;attribution:string;annual?:AnnualBackdrop;bounds?:Bounds;nativeZoom?:number};
const titles = {
  pilot: 'Fechas y fuentes',
  problems: 'Problemas',
  sources: 'Fuentes',
  image: 'Imagen',
  earth: 'Google Earth Pro',
};
const allHidden: Visibility = {
  coast: false,
  localities: false,
  mangrove: false,
  wetlands: false,
  water: false,
};
const emptyTerritory=():TerritoryData=>{
  const empty=():TerritoryData['coast']=>({type:'FeatureCollection',features:[]});
  return {context:empty(),localities:empty(),coast:empty(),mangrove:empty(),wetlands:empty(),water:empty()};
};
export default function Explorer({reviewMode=false,municipalityScope}:{reviewMode?:boolean;municipalityScope?:MunicipalityScope}={}) {
  const getJson=useCallback(<T,>(path:string,signal:AbortSignal)=>getMunicipalJson<T>(municipalityScope,path,signal),[municipalityScope]);
  const [roadSearchRecords,setRoadSearchRecords]=useState<RoadSearchRecord[]>([]);
  const [roadSearchSelection,setRoadSearchSelection]=useState<RoadSearchRecord|null>(null);
  useEffect(()=>{if(!municipalityScope)return;const controller=new AbortController();void scopeAsset<{records:RoadSearchRecord[]}>(municipalityScope.road_search,controller.signal).then(d=>{if(!controller.signal.aborted)setRoadSearchRecords(d.records);}).catch(()=>{});return()=>controller.abort();},[municipalityScope]);
  const [reviewProfile,setReviewProfile]=useState('');
  const [reviewZoom,setReviewZoom]=useState(17);
  const [reviewError,setReviewError]=useState('');
  const [attempt, setAttempt] = useState(0);
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [shorelineYears, setShorelineYears] = useState<number[]>([]);
  const [shorelineVisible] = useState(true);
  const [shorelinePair, setShorelinePair] = useState<ShorelinePair | null>(null);
  const [, setShorelineStatus] = useState<Status>('loading');
  const [coastalChapter,setCoastalChapter]=useState<CoastalChapter>('current');
  const [coastalAnalysisMode, setCoastalAnalysisMode] = useState<'regional'|'2015'|'2020'|'2010'|'1993'>('2010');
  const [coastalResultView]=useState<CoastalResultView>('scenario');
  const [scenarioModel,setScenarioModel]=useState<CoastalScenario|null>(null);
  const [photoCoastData,setPhotoCoastData]=useState<PhotoCoastData|null>(null);
  const [displayedRasterKey,setDisplayedRasterKey]=useState<string|null>(null);
  const [scenarioStatus,setScenarioStatus]=useState<Status>('loading');
  const [photoComparisonStatus,setPhotoComparisonStatus]=useState<Status>('loading');
  const scenarioActive=coastalChapter==='current'&&coastalAnalysisMode!=='1993';
  useEffect(()=>{
    if(!scenarioActive||scenarioModel)return;
    const controller=new AbortController();setScenarioStatus('loading');
    const timer=window.setTimeout(()=>{controller.abort();setScenarioStatus('error');},20000);
    void (municipalityScope?scopeAsset<unknown>(municipalityScope.model,controller.signal):fetchJsonAsset<unknown>('/data/shorelines/scenario/model.json?v='+scenarioVersion.sha256,controller.signal,'/data/shorelines/scenario/model.json.gz?v='+scenarioVersion.sha256)).then(validateCoastalScenario)
      .then(model=>{if(municipalityScope&&model.targets.some(t=>t.m!==municipalityScope.municipality.name))throw new Error('Perfiles de otro municipio');return model;})
      .then(model=>{if(!controller.signal.aborted){setScenarioModel(model);setScenarioStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setScenarioStatus('error');}).finally(()=>window.clearTimeout(timer));
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[scenarioActive,scenarioModel,attempt]);
  useEffect(()=>{
    if(!scenarioActive||photoCoastData)return;
    const controller=new AbortController();setPhotoComparisonStatus('loading');
    const timer=window.setTimeout(()=>{controller.abort();setPhotoComparisonStatus('error');},20000);
    void (municipalityScope?scopeAsset<unknown>(municipalityScope.photos,controller.signal):fetchJsonAsset<unknown>('/data/shorelines/photo-alignment/revised-data.json?v='+photoCoastVersion.sha256,controller.signal,'/data/shorelines/photo-alignment/revised-data.json.gz?v='+photoCoastVersion.sha256)).then(validatePhotoCoast).then(data=>{if(photoSourceReviewJson.data_sha256!==photoCoastVersion.sha256||municipalityScope&&municipalityScope.original_photo_sha256!==photoCoastVersion.sha256)throw new Error('Source review version mismatch');return municipalityScope?data:applyPhotoVisualReview(data,photoVisualReview,photoCoastVersion.sha256);})
      .then(photos=>municipalityScope?photos:applyPhotoDigitization(photos,photoDigitization as PhotoDigitization,photoCoastVersion.sha256))
      .then(photos=>municipalityScope?photos:applyPhotoPilotReview(photos,westProgresoReview as PhotoPilotReview,photoCoastVersion.sha256))
      .then(photos=>municipalityScope?photos:applyUserShorelineGuides(photos,userShorelineGuides as UserShorelineGuides,photoCoastVersion.sha256))
      .then(async photos=>municipalityScope?photos:(await import('@/lib/current-shoreline-reviews')).applyCurrentMunicipalReviews(photos,photoCoastVersion.sha256))
      .then(photos=>{if(photos.model_sha256!==scenarioVersion.sha256)throw new Error('Photo inventory version mismatch');if(!controller.signal.aborted){setPhotoCoastData(photos);setPhotoComparisonStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setPhotoComparisonStatus('error');}).finally(()=>window.clearTimeout(timer));
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[scenarioActive,coastalResultView,photoCoastData,attempt]);
  const [regionalAnalysis, setRegionalAnalysis] = useState<CoastalAnalysisData | null>(null);
  const [annualManifest,setAnnualManifest] = useState<{periods:{year:number;before:number;features:number;path:string|null;status?:string}[]} | null>(null);
  const [referenceManifest,setReferenceManifest] = useState<typeof annualManifest>(null);
  const [seriesManifest,setSeriesManifest]=useState<SeriesManifest|null>(null);
  const [coverageIndex,setCoverageIndex]=useState<CoastalAnalysisData|null>(null);
  const [coverageYears,setCoverageYears]=useState<CoverageYears|null>(null);
  const [regionalReference,setRegionalReference]=useState<CoastalAnalysisData|null>(null);
  const [coverageVisible,setCoverageVisible]=useState(true);
  const [seriesError,setSeriesError]=useState(false);
  useEffect(()=>{if(coastalChapter!=='current'||scenarioActive)return;const controller=new AbortController();setSeriesError(false);void Promise.all([
    getJson<SeriesManifest>('shorelines/series-2015/manifest.json',controller.signal),
    loadCoastalLayer('shorelines/series-2015/coverage-index.geojson',controller.signal),
    getJson<CoverageYears>('shorelines/series-2015/coverage-years.json',controller.signal),
    loadCoastalLayer('shorelines/series-2015/reference-coast-2025.geojson',controller.signal),
  ]).then(([manifest,index,years,reference])=>{if(!controller.signal.aborted){setSeriesManifest(manifest);setCoverageIndex(index);setCoverageYears(years);setRegionalReference(reference);}}).catch(()=>{if(!controller.signal.aborted)setSeriesError(true);});return()=>controller.abort();},[attempt,scenarioActive,coastalChapter]);
  const [regionalScope,setRegionalScope] = useState('');
  const [regionalYear,setRegionalYear] = useState<number | null>(null);
  const [regionalStatus,setRegionalStatus]=useState<Status>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setRegionalStatus('loading');
    void getJson<{years:number[]}>('shorelines/manifest.json',controller.signal).then(manifest => {
      if (!controller.signal.aborted) setShorelineYears(manifest.years);
    }).catch(() => { if (!controller.signal.aborted) setShorelineStatus('error'); });
    void getJson<{periods:{year:number;before:number;features:number;path:string|null;status?:string}[]}>('shorelines/annual/manifest.json',controller.signal).then(data => { if (!controller.signal.aborted) setAnnualManifest(data); }).catch(() => { if (!controller.signal.aborted) setRegionalStatus('error'); });
    void getJson<NonNullable<typeof annualManifest>>('shorelines/reference-2010/manifest.json',controller.signal).then(data=>{if(!controller.signal.aborted)setReferenceManifest(data);}).catch(()=>{if(!controller.signal.aborted)setRegionalStatus('error');});
    return () => controller.abort();
  }, [attempt]);
  const [coastalPlaces,setCoastalPlaces]=useState<Place[]>([]);
  const [placesStatus,setPlacesStatus]=useState<Status>('loading');
  const [placesAttempt,setPlacesAttempt]=useState(0);
  const [roadKilometres, setRoadKilometres] = useState<RoadKilometres | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getJson<unknown>('road-kilometres.geojson', controller.signal).then(validateRoadKilometres).then(data => {
      if (!controller.signal.aborted) setRoadKilometres(data);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [data, setData] = useState<TerritoryData | null>(null);
  const geographyLoaded=useRef(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceState, setSourceState] = useState<Status>('loading');
  useEffect(()=>{
    const controller=new AbortController();setPlacesStatus('loading');
    void getJson<{places:Place[]}>('coastal-places.json',controller.signal).then(data=>{
      if(!Array.isArray(data.places) || !data.places.length)throw new Error('Localidades no disponibles');
      if(!controller.signal.aborted){setCoastalPlaces(data.places.some(place=>place.municipality==='Ixil')?data.places:[...data.places.slice(0,6),{id:'GAIA-310390023',name:'El Faro · costa de Ixil',municipality:'Ixil',cvegeo:'310390023',population:'',coordinates:[-89.4710383,21.3192508],bounds:[-89.5060383,21.3012508,-89.4360383,21.3372508],minZoom:11,source_url:'https://gaia.inegi.org.mx/wscatgeo/v2/localidades/31039'},...data.places.slice(6)]);setPlacesStatus('ready');}
    }).catch(()=>{if(!controller.signal.aborted)setPlacesStatus('error');});
    return()=>controller.abort();
  },[attempt,placesAttempt]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [pilotMode, setPilotMode] = useState(false);
  const [evolutionMode, setEvolutionMode] = useState(true);
  const [evolutionCatalogue, setEvolutionCatalogue] = useState<EvolutionCatalogue | null>(null);
  const [evolutionStatus, setEvolutionStatus] = useState<Status>('loading');
  const [evolutionAttempt, setEvolutionAttempt] = useState(0);
  const [trendCatalogue,setTrendCatalogue]=useState<AlecTrendCatalogue|null>(null);
  const [trendStatus,setTrendStatus]=useState<Status>('loading');
  const evolutionIndex = useMemo(() => evolutionCatalogue ? createEvolutionIndex(evolutionCatalogue,{referencePolicy:'1993',trends:trendCatalogue}) : null, [evolutionCatalogue,trendCatalogue]);
  useEffect(()=>{
    if(coastalAnalysisMode!=='1993')return;
    const controller=new AbortController();setTrendStatus('loading');
    void getJson<unknown>('littoral/alec-trend-models.json',controller.signal).then(validateAlecTrends).then(value=>{if(!controller.signal.aborted){setTrendCatalogue(value);setTrendStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setTrendStatus('error');});
    return()=>controller.abort();
  },[evolutionAttempt,coastalAnalysisMode]);
  useEffect(() => {
    if(coastalAnalysisMode!=='1993')return;
    const controller = new AbortController();
    setEvolutionStatus('loading');
    void getJson<unknown>('littoral/coastal-evolution.json', controller.signal).then(validateEvolutionCatalogue).then((value) => {
      if (!controller.signal.aborted) { setEvolutionCatalogue(value); setEvolutionStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setEvolutionStatus('error'); });
    return () => controller.abort();
  }, [evolutionAttempt,coastalAnalysisMode]);
  const [pilotSeries, setPilotSeries] = useState<LittoralSeries | null>(null);
  const [pilotStatus, setPilotStatus] = useState<Status>('loading');
  const [pilotAttempt, setPilotAttempt] = useState(0);
  const [pilotCutId, setPilotCutId] = useState<string | null>(null);
  const [pilotYear, setPilotYear] = useState<number | null>(null);
  const [activePlace, setActivePlace] = useState<string | null>(municipalityScope?'municipality:'+municipalityScope.municipality.name:null);
  const [coastPanorama,setCoastPanorama]=useState(false);
  const photoLocation=useMemo<PhotoLocation|null>(()=>{
    if(coastPanorama)return null;
    if(activePlace?.startsWith('municipality:'))return municipalPhotoLocation(municipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue,activePlace.slice('municipality:'.length));
    const place=coastalPlaces.find(p=>p.id===activePlace)??coastalPlaces.find(p=>p.name==='Progreso');
    if(place?.municipality)return {name:place.name,municipality:place.municipality,coordinates:place.coordinates,bounds:coastalViews.find(p=>p.id===place.id)?.bounds??place.bounds};
    const site=receivedPhotoCatalogueJson.sites.find(site=>site.name==='Progreso')!;
    return {name:'Progreso',municipality:'Progreso',coordinates:site.coordinates as [number,number]};
  },[activePlace,coastalPlaces,coastPanorama]);
  const [chapterSources,setChapterSources]=useState<Record<CoastalChapter,ImageSource>>({current:'detail',alec:'detail',historical:'archive'});
  const imageSource=chapterSources[coastalChapter];
  const [archiveKind, setArchiveKind] = useState<ArchiveKind>('geomedian');
  const [archiveManifests, setArchiveManifests] = useState<Record<ArchiveKind, HistoricalManifest | null>>({ landsat: null, inegi: null, nasa: null, geomedian: null });
  // Current studies offer only years with compatible dated photo pairs.
  const [chapterYears,setChapterYears]=useState(initialChapterYears);
  const activeYearBounds=chapterBounds(coastalChapter);
  const availableAnalysisYears=useMemo(()=>{
    if(coastalResultView==='scenario')return SCENARIO_YEARS;
    const years=municipalComparisonYears(municipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue,photoLocation?.municipality??null,activeYearBounds.first,activeYearBounds.last,photoLocation?.coordinates);
    return imageSource==='sentinel'?years.filter(hasPcAnnualBackdrop):imageSource==='archive'?years.filter(year=>archiveManifests[archiveKind]?.epochs.some(epoch=>epoch.year===year)):years;
  },[coastalResultView,photoLocation,activeYearBounds.first,activeYearBounds.last,imageSource,archiveManifests,archiveKind]);
  const imageYear=coastalChapter==='current'?(compatibleAnalysisYear(availableAnalysisYears,chapterYears.current)??chapterYears.current):chapterYears[coastalChapter];
  useEffect(()=>{
    if(coastalChapter==='current'&&['2015','2020'].includes(coastalAnalysisMode)&&imageYear<Number(coastalAnalysisMode))setCoastalAnalysisMode('regional');
  },[coastalChapter,coastalAnalysisMode,imageYear]);
  const setImageYear=useCallback((next:number|((year:number)=>number))=>setChapterYears(years=>{
    const requested=typeof next==='function'?next(years[coastalChapter]):next;
    if(coastalChapter==='current'&&!availableAnalysisYears.includes(requested))return years;
    return withChapterYear(years,coastalChapter,requested);
  }),[coastalChapter,availableAnalysisYears]);
  const [pilotSelectedId, setPilotSelectedId] = useState<string | null>(null);
  const selectedPilotYear = pilotYear ?? (pilotSeries ? littoralYearBounds(pilotSeries).lastYear : new Date().getUTCFullYear());
  const pilotCut = useMemo(() => pilotSeries ? (pilotSeries.cuts.find((cut) => cut.id === pilotCutId) ?? littoralCutForYear(pilotSeries, selectedPilotYear)) : null, [pilotSeries, pilotCutId, selectedPilotYear]);
  const backgroundYear = pilotMode ? selectedPilotYear : imageYear;
  const shorelineBefore = coastalAnalysisMode==='2015'?2015:coastalAnalysisMode==='2020'?2020:coastalAnalysisMode==='2010'?2010:backgroundYear - 1, shorelineAfter = backgroundYear;
  const comparisonManifest=useMemo(()=>coastalAnalysisMode==='2010'?referenceManifest:seriesManifest&&(coastalAnalysisMode==='2015'||coastalAnalysisMode==='2020'||backgroundYear>=2015)?{periods:seriesManifest.periods.map(period=>{const entry=(coastalAnalysisMode==='2015'?period.reference2015:coastalAnalysisMode==='2020'?period.reference2020:period.annual)??{features:0,map_path:'',counts:{}};return {year:period.year,before:coastalAnalysisMode==='2015'?2015:coastalAnalysisMode==='2020'?2020:period.before,features:entry.features,path:entry.map_path,status:'experimental_modelled'};})}:annualManifest,[coastalAnalysisMode,referenceManifest,seriesManifest,backgroundYear,annualManifest]);
  const regionalCoverage=useMemo(()=>coverageIndex&&coverageYears&&backgroundYear>=2015&&['regional','2015','2020'].includes(coastalAnalysisMode)?assessmentCoverage(coverageIndex,coverageYears,backgroundYear,coastalAnalysisMode==='2015'?'2015':coastalAnalysisMode==='2020'?'2020':false):null,[coverageIndex,coverageYears,backgroundYear,coastalAnalysisMode]);
  const completeAssessment=useMemo<CoastalAnalysisData|null>(()=>regionalCoverage?{type:'FeatureCollection',features:[...(regionalReference?.features??[]).map(feature=>({...feature,properties:{...feature.properties,assessment_only:true,assessment_reference_only:true,assessment_status:0,assessment_year:backgroundYear}})),...regionalCoverage.features]}:null,[regionalCoverage,regionalReference,backgroundYear]);
  const coverageRows=useMemo(()=>regionalCoverage?municipalCoverage(regionalCoverage):[],[regionalCoverage]);
  const annualEntry = comparisonManifest?.periods.find(entry => entry.year === backgroundYear);
  const receivedRegional = coastalAnalysisMode==='1993'?null:(annualEntry?.path?peekCoastalLayer(annualEntry.path):null) ?? (regionalYear === backgroundYear && regionalScope===coastalAnalysisMode ? regionalAnalysis : null);
  const [chapterSatellites,setChapterSatellites]=useState<Record<CoastalChapter,WaybackItem|null>>({current:null,alec:null,historical:null});
  const currentComparisonPhoto=useMemo(()=>{
    if(coastalChapter!=='current'||!photoLocation)return null;
    const options=(coastalResultView==='scenario'?municipalDatedOptions:municipalComparisonOptions)(receivedPhotoCatalogueJson.items as WaybackItem[],municipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue,photoLocation.municipality,photoLocation.coordinates,17,photoLocation.coordinates);
    return coastalResultView==='scenario'?scenarioReferencePhoto(options,imageYear,chapterSatellites.current?.releaseNum??null):options.find(photo=>photo.year===imageYear)??null;
  },[coastalChapter,photoLocation,imageYear,coastalResultView,chapterSatellites.current]);
  useEffect(()=>{
    if(coastalChapter==='current'&&currentComparisonPhoto)setChapterSatellites(previous=>previous.current?.releaseNum===currentComparisonPhoto.item.releaseNum?previous:{...previous,current:currentComparisonPhoto.item});
  },[coastalChapter,currentComparisonPhoto]);
  // The current photo is derived in the same render as municipality and year.
  // Stored items only provide legacy choices, an explicit retry, or panorama.
  const historicalSatellite=coastalChapter==='current'&&currentComparisonPhoto?(chapterSatellites.current?.releaseNum===currentComparisonPhoto.item.releaseNum?chapterSatellites.current:currentComparisonPhoto.item):chapterSatellites[coastalChapter];
  const setHistoricalSatellite=useCallback((item:WaybackItem|null|((item:WaybackItem|null)=>WaybackItem|null))=>setChapterSatellites(previous=>({...previous,[coastalChapter]:typeof item==='function'?item(previous[coastalChapter]):item})),[coastalChapter]);
  const comparisonScope=photoLocation?photoLocation.municipality+':'+photoLocation.coordinates.join(','):'panorama';
  const comparisonRelease=imageSource==='detail'?historicalSatellite?.releaseNum??null:null;
  const eligibleComparisonYear=!photoLocation||availableAnalysisYears.includes(backgroundYear);
  const [retainedPhotoComparison,setRetainedPhotoComparison]=useState<PhotoCoastPresentation|null>(null);
  const photoComparisonCandidate=useMemo<PhotoCoastPresentation|null>(()=>{
    if(!scenarioActive||coastalResultView!=='photos'||!scenarioModel||!photoCoastData||shorelineBefore>backgroundYear||!eligibleComparisonYear||imageSource==='detail'&&comparisonRelease===null)return null;
    const observed=photoCoastComparison(scenarioModel,photoCoastData,shorelineBefore,backgroundYear,comparisonRelease,photoLocation?.municipality??null);
    const compatible=new Set(compatiblePhotoCoastLayer(observed,photoLocation?.municipality??null).features.map(f=>f.id));
    const griddedScopes=new Set(coastal100mGrid.segments.map(s=>s.municipality));
    const retained={...observed,features:observed.features.filter(f=>griddedScopes.has(String(f.properties.municipality))||compatible.has(f.id))};
    return {scope:comparisonScope,year:backgroundYear,frameKey:imageSource==='detail'?'esri:'+comparisonRelease:imageSource,layer:compatibleSourceLayer(retained,comparisonRelease,photoSourceReviewJson as unknown as PhotoSourceReview)};
  },[scenarioActive,coastalResultView,scenarioModel,photoCoastData,shorelineBefore,backgroundYear,eligibleComparisonYear,imageSource,comparisonRelease,comparisonScope,photoLocation?.municipality]);
  const photoComparisonPresentation=imageSource==='detail'?displayedPhotoCoastPresentation(comparisonScope,displayedRasterKey,photoComparisonCandidate,retainedPhotoComparison):photoComparisonCandidate;
  useEffect(()=>{
    if(imageSource==='detail'&&photoComparisonCandidate&&photoComparisonPresentation===photoComparisonCandidate)setRetainedPhotoComparison(previous=>previous===photoComparisonCandidate?previous:photoComparisonCandidate);
  },[imageSource,photoComparisonCandidate,photoComparisonPresentation]);
  const alignedCoastCache=useMemo(()=>scenarioModel&&photoCoastData?createCoastalImageAlignment(scenarioModel,photoCoastData,photoSourceReviewJson as unknown as PhotoSourceReview):null,[scenarioModel,photoCoastData]);
  // Only the committed raster may place photographic results. A pending
  // requested edition must never move points onto the still-visible image.
  const displayedAlignmentRelease=imageSource==='detail'&&displayedRasterKey?.startsWith('esri:')?Number(displayedRasterKey.slice(5)):null;
  // On first load, wait for the first committed photo. Do not briefly paint
  // unbound results while the initial 2025 photograph is still arriving.
  const alignedCoast=useMemo(()=>scenarioActive&&coastalResultView==='scenario'&&(imageSource!=='detail'||displayedAlignmentRelease!==null)?alignedCoastCache?.read(backgroundYear,displayedAlignmentRelease)??null:null,[scenarioActive,coastalResultView,alignedCoastCache,backgroundYear,displayedAlignmentRelease,imageSource]);
  const sourceScenarioLayer=coastalResultView==='scenario'?alignedCoast?.layer??null:photoComparisonPresentation?.layer??null;
  const scenarioLayer=useMemo(()=>sourceScenarioLayer?applyCoastal100mGrid(sourceScenarioLayer,coastal100mGrid as unknown as Coastal100mGrid):null,[sourceScenarioLayer]);
  const activeRegional=scenarioActive?scenarioLayer:receivedRegional;
  const useComparisonEndpoints=['2010','2015','2020'].includes(coastalAnalysisMode)||(coastalAnalysisMode==='regional'&&backgroundYear>=2015);
  const referenceShorelines = useMemo<ShorelinePair|null>(()=>{
    if(scenarioActive||!useComparisonEndpoints || !activeRegional)return null;
    const endpoint=(end:0|1):CoastalAnalysisData=>({type:'FeatureCollection',features:activeRegional.features.flatMap(f=>f.geometry.type==='LineString'?[{type:'Feature' as const,id:String(f.id)+'-'+end,geometry:{type:'Point' as const,coordinates:f.geometry.coordinates[end]},properties:{...f.properties,year:end?backgroundYear:shorelineBefore,delta_m:undefined,display_endpoint:end?'after':'before',endpoint_year:end?backgroundYear:shorelineBefore,endpoint_estimated:end?f.properties.model_after??f.properties.estimated:!!(f.properties.baseline_estimated??f.properties.baseline_is_estimated??f.properties.model_before),estimated:end?f.properties.model_after??f.properties.estimated:!!(f.properties.baseline_estimated??f.properties.baseline_is_estimated??f.properties.model_before),position_is_estimated:end?f.properties.model_after??f.properties.estimated:!!(f.properties.baseline_estimated??f.properties.baseline_is_estimated??f.properties.model_before)}}]:[])});
    return {before:endpoint(0),after:endpoint(1),beforeYear:shorelineBefore,afterYear:backgroundYear};
  },[scenarioActive,activeRegional,backgroundYear,useComparisonEndpoints,shorelineBefore]);
  const activeShorelines = scenarioActive?null:useComparisonEndpoints?referenceShorelines:shorelinePair?.beforeYear === shorelineBefore && shorelinePair.afterYear === shorelineAfter ? shorelinePair : null;
  useEffect(() => {
    const controller = new AbortController();
    setRegionalAnalysis(null);
    if (scenarioActive||!comparisonManifest || coastalAnalysisMode === '1993') return () => controller.abort();
    if (!annualEntry?.path) {setRegionalYear(backgroundYear);setRegionalScope(coastalAnalysisMode);setRegionalStatus('ready');return () => controller.abort();}
    setRegionalStatus('loading');
    const path=annualEntry.path;
    const timer=window.setTimeout(()=>{void loadCoastalLayer(path,controller.signal).then(data => {
      if (!controller.signal.aborted) {setRegionalAnalysis(data);setRegionalYear(backgroundYear);setRegionalScope(coastalAnalysisMode);setRegionalStatus('ready');}
    }).catch(() => {if(!controller.signal.aborted){setRegionalStatus('error');setRegionalYear(backgroundYear);}});},0);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [scenarioActive,comparisonManifest,annualEntry?.path,backgroundYear,coastalAnalysisMode,attempt]);
  useEffect(()=>{
    if(scenarioActive||regionalStatus!=='ready' || !comparisonManifest || coastalAnalysisMode==='1993')return;
    const controller=new AbortController();
    const neighbours=[backgroundYear-1,backgroundYear+1].map(year=>comparisonManifest.periods.find(entry=>entry.year===year)?.path).filter((path):path is string=>!!path);
    const timer=window.setTimeout(()=>{void (async()=>{
      for(const path of neighbours){if(controller.signal.aborted)return;if(!peekCoastalLayer(path))try{await loadCoastalLayer(path,controller.signal);}catch{/* Foreground selection owns visible errors. */}}
    })();},650);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[scenarioActive,regionalStatus,comparisonManifest,backgroundYear,coastalAnalysisMode]);
  useEffect(() => {
    if(scenarioActive||useComparisonEndpoints){setShorelinePair(null);setShorelineStatus('ready');return;}
    if(!shorelineVisible){setShorelinePair(null);return;}
    if (!shorelineYears.includes(shorelineBefore) || !shorelineYears.includes(shorelineAfter)) {setShorelinePair(null);setShorelineStatus('ready');return;}
    const controller = new AbortController();
    setShorelineStatus('loading'); setShorelinePair(null);
    const years=[...new Set([shorelineBefore,shorelineAfter])];
    void Promise.all(years.map(year => loadCoastalLayer('shorelines/map/years/'+year+'.json',controller.signal))).then(layers => {
      const before=layers[years.indexOf(shorelineBefore)],after=layers[years.indexOf(shorelineAfter)];
      if (!controller.signal.aborted) { setShorelinePair({before,after,beforeYear:shorelineBefore,afterYear:shorelineAfter}); setShorelineStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setShorelineStatus('error'); });
    return () => controller.abort();
  }, [scenarioActive,shorelineBefore,shorelineAfter,shorelineYears,shorelineVisible,attempt,coastalAnalysisMode,useComparisonEndpoints]);

  const selectPilotYear = useCallback((year: number) => { setPilotYear(year); setPilotCutId(null); }, []);
  const selectPilotCut = useCallback((id: string) => {
    const cut = pilotSeries?.cuts.find((entry) => entry.id === id);
    if (!cut) return;
    setPilotYear(Number((cut.datetime ?? cut.end).slice(0, 4)));
    setPilotCutId(id);
  }, [pilotSeries]);
  const pilotMapData = useMemo(() => pilotSeries && pilotCut ? littoralMapData(pilotSeries, pilotCut) : null, [pilotSeries, pilotCut]);
  const pilotAxes = useMemo(() => pilotSeries && pilotCut ? littoralAxisData(pilotSeries, pilotCut) : null, [pilotSeries, pilotCut]);
  const pilotLabels = useMemo(() => pilotSeries && pilotCut ? littoralChangeLabels(pilotSeries, pilotCut) : [], [pilotSeries, pilotCut]);
  const pilotMapPoints = useMemo(() => pilotCut && pilotSeries ? littoralMapPoints(pilotCut, pilotSeries) : null, [pilotCut, pilotSeries]);
  const pilotBars = useMemo(() => pilotSeries ? createTransectIndex(pilotSeries.pilot.transects.features) : null, [pilotSeries]);
  const pilotBar = pilotBars?.byId.get(pilotSelectedId ?? '') ?? pilotBars?.features[Math.floor(pilotBars.features.length / 2)] ?? null;
  const pilotFootprint = useMemo(() => pilotBar && pilotBars ? barFootprint(pilotBar, pilotBars) : null, [pilotBar, pilotBars]);
  const pilotRuler = useMemo(() => pilotSeries && pilotCut && pilotFootprint ? littoralRuler(pilotSeries, pilotCut, pilotFootprint) : null, [pilotSeries, pilotCut, pilotFootprint]);
  const pilotLocated = useRef(false);
  useEffect(() => {
    if (!pilotMode) return;
    const controller = new AbortController();
    let cancelled = false;
    setPilotStatus('loading');
    void getJson<unknown>('littoral/pilot-series.json', controller.signal).then(validateLittoralSeries).then((series) => {
      if (cancelled) return;
      setPilotSeries(series);
      setPilotStatus('ready');
    }).catch(() => { if (!cancelled) setPilotStatus('error'); });
    return () => { cancelled = true; controller.abort(); };
  }, [pilotMode, pilotAttempt]);
  const [panel, setPanel] = useState<Panel>(null);
  const [zoomState, setZoomState] = useState({ min: false, max: false });
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [viewZoom, setViewZoom] = useState(12);
  const [viewBounds, setViewBounds] = useState<Bounds>(CHELEM_PROGRESO_OVERVIEW);
  const photoResultsInView=useMemo(()=>activeRegional?.features.filter(feature=>{
    const b=geometryBounds(feature.geometry);
    return b&&b[0]<=viewBounds[2]&&b[2]>=viewBounds[0]&&b[1]<=viewBounds[3]&&b[3]>=viewBounds[1];
  }).length??0,[activeRegional,viewBounds]);

  const [satelliteWarm, setSatelliteWarm] = useState<WaybackItem[]>([]);
  const onWarmFrames = useCallback(
    (items: WaybackItem[]) =>
      setSatelliteWarm((previous) =>
        previous.map((item) => item.releaseNum).join(',') ===
        items.map((item) => item.releaseNum).join(',')
          ? previous
          : items,
      ),
    [],
  );
  const [satelliteStatus, setSatelliteStatus] = useState<Status>('loading');
  const satelliteDetail = useSatelliteDetail(imageSource === 'detail' ? historicalSatellite : null, center);
  const selectedCaptureMetadata=historicalSatellite&&center?cachedRenderedEsriMetadata(historicalSatellite,center[0],center[1],esriPhotoMetadataZoom(viewZoom,satellitePixelRatio())):null;
  const resolvedSatelliteDetail=selectedCaptureMetadata?.nativeZoom!==undefined?{nativeZoom:selectedCaptureMetadata.nativeZoom,status:'ready' as const}:satelliteDetail;
  const [chapterPhotoYears,setChapterPhotoYears]=useState<Record<CoastalChapter,{archive:number;sentinel:number}>>({current:{archive:2025,sentinel:2025},alec:{archive:2021,sentinel:2021},historical:{archive:1951,sentinel:2021}});
  const photoYear=imageSource==='detail'?backgroundYear:chapterPhotoYears[coastalChapter][imageSource];
  const setPhotoYear=useCallback((year:number,source:'archive'|'sentinel')=>setChapterPhotoYears(previous=>({...previous,[coastalChapter]:{...previous[coastalChapter],[source]:year}})),[coastalChapter]);
  const setImageSourceState=useCallback((source:ImageSource)=>setChapterSources(sources=>({...sources,[coastalChapter]:source})),[coastalChapter]);
  const [archiveManifestStatus, setArchiveManifestStatus] = useState<Record<ArchiveKind, Status>>({ landsat: 'loading', inegi: 'loading', nasa: 'loading', geomedian: 'loading' });
  const [archiveAttempt, setArchiveAttempt] = useState(0);
  const [sentinelAttempt, setSentinelAttempt] = useState(0);
  const setImageSource = useCallback((source: ImageSource) => {
    setPanel(null);
    if (source === imageSource) return;
    setImageSourceState(source);
    setSatelliteStatus('loading');
  }, [imageSource,setImageSourceState]);
  useEffect(() => {
    const controller = new AbortController();
    for (const [kind, path] of [['landsat', 'history/landsat-tiles.json'], ['inegi', 'history/manifest.json'], ['nasa', 'history/nasa-gweld.json'], ['geomedian', 'history/geomedian.json']] as const) {
      if(imageSource!=='archive' && kind!=='geomedian')continue;
      setArchiveManifestStatus(current => ({ ...current, [kind]: 'loading' }));
      void getJson<unknown>(path, controller.signal).then(validateHistoricalManifest).then(manifest => {
        if (controller.signal.aborted) return;
        setArchiveManifests(current => ({ ...current, [kind]: manifest }));
        setArchiveManifestStatus(current => ({ ...current, [kind]: 'ready' }));
      }).catch(() => { if (!controller.signal.aborted) setArchiveManifestStatus(current => ({ ...current, [kind]: 'error' })); });
    }
    return () => controller.abort();
  }, [archiveAttempt, imageSource]);
  const [coverageRegistry, setCoverageRegistry] = useState<HistoricalCoverageRegistry | null>(null);
  const [coverageStatus, setCoverageStatus] = useState<Status>('loading');
  useEffect(() => {
    const controller = new AbortController(); setCoverageStatus('loading');
    void getJson<unknown>('history/coverage-reviews.json', controller.signal).then(validateCoverageRegistry).then(registry => {
      if (!controller.signal.aborted) { setCoverageRegistry(registry); setCoverageStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setCoverageStatus('error'); });
    return () => controller.abort();
  }, [archiveAttempt, sentinelAttempt, imageSource]);
  const qualifiedArchives = useMemo(() => Object.fromEntries((['landsat','inegi','nasa','geomedian'] as const).map(kind => [kind, coastalChapter==='alec'&&(kind==='inegi'||kind==='landsat')?archiveManifests[kind]:qualifiedHistoricalManifest(archiveManifests[kind], kind, coverageRegistry)])) as Record<ArchiveKind,HistoricalManifest | null>, [archiveManifests, coverageRegistry,coastalChapter]);
  const archiveManifest = qualifiedArchives[archiveKind];
  const archiveEpoch = useMemo(() => historicalEpochForYear(archiveManifest, photoYear), [archiveManifest, photoYear]);
  const availableArchiveKinds = useMemo(() => (['geomedian','nasa','landsat','inegi'] as const).filter(kind => !!historicalEpochForYear(qualifiedArchives[kind], photoYear)), [qualifiedArchives, photoYear]);
  useEffect(() => { if (!availableArchiveKinds.includes(archiveKind) && availableArchiveKinds.length) setArchiveKind(availableArchiveKinds[0]); }, [archiveKind, availableArchiveKinds]);

  const archiveFrames = useMemo(() => archiveManifest?.frames.filter(frame => frame.epoch === archiveEpoch?.id) ?? [], [archiveManifest, archiveEpoch]);
  const archiveBounds = useMemo(() => historicalEpochBounds(archiveManifest, archiveEpoch?.id ?? null), [archiveManifest, archiveEpoch]);
  const archiveCovered = historicalEpochCovered(archiveManifest, archiveEpoch?.id ?? null, center);
  const combinedHistory = useMemo(() => combineHistoricalManifests([qualifiedArchives.landsat, qualifiedArchives.inegi, qualifiedArchives.nasa, qualifiedArchives.geomedian]), [qualifiedArchives]);
  const archiveFrame = archiveFrames[0];
  useEffect(()=>{
    if(imageSource==='archive'&&historicalEpochForYear(archiveManifest,backgroundYear))setPhotoYear(backgroundYear,'archive');
    if(imageSource==='sentinel'&&backgroundYear>=2017&&backgroundYear<=2026)setPhotoYear(backgroundYear,'sentinel');
  },[backgroundYear,imageSource,archiveManifest,setPhotoYear]);
  const archiveImageInfo = useMemo<ImageInfo | null>(() => archiveEpoch && archiveFrame ? {
    frameKey:archiveFrames.length===1?'archive:'+archiveFrame.id:undefined,
    title: archiveKind === 'landsat' ? 'Archivo satelital Landsat' : archiveKind === 'inegi' ? 'Archivo de detalle INEGI' : archiveKind === 'geomedian' ? 'INEGI · mosaico anual completo' : 'NASA GIBS · mosaico anual',
    capture: archiveEpoch.label,
    captureDate: archiveFrame.date_precision === 'day' ? archiveFrame.capture_date : archiveFrame.date_precision === 'month' ? archiveFrame.capture_month : null,
    provider: archiveManifest?.attribution ?? (archiveKind === 'landsat' ? 'USGS / NASA · Landsat' : archiveKind === 'inegi' ? 'INEGI · ortofotos digitales' : archiveKind === 'geomedian' ? 'INEGI · geomediana anual' : 'NASA GIBS · WELD'),
    resolution: archiveEpoch.resolution_m + ' m/píxel original',
    note: 'La imagen tiene fecha propia; el análisis conserva el año elegido. '
      + (archiveKind === 'inegi' ? 'Vuelo conocido por mes; no se conoce aquí el día exacto. Ortofotos en blanco y negro. ' : (archiveKind === 'nasa' || archiveKind === 'geomedian') ? 'Compuesto anual de varias tomas, no una captura de un solo día. Periodo ' + (archiveFrame.period_start ?? 'sin fecha inicial publicada') + ' a ' + (archiveFrame.period_end ?? 'sin fecha final publicada') + '. Puede contener huecos. ' : 'Captura satelital real; pueden existir nubes y huecos. ')
      + 'Mapa explorable con fechas disponibles, sin interpolar años ni certificar erosión. ' + (archiveFrame.note ?? ''),
    url: archiveFrame.catalogue_url,
  } : null, [archiveEpoch, archiveFrame, archiveFrames.length, archiveKind, archiveManifest]);
  const [esriImageInfo, setEsriImageInfo] = useState<ImageInfo | null>(null);

  const esriInfoByFrame=useRef(new Map<string,ImageInfo>());
  useEffect(()=>{if(esriImageInfo?.frameKey){esriInfoByFrame.current.set(esriImageInfo.frameKey,esriImageInfo);if(esriInfoByFrame.current.size>4)esriInfoByFrame.current.delete(esriInfoByFrame.current.keys().next().value!);}},[esriImageInfo]);
  const displayedEsriCandidate=esriImageInfo?.frameKey===displayedRasterKey?esriImageInfo:esriInfoByFrame.current.get(displayedRasterKey??'')??null;
  const displayedEsriInfo=displayedEsriCandidate?.pointScope===((center?.join(',')??'')+':'+esriPhotoMetadataZoom(viewZoom,satellitePixelRatio()))?displayedEsriCandidate:null;
  const [sentinelImageInfo, setSentinelImageInfo] = useState<ImageInfo | null>(null);
  const [captureFrames, setCaptureFrames] = useState<Partial<Record<CaptureFrame['source'], CaptureFrame>>>({});
  const [historyDisplayState,setHistoryDisplayState]=useState<{epoch:string|null;status:Status}|null>(null);
  const sourceYearInfo = imageSource === 'detail' ? esriImageInfo : sentinelImageInfo;
  const [confirmedEsri,setConfirmedEsri] = useState<{year:number;release:number}|null>(null);
  const hasHdEsri=isVerifiedHdYear(backgroundYear,esriImageInfo?.requestedYear,esriImageInfo?.captureDate,esriImageInfo?.resolutionMeters);
  if (imageSource === 'detail' && historicalSatellite && hasHdEsri && (confirmedEsri?.year !== backgroundYear || confirmedEsri.release !== historicalSatellite.releaseNum)) setConfirmedEsri({year:backgroundYear,release:historicalSatellite.releaseNum});
  const verifyingEsri = retainDatedEsriDuringProbe(confirmedEsri,backgroundYear,historicalSatellite?.releaseNum,!!esriImageInfo?.queryPending,esriImageInfo?.captureDate ?? null);

  // User-approved reference mode: an absent annual photograph never blanks the map.
  const esriUnavailable=false;
  const [fallbackAttempt,setFallbackAttempt]=useState(0);
  // User choice: lower-resolution imagery is opt-in, never an automatic HD replacement.
  const needsAlternative=imageSource==='sentinel'&&photoYear>=2015;
  const pcBackdrop=usePcAnnualBackdrop(needsAlternative&&hasPcAnnualBackdrop(photoYear)?photoYear:null,fallbackAttempt);
  const annualFallback = useMemo(()=>{if(!needsAlternative)return null;const candidate=pcBackdrop.backdrop??annualBackdropForYear(photoYear,qualifiedArchives.geomedian);return candidate?.provider==='inegi'?null:candidate;},[needsAlternative,pcBackdrop.backdrop,photoYear,qualifiedArchives.geomedian]);
  const backgroundUnavailable = imageSource === 'detail' ? esriUnavailable : imageSource === 'archive' ? !archiveEpoch : !annualFallback && (!completeYearReview(coverageRegistry, 'sentinel', photoYear) || Number(sourceYearInfo?.captureDate?.slice(0,4)) !== photoYear);
  const referenceEsriFallback=imageSource!=='detail'&&backgroundUnavailable;
  const requestedDatedRaster=useMemo<DatedRasterMetadata|null>(()=>annualFallback?{
    key:annualFallback.frame.key,info:annualFallback.info,label:annualFallback.label,attribution:annualFallback.attribution,
    annual:annualFallback,nativeZoom:annualFallback.frame.options.maxNativeZoom??14,
  }:imageSource==='archive'&&archiveFrames.length===1&&archiveFrame&&archiveImageInfo?{
    key:'archive:'+archiveFrame.id,info:archiveImageInfo,
    label:archiveKind==='landsat'?'Landsat · 30 m':archiveKind==='inegi'?'INEGI · ortofoto parcial':archiveKind==='geomedian'?'INEGI · mosaico anual':'NASA · mosaico anual',
    attribution:archiveImageInfo.provider,bounds:archiveBounds??undefined,
    nativeZoom:archiveFrame.maxzoom+(archiveFrame.tile_size===512?1:0),
  }:null,[annualFallback,imageSource,archiveFrames.length,archiveFrame,archiveImageInfo,archiveKind,archiveBounds]);
  const datedRasterInfoByFrame=useRef(new Map<string,DatedRasterMetadata>());
  useEffect(()=>{
    if(!requestedDatedRaster)return;
    const records=datedRasterInfoByFrame.current;
    records.delete(requestedDatedRaster.key);records.set(requestedDatedRaster.key,requestedDatedRaster);
    while(records.size>4){const oldest=[...records.keys()].find(key=>key!==displayedRasterKey);if(!oldest)break;records.delete(oldest);}
  },[requestedDatedRaster,displayedRasterKey]);
  // The requested frame may still be downloading while a decoded reference is
  // visible. Dates, providers and credits follow the displayed transport key.
  const multiArchive=imageSource==='archive'&&archiveFrames.length>1;
  const multiArchiveReady=multiArchive&&historyDisplayState?.epoch===archiveKind+':'+archiveEpoch?.id&&historyDisplayState.status==='ready';
  const displayedDatedRaster=referenceEsriFallback||multiArchive?null:requestedDatedRaster?.key===displayedRasterKey?requestedDatedRaster:datedRasterInfoByFrame.current.get(displayedRasterKey??'')??null;
  const displayedAnnual=displayedDatedRaster?.annual;
  const displayedNativeSentinel=displayedRasterKey===captureFrames.sentinel?.key&&sentinelImageInfo?.captureDate===captureFrames.sentinel?.date?sentinelImageInfo:null;
  const displayedDatedInView=!displayedDatedRaster?.bounds||!center||(center[0]>=displayedDatedRaster.bounds[0]&&center[0]<=displayedDatedRaster.bounds[2]&&center[1]>=displayedDatedRaster.bounds[1]&&center[1]<=displayedDatedRaster.bounds[3]);
  const imageInfo=referenceEsriFallback||!displayedDatedInView?null:multiArchive?(multiArchiveReady?archiveImageInfo:null):displayedDatedRaster?.info??displayedEsriInfo??displayedNativeSentinel;
  const visibleBackgroundLabel=referenceEsriFallback||!displayedDatedInView?'Esri · referencia visible':multiArchive?(multiArchiveReady?archiveImageInfo?.provider??'Archivo parcial':'Archivo parcial · en preparación'):displayedDatedRaster?.label??(displayedRasterKey?.startsWith('sentinel:')?'Sentinel · referencia visible':'Esri · referencia visible');
  const visibleBackgroundAttribution=referenceEsriFallback||!displayedDatedInView?'© Esri · Vantor · Earthstar · referencia temporal':multiArchive?(multiArchiveReady?archiveImageInfo?.provider:'Archivo parcial · comprobando imágenes'):displayedDatedRaster?.attribution??(displayedRasterKey?.startsWith('sentinel:')?'Copernicus Sentinel-2 / Microsoft Planetary Computer':'© Esri · Vantor · Earthstar · referencia temporal');
  const requestedPhotoCaption='Análisis '+backgroundYear+' · '+(imageInfo?imageInfo.capture:!displayedDatedInView?'fuera de cobertura':multiArchive?'preparando archivo':'fecha visible en consulta');
  useEffect(() => {
    if (imageSource === 'detail' && backgroundUnavailable) {setSatelliteStatus(esriImageInfo?.queryFailed?'error':esriImageInfo?.requestedYear !== backgroundYear || esriImageInfo.queryPending ? 'loading' : 'ready');return;}
    if(imageSource==='sentinel' && hasPcAnnualBackdrop(photoYear)){
      if(!annualFallback)setSatelliteStatus(pcBackdrop.status);
      return;
    }
    if (imageSource === 'archive' && archiveManifestStatus[archiveKind] !== 'ready') setSatelliteStatus(archiveManifestStatus[archiveKind]);
    else if (backgroundUnavailable) setSatelliteStatus(coverageStatus === 'error' ? 'error' : coverageStatus === 'loading' ? 'loading' : 'ready');
  }, [imageSource, archiveKind, archiveManifestStatus, backgroundUnavailable, coverageStatus, esriImageInfo, backgroundYear,photoYear, annualFallback, pcBackdrop.status]);
  const archiveStatusEpoch=archiveEpoch?archiveKind+':'+archiveEpoch.id:null;
  const onHistoryStatus = useCallback((status: Status) => { if (imageSource === 'archive') {setSatelliteStatus(status);setHistoryDisplayState({epoch:archiveStatusEpoch,status});} }, [imageSource,archiveStatusEpoch]);
  const onSatelliteStatus = useCallback((status: Status) => { if (imageSource !== 'archive') setSatelliteStatus(status); }, [imageSource]);
  const [sentinelManifest, setSentinelManifest] =
    useState<SentinelManifest | null>(null);
  const [sentinelError, setSentinelError] = useState(false);
  const [sentinelId, setSentinelId] = useState<string | null>(null);
  const [issueVisibility, setIssueVisibility] = useState<IssueVisibility>({
    ...initialIssues,
    vegetation: true,
  });
  const [evidence, setEvidence] = useState<EvidenceLayers>({
    barriers: null,
    geotubes: null,
    vegetation: null,
  });
  const [evidenceStatus, setEvidenceStatus] = useState<
    Record<EvidenceKind, Status>
  >({ barriers: 'loading', geotubes: 'loading', vegetation: 'loading' });
  const [evidenceAttempt, setEvidenceAttempt] = useState(0);
  const [evidenceSelected, setEvidenceSelected] =
    useState<EvidenceSelection | null>(null);
  const [mangroveManifest, setMangroveManifest] =
    useState<MangroveManifest | null>(null);
  const [mangroveChanges, setMangroveChanges] = useState<EvidenceData | null>(
    null,
  );
  const [mangroveStatus, setMangroveStatus] = useState<Status>('loading');
  const [mangrove2020Visible, setMangrove2020Visible] = useState(false);
  const captureFrame = useMemo<CaptureFrame | null>(() => annualFallback?{key:annualFallback.frame.key,source:'archive',date:null,center}:imageSource === 'archive' ? archiveEpoch && archiveFrame && archiveCovered ? {
    key: archiveKind + ':' + archiveEpoch.id, source: 'archive',
    date: archiveFrame.date_precision === 'day' ? archiveFrame.capture_date ?? null : null, center,
  } : null : backgroundUnavailable ? null : captureFrames[imageSource === 'detail' ? 'esri' : 'sentinel'] ?? null,
  [annualFallback,imageSource, archiveEpoch, archiveFrame, archiveCovered, archiveKind, center, backgroundUnavailable, captureFrames]);
  const captureKey = useRef<string | null>(null);
  const [lastDatedSeries, setLastDatedSeries] = useState<ResearchSeries>('S2');
  const [temporalRegistry, setTemporalRegistry] =
    useState<TemporalRegistry | null>(null);
  const [historicalReferences, setHistoricalReferences] = useState(true);
  const allowUndatedReferences=historicalReferences&&backgroundYear>=2011;
  // Data follow the requested calendar year; the background keeps its own capture date.
  const captureYear = backgroundYear;
  const mangroveComparison = useMemo(
    () =>
      mangroveComparisonForYear(
        mangroveManifest,
        captureYear,
        historicalReferences,
      ),
    [mangroveManifest, captureYear, historicalReferences],
  );
  const localCaptureDates = useMemo(() => {
    if (!center || !temporalRegistry) return null;
    return (
      Object.values(temporalRegistry.sites).find(
        (site) =>
          Math.hypot(center[0] - site.center[0], center[1] - site.center[1]) <
          0.001,
      )?.captureDates ?? null
    );
  }, [center, temporalRegistry]);
  const resolveTemporal = useMemo(
    () =>
      createTemporalEvidenceResolver(
        evidence,
        temporalRegistry,
        allowUndatedReferences,
      ),
    [evidence, temporalRegistry, allowUndatedReferences],
  );
  const temporal = useMemo(
    () => resolveTemporal(captureFrame),
    [resolveTemporal, captureFrame],
  );
  const annualMangrove = mangroveComparison && mangroveChanges?.features.every(
    feature=>feature.properties.year===mangroveComparison.year,
  ) ? mangroveChanges : null;
  const vegetationEvidence = useMemo<EvidenceData>(() => {
    const reference =
      mangrove2020Visible && historicalReferences
        ? (temporal.layers.vegetation?.features ?? [])
        : [];
    return {
      type: 'FeatureCollection',
      features: [...(annualMangrove?.features ?? []), ...reference],
    };
  }, [
    temporal.layers.vegetation,
    annualMangrove,
    mangrove2020Visible,
    historicalReferences,
  ]);
  const displayedEvidence = useMemo<EvidenceLayers>(
    () => ({ ...temporal.layers, vegetation: vegetationEvidence }),
    [temporal.layers, vegetationEvidence],
  );
  const [referencesVisible, setReferencesVisible] = useState(false);
  const [structureData, setStructureData] = useState<StructureData | null>(
    null,
  );
  const [structureStatus, setStructureStatus] = useState<Status>('loading');
  const [structureAttempt, setStructureAttempt] = useState(0);
  const [structureFilter, setStructureFilter] =
    useState<StructureFilter>('all');
  const [structureSelected, setStructureSelected] =
    useState<StructureFeature | null>(null);
  const [structureExpanded, setStructureExpanded] = useState(false);
  const filteredStructures = useMemo<StructureData | null>(
    () =>
      structureData
        ? {
            type: 'FeatureCollection',
            features: structureData.features.filter(
              (f) =>
                structureFilter === 'all' ||
                f.properties['Type of st'] === structureFilter,
            ),
          }
        : null,
    [structureData, structureFilter],
  );
  const onFrameChange = useCallback((frame: CaptureFrame) => {
    setCaptureFrames((previous) => {
      const before = previous[frame.source];
      return before?.key === frame.key && before.date === frame.date &&
        before.center?.join(',') === frame.center?.join(',')
        ? previous : { ...previous, [frame.source]: frame };
    });
    // Hidden sources may keep their own scoped date, but never drive the
    // indicators or clear the selection of the source the visitor is viewing.
    if (frame.source !== (imageSource === 'detail' ? 'esri' : imageSource === 'archive' ? 'archive' : 'sentinel')) return;
    if (captureKey.current !== frame.key) {
      setEvidenceSelected(null);
      setStructureSelected(null);
      captureKey.current = frame.key;
    }
    const period = publishedPeriodForYear(
      frame.date ? Number(frame.date.slice(0, 4)) : null,
    );
    if (period) setLastDatedSeries(period.series);
  }, [imageSource]);
  const [manualResearchSeries, setManualResearchSeries] =
    useState<ResearchSeries>('S2');
  const [researchFollowsTime, setResearchFollowsTime] = useState(true);
  const publishedPeriod = publishedPeriodForYear(
    captureFrame?.date ? Number(captureFrame.date.slice(0, 4)) : null,
  );
  useEffect(()=>{if(coastalChapter==='alec'){const chosen=researchSeries.find(item=>item.id===manualResearchSeries)!;const [first,last]=chosen.period.split('–').map(Number);const period=publishedPeriodForYear(backgroundYear);if(period&&(backgroundYear<first||backgroundYear>last))setManualResearchSeries(period.series);setResearchFollowsTime(false);}},[coastalChapter,backgroundYear,manualResearchSeries]);
  const researchSeriesId = researchFollowsTime
    ? (publishedPeriod?.series ?? lastDatedSeries)
    : manualResearchSeries;
  const [researchInventory, setResearchInventory] =
    useState<ErosionData | null>(null);
  const [researchSelectedId, setResearchSelectedId] = useState<string | null>(null);
  const evolutionSpatialIndex = useMemo(() => researchInventory && evolutionIndex ? createEvolutionSpatialIndex(researchInventory, evolutionIndex) : null, [researchInventory, evolutionIndex]);
  const viewportInventory = useMemo(() => evolutionSpatialIndex ? evolutionInventoryInView(evolutionSpatialIndex, viewBounds, researchSelectedId) : null, [evolutionSpatialIndex, viewBounds, researchSelectedId]);
  const researchByPeriod = useMemo(
    () =>
      researchInventory
        ? Object.fromEntries(
            researchSeries.map((series) => [
              series.id,
              selectPublishedPeriod(researchInventory, series.id),
            ]),
          )
        : null,
    [researchInventory],
  );
  const researchData = useMemo(() => evolutionMode ? viewportInventory && evolutionIndex ? evolutionMapData(viewportInventory, evolutionIndex, backgroundYear, pilotMode ? pilotCutId : null) : null : researchByPeriod?.[researchSeriesId] ?? null, [evolutionMode, viewportInventory, evolutionIndex, backgroundYear, pilotMode, pilotCutId, researchByPeriod, researchSeriesId]);
  const historicalContext=useMemo(()=>evolutionMode?historicalContextForYear(viewportInventory,evolutionIndex,backgroundYear):null,[evolutionMode,viewportInventory,evolutionIndex,backgroundYear]);
  const researchBars = useMemo(() => researchInventory ? createTransectIndex(researchInventory.features) : null, [researchInventory]);
  const [researchStatus, setResearchStatus] = useState<Status>('loading');
  const [researchVisible, setResearchVisible] = useState(true);
  const researchBar = researchBars?.byId.get(researchSelectedId ?? '') ?? null;
  const researchFootprint = useMemo(() => researchBar && researchBars ? barFootprint(researchBar, researchBars) : null, [researchBar, researchBars]);
  const researchSelected = useMemo(
    () =>
      researchData?.features.find(
        (feature) => feature.properties.idPol_Tran === researchSelectedId,
      ) ?? null,
    [researchData, researchSelectedId],
  );
  const evolutionSelectedId = pilotMode ? pilotBar?.properties.idPol_Tran : researchSelectedId;
  const selectedEvolution = useMemo(() => evolutionIndex && evolutionSelectedId ? evolutionComparison(evolutionIndex, evolutionSelectedId, backgroundYear, pilotMode ? pilotCutId : null) : null, [evolutionIndex, evolutionSelectedId, backgroundYear, pilotMode, pilotCutId]);
  const evolutionFootprint = pilotMode ? pilotFootprint : researchFootprint;
  const selectedEvolutionRuler = useMemo(() => selectedEvolution && evolutionFootprint ? evolutionRuler(selectedEvolution, evolutionFootprint.origin) : null, [selectedEvolution, evolutionFootprint]);
  const selectedEvolutionLabels = useMemo(() => selectedEvolution ? evolutionBarLabels(selectedEvolution, evolutionFootprint?.origin) : [], [selectedEvolution, evolutionFootprint]);
  const setResearchSelected = (feature: ErosionFeature | null) =>
    setResearchSelectedId(feature?.properties.idPol_Tran ?? null);
  const [researchAttempt, setResearchAttempt] = useState(0);
  const mapConfig = useMemo<MapConfig | null>(
    () =>
      config
        ? {
            ...config,
            focus_bounds: municipalityScope?.municipality.bounds??CHELEM_PROGRESO_OVERVIEW,
            places:municipalityScope?[...coastalPlaces.filter(p=>p.municipality===municipalityScope.municipality.name),...(config.neighbour_places??[])]:coastalPlaces.length?coastalPlaces:config.places,
          }
        : null,
    [config,coastalPlaces],
  );
  const municipalPhotoGroups=useMemo(()=>{
    const catalogue=municipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue;
    return [...new Set(coastalPlaces.map(place=>place.municipality).filter((m):m is string=>!!m))].map(municipality=>{
      const scope=municipalPhotoLocation(catalogue,municipality);
      const options=scope?(coastalResultView==='scenario'?municipalDatedOptions:municipalComparisonOptions)(receivedPhotoCatalogueJson.items as WaybackItem[],catalogue,municipality,scope.coordinates,17,scope.coordinates):[];
      const years=coastalChapter==='current'?options.map(o=>o.year).filter(year=>year>=activeYearBounds.first&&year<=activeYearBounds.last):municipalPhotoYears(catalogue,municipality,activeYearBounds.first,activeYearBounds.last);
      return {municipality,places:coastalPlaces.filter(place=>place.municipality===municipality),years};
    });
  },[coastalPlaces,coastalChapter,coastalResultView,activeYearBounds.first,activeYearBounds.last]);

  const map = useRef<MapHandle>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!pilotMode) { pilotLocated.current = false; return; }
    if (ready && pilotSeries && !pilotLocated.current) {
      pilotLocated.current = true;
      map.current?.coverage(pilotSeries.pilot.bounds);
    }
  }, [pilotMode, ready, pilotSeries]);
  const sentinelSector = center && center[0] < -90.06 ? 'west' : 'east';
  const sectorScenes =
    sentinelManifest?.scenes.filter((s) => s.sector === sentinelSector).sort((a, b) => a.datetime.localeCompare(b.datetime)) ?? [];
  const chosen = sentinelManifest?.scenes.find((s) => s.id === sentinelId);
  const sectorScene =
    chosen?.sector === sentinelSector && Number(chosen.datetime.slice(0, 4)) === backgroundYear
      ? chosen
      : datedChoiceForYear(sectorScenes, backgroundYear, (scene) => scene.datetime);
  const sentinelScene =
    imageSource === 'sentinel' ? (sectorScene ?? null) : null;
  const sentinelWarm = useMemo(() => {
    if (!sentinelScene) return [];
    const scenes =
      sentinelManifest?.scenes.filter(
        (scene) => scene.sector === sentinelScene.sector,
      ) ?? [];
    const index = scenes.findIndex((scene) => scene.id === sentinelScene.id);
    return [scenes[index - 1], scenes[index + 1]].filter(Boolean);
  }, [sentinelManifest, sentinelScene]);
  useEffect(() => {
    const c = new AbortController();
    void getJson<TemporalRegistry>(
      'problems/temporal-observations.json',
      c.signal,
    )
      .then(setTemporalRegistry)
      .catch(() => {});
    return () => c.abort();
  }, []);
  useEffect(() => {
    const c = new AbortController();
    let stopped = false;
    const timeout = window.setTimeout(() => c.abort(), 30000);
    getJson<MapConfig>('config.json', c.signal)
      .then(
        (config) => {
          if (!stopped) {
            setConfig(config as MapConfig);
            setData(current=>current??emptyTerritory());
          }
        },
      )
      .catch(() => {
        if (!stopped) setError('No se pudo cargar el mapa.');
      })
      .finally(() => window.clearTimeout(timeout));
    getJson<Source[]>('sources.json', c.signal)
      .then((s) => {
        if (!stopped) {
          setSources(s);
          setSourceState('ready');
        }
      })
      .catch(() => {
        if (!stopped) setSourceState('error');
      });
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);
  useEffect(()=>{
    if(geographyLoaded.current || panel!=='sources' && panel!=='problems')return;
    const controller=new AbortController();
    const ids=['context','localities','coast','mangrove','wetlands','water'] as const;
    void Promise.all(ids.map(id=>getJson<TerritoryData['coast']>(id+'.geojson',controller.signal))).then(layers=>{
      if(controller.signal.aborted)return;
      setData({context:layers[0],localities:layers[1],coast:layers[2],mangrove:layers[3],wetlands:layers[4],water:layers[5]});geographyLoaded.current=true;
    }).catch(()=>{});
    return()=>controller.abort();
  },[panel,attempt]);
  useEffect(() => {
    const c = new AbortController();
    let stopped = false;
    const t = window.setTimeout(() => c.abort(), 20000);
    const files: Record<EvidenceKind, string> = {
      barriers: 'structure-outlines.geojson',
      geotubes: 'geotube-historical-axes.geojson',
      vegetation: 'disturbed-mangrove-2020.geojson',
    };
    for (const kind of Object.keys(files) as EvidenceKind[]) {
      void getJson<unknown>('problems/' + files[kind], c.signal)
        .then((d) => {
          if (!isEvidenceData(d)) throw new Error('Geometrías inválidas');
          if (!stopped) {
            setEvidence((v) => ({ ...v, [kind]: d }));
            setEvidenceStatus((v) => ({ ...v, [kind]: 'ready' }));
          }
        })
        .catch(() => {
          if (!stopped) setEvidenceStatus((v) => ({ ...v, [kind]: 'error' }));
        });
    }
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(t);
    };
  }, [evidenceAttempt]);
  useEffect(() => {
    const c = new AbortController();
    let stopped = false;
    const timeout = window.setTimeout(() => c.abort(), 30000);
    setMangroveManifest(null);
    setMangroveChanges(null);
    setMangroveStatus('loading');
    getJson<MangroveManifest>('problems/gmw/manifest.json', c.signal)
      .then((manifest) => {
        if (
          manifest.source.version !== '4.1.12' ||
          !manifest.annual_comparisons.length
        )
          throw new Error('Serie anual inválida');
        if (!stopped) {
          setMangroveManifest(manifest);
        }
      })
      .catch(() => {
        if (!stopped) setMangroveStatus('error');
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(timeout);
    };
  }, [evidenceAttempt]);
  useEffect(() => {
    if(!mangroveManifest)return;
    const year=mangroveComparison?.year;
    setMangroveChanges(null);
    if(year===undefined){setMangroveStatus('ready');return;}
    const controller=new AbortController();
    setMangroveStatus('loading');
    void loadMangroveYear(year,controller.signal,municipalityScope).then(changes=>{
      if(!controller.signal.aborted){setMangroveChanges(changes);setMangroveStatus('ready');}
    }).catch(()=>{if(!controller.signal.aborted)setMangroveStatus('error');});
    return()=>controller.abort();
  }, [mangroveManifest,mangroveComparison?.year,evidenceAttempt]);
  useEffect(() => {
    if (!referencesVisible && panel !== 'problems') return;
    const c = new AbortController();
    let stopped = false;
    const t = window.setTimeout(() => c.abort(), 20000);
    getJson<unknown>('problems/structures-yucatan.geojson', c.signal)
      .then((d) => {
        if (!isStructureData(d)) throw new Error('Inventario inválido');
        if (!stopped) {
          setStructureData(d);
          setStructureStatus('ready');
        }
      })
      .catch(() => {
        if (!stopped) setStructureStatus('error');
      })
      .finally(() => window.clearTimeout(t));
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(t);
    };
  }, [structureAttempt, referencesVisible, panel]);
  useEffect(() => {
    const c = new AbortController();
    let stopped = false;
    const t = window.setTimeout(() => c.abort(), 20000);
    if(coastalChapter!=='alec' && coastalAnalysisMode!=='1993' && panel!=='problems' && !pilotMode){window.clearTimeout(t);return;}
    getJson<ErosionData>('problems/s34-inventory.geojson', c.signal)
      .then((inventory) => {
        if (!stopped) {
          setResearchInventory(inventory);
          setResearchStatus('ready');
        }
      })
      .catch(() => {
        if (!stopped) setResearchStatus('error');
      })
      .finally(() => window.clearTimeout(t));
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(t);
    };
  }, [researchAttempt,coastalAnalysisMode,panel,pilotMode,coastalChapter]);
  useEffect(() => {
    if (imageSource !== 'sentinel') return;
    const c = new AbortController();
    let stopped = false;
    const t = window.setTimeout(() => c.abort(), 20000);
    getJson<SentinelManifest>('sentinel/manifest.json', c.signal)
      .then((d) => {
        if (!stopped) setSentinelManifest(d);
      })
      .catch(() => {
        if (!stopped) setSentinelError(true);
      })
      .finally(() => window.clearTimeout(t));
    return () => {
      stopped = true;
      c.abort();
      window.clearTimeout(t);
    };
  }, [sentinelAttempt, imageSource]);
  const onReady = useCallback(() => {
    setReady(true);
    setError('');
  }, []);
  const onError = useCallback((s: string) => setError(s), []);
  const onView = useCallback((p: [number, number], z: number, bounds: Bounds) => {
    setCenter(previous => previous?.[0] === p[0] && previous?.[1] === p[1] ? previous : p);
    setViewZoom(z);
    setViewBounds(previous => previous.every((v, i) => v === bounds[i]) ? previous : bounds);
  }, []);
  const onZoom = useCallback(
    (min: boolean, max: boolean) => setZoomState({ min, max }),
    [],
  );
  const noop = useCallback(() => {}, []);
  function closePanel() {
    setPanel(null);
    setResearchSelected(null);
    setStructureSelected(null);
    setEvidenceSelected(null);
    requestAnimationFrame(() => nav.current?.querySelector('button')?.focus());
  }
  function openPanel(next: Panel) {
    setPanel((p) => (p === next ? null : next));
  }
  function navigatePlace(id: string) {
    setPilotMode(false);
    const place = id.startsWith('municipality:')?municipalPhotoLocation(municipalPhotoCatalogueJson as unknown as MunicipalPhotoCatalogue,id.slice('municipality:'.length)):coastalViews.find((p) => p.id === id)??coastalPlaces.find(p=>p.id===id)??mapConfig?.places.find(p=>p.id===id);
    if (!place) return;
    const municipality=id.startsWith('municipality:')?id.slice('municipality:'.length):coastalPlaces.find(p=>p.id===id)?.municipality;
    if(municipalityScope&&municipality&&municipality!==municipalityScope.municipality.name){const page=municipalityPages.find(p=>p.name===municipality);if(page)window.location.assign(municipalityHref(page.slug));return;}
    setActivePlace(id);
    setCoastPanorama(false);
    setPanel(null);
    setHistoricalReferences(true);
    setIssueVisibility({ ...initialIssues, vegetation: true });
    setEvidenceSelected(null);
    setStructureSelected(null);
    setResearchSelected(null);
    if(place.bounds)map.current?.coverage(place.bounds);
  }
  function selectStructure(f: StructureFeature) {
    setEvidenceSelected(null);
    setResearchSelected(null);
    setStructureSelected(f);
    setStructureExpanded(true);
    setPanel('problems');
  }
  function showImage(info: ImageInfo) {
    if (imageSource === 'detail') setEsriImageInfo(info);
    else if (imageSource === 'sentinel') setSentinelImageInfo(info);
    setPanel('image');
  }
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
        setResearchSelected(null);
        setStructureSelected(null);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [panel]);
  const activeResearch = researchSeries.find((s) => s.id === researchSeriesId)!;
  const researchMatches =
    historicalReferences ||
    studyMatchesCapture(activeResearch.period, captureFrame);
  return (
    <main className={"explorer is-entered is-satellite minimal-explorer" + (pilotMode ? " is-littoral-pilot" : "")+(coastalChapter==='historical'?" is-documentary":"")}>
      <a className="skip-link" href="#primary-navigation">
        Ir a los controles
      </a>
      {reviewMode&&<form aria-label="Recorrido local de revisión" style={{position:'absolute',right:12,top:72,zIndex:1100,background:'rgba(13,38,43,.94)',border:'1px solid #78908c',borderRadius:12,padding:10,color:'#fff',fontSize:11,maxWidth:290}} onSubmit={event=>{
        event.preventDefault();const target=scenarioModel?.targets.find(t=>t.id===reviewProfile.trim());
        if(!target){setReviewError('Perfil no encontrado');return;}
        setReviewError('');map.current?.restore({center:target.p,zoom:reviewZoom,bearing:0});
      }}>
        <label>Perfil de revisión <input aria-label="Perfil de revisión" value={reviewProfile} onChange={e=>setReviewProfile(e.target.value)} style={{color:'#183c41',width:140,background:'#fff',padding:4,margin:4}}/></label>
        <label>Zoom <select aria-label="Zoom de revisión" value={reviewZoom} onChange={e=>setReviewZoom(Number(e.target.value))} style={{background:'#183c41',padding:4}}>{[11,13,15,16,17,18,19].map(z=><option key={z}>{z}</option>)}</select></label>
        <button type="submit" style={{padding:5,border:'1px solid #abc',borderRadius:6,margin:4}}>Revisar punto</button>
        <output style={{display:'block'}} aria-label="Estado del recorrido">{reviewError||`${photoLocation?.municipality??'Panorámica'} · año ${backgroundYear} · visible ${coastalResultView==='scenario'?backgroundYear:photoComparisonPresentation?.year??'pendiente'} · ${activeRegional?.features.length??0} resultados · ${displayedRasterKey??'sin imagen'} · centro ${center?.map(n=>n.toFixed(6)).join(',')??'pendiente'} · zoom ${viewZoom.toFixed(1)}`}</output>
      </form>}
      {mapConfig && data && (
        <TerritoryMap
          key={attempt}
          ref={map}
          onRasterFrameDisplayed={setDisplayedRasterKey}
          referenceUnderlay={referenceEsriFallback||!displayedRasterKey?.startsWith('esri:')} keepRasterReference={!referenceEsriFallback}
          fallbackFrame={annualFallback?.frame}
          fallbackRetryToken={fallbackAttempt}
          coastalCoverage={researchVisible&&!scenarioActive&&coastalChapter==='current'&&coverageVisible&&['regional','2015','2020'].includes(coastalAnalysisMode)?completeAssessment:null}
          shorelinePair={researchVisible&&coastalChapter==='current'&&shorelineVisible ? activeShorelines : null}
          coastalAnalysis={researchVisible&&coastalChapter==='current'&&coastalAnalysisMode !== '1993' ? activeRegional : null}
          config={mapConfig}
          data={data}
          visibility={allHidden}
          imageryVisible={referenceEsriFallback||!backgroundUnavailable}
          entered
          selected={null}
          panelOpen={false}
          structures={filteredStructures}
          structuresVisible={
            coastalChapter==='current' && !pilotMode && referencesVisible &&
            historicalReferences &&
            issueVisibility.barriers &&
            structureStatus === 'ready'
          }
          evidence={coastalChapter==='current'?displayedEvidence:{barriers:null,geotubes:null,vegetation:null}}
          evidenceSelected={evidenceSelected}
          onEvidenceSelect={(selection) => {
            setEvidenceSelected(selection);
            setStructureSelected(null);
            setResearchSelected(null);
            setPanel('problems');
          }}
          structureSelected={structureSelected}
          onStructureSelect={selectStructure}
          issueVisibility={coastalChapter!=='current'||pilotMode||backgroundYear<2011 ? { ...issueVisibility, geotubes: false, barriers: false, vegetation: false } : issueVisibility}
          onCaseSelect={noop}
          studyFlight={null}
          satellite={imageSource === 'detail' && !annualFallback && !backgroundUnavailable ? historicalSatellite : null}
          satelliteWarm={imageSource === 'detail' && !annualFallback && !backgroundUnavailable ? satelliteWarm : []}
          sentinelWarm={imageSource === 'sentinel' && !annualFallback && !backgroundUnavailable ? sentinelWarm : []}
          satelliteDetail={resolvedSatelliteDetail}
          onSatelliteStatus={onSatelliteStatus}
          sentinel={imageSource === 'sentinel' && !annualFallback && !backgroundUnavailable ? sentinelScene : null}
          sentinelMode={!referenceEsriFallback&&(imageSource !== 'detail' || backgroundUnavailable)}
          history={combinedHistory}
          epoch={imageSource === 'archive' ? archiveEpoch?.id ?? null : null}
          timelineOpen
          timelineExpanded={false}
          onHistoryStatus={onHistoryStatus}
          research={researchData}
          historicalContext={researchVisible?historicalContext:null}
          roadKilometres={roadKilometres}
          roadSearchSelection={roadSearchSelection}
          researchVisible={researchVisible&&(coastalChapter==='alec' || coastalChapter==='current'&&coastalAnalysisMode === '1993' && (evolutionMode || !pilotMode && researchMatches))}
          researchEvolutionYear={evolutionMode ? backgroundYear : null}
          transectFootprint={researchVisible?(evolutionMode?evolutionFootprint:pilotMode?pilotFootprint:researchMatches?researchFootprint:null):null}
          transectRuler={researchVisible?(evolutionMode ? selectedEvolutionRuler : pilotMode ? pilotRuler : null):null}
          transectCut={evolutionMode ? selectedEvolution?.afterCut ?? null : pilotMode ? pilotCut : null}
          transectLabels={researchVisible&&evolutionMode ? selectedEvolutionLabels : undefined}
          onBarHelpOpen={() => setPanel(null)}
          pilot={researchVisible&&!evolutionMode && pilotMode && pilotMapData && pilotMapPoints && pilotAxes ? { data: pilotMapData, axes: pilotAxes, labels: pilotLabels, points: pilotMapPoints, selectedId: pilotBar?.properties.idPol_Tran ?? null, onSelect: (id) => { setPilotSelectedId(id); setPanel(null); } } : null}
          researchSelected={researchSelected}
          onResearchSelect={(f) => {
            setEvidenceSelected(null);
            setStructureSelected(null);
            setResearchSelected(f);
            const inPilot = pilotMode && pilotBars?.byId.has(f.properties.idPol_Tran);
            if (inPilot) setPilotSelectedId(f.properties.idPol_Tran);
            else if (pilotMode) { setPilotMode(false); setImageYear(backgroundYear); }
            setPanel(inPilot ? 'pilot' : 'problems');
          }}
          onPlaceSelect={navigatePlace}
          onSelect={noop}
          onReady={onReady}
          onError={onError}
          onZoom={onZoom}
          onImageryError={noop}
          onView={onView}
        />
      )}
      <header className="topbar">
        <div className="header-actions">
          {!pilotMode && <button
            className="minimal-problems"
            aria-label="Problemas"
            aria-expanded={panel === 'problems'}
            onClick={() => openPanel('problems')}
          >
            <Waves />
            <span>Problemas</span>
          </button>}
          <button
            className="minimal-info"
            aria-label="Fuentes"
            title="Fuentes"
            onClick={() => openPanel('sources')}
          >
            <BookOpen />
          </button>
        </div>
      </header>
      <nav
        ref={nav}
        id="primary-navigation"
        className="map-nav"
        aria-label="Exploración"
      >
        {municipalityScope&&<a className="municipal-home-link" href="/">← Menú principal</a>}
        <CoastalPlacePicker label={municipalityScope?.municipality.name} groups={municipalPhotoGroups} value={activePlace??''} title={photoLocation?'Costa de '+projectCoastLabel(photoLocation.municipality):'Selecciona un municipio'} disabled={!ready&&placesStatus!=='error'} loading={placesStatus==='loading'&&!coastalPlaces.length} error={placesStatus==='error'} showYears={coastalChapter!=='historical'&&imageSource==='detail'} onSelect={navigatePlace} onRetry={()=>setPlacesAttempt(n=>n+1)}/>
        <Button variant="ghost" disabled={!ready} aria-label={municipalityScope?"Vista completa del municipio":"Vista panorámica de Celestún a El Cuyo"} onClick={() => { if(municipalityScope){map.current?.coverage(municipalityScope.municipality.bounds);return;} if(coastalChapter==='current'){setHistoricalSatellite(historicalSatellite);setChapterYears(years=>withChapterYear(years,'current',backgroundYear));}setActivePlace(null);setCoastPanorama(true); map.current?.coverage([-90.55,20.65,-87.15,22]); }}>{municipalityScope?'Ver municipio':'Vista panorámica'}</Button>
        {municipalityScope&&<RoadKilometreSearch records={roadSearchRecords} onSelect={record=>{setRoadSearchSelection(record);map.current?.restore({center:record.coordinate,zoom:17,bearing:0});}}/>}
      </nav>
      {coastalChapter==='current' && evolutionMode && coastalAnalysisMode === '1993' && researchVisible && <CoastalEvolutionLegend index={evolutionIndex} year={backgroundYear} status={evolutionStatus} historicalContext={!!historicalContext?.features.length} trendStatus={trendStatus} />}
      {!evolutionMode && pilotMode && pilotCut && pilotSeries && <LittoralLegend cut={pilotCut} count={pilotSeries.pilot.transects.features.length} />}
      <CoastalPeriodSections historicalEvidence={<Suspense fallback={<p>Cargando cálculo histórico…</p>}><HistoricalErosionSummary year={backgroundYear} onYear={setImageYear}/></Suspense>} onPartialYear={year=>{setImageYear(year);setPhotoYear(year,'archive');setImageSourceState('archive');setArchiveKind('inegi');setPanel(null);setSatelliteStatus('loading');const epoch=historicalEpochForYear(archiveManifests.inegi,year);const bounds=historicalEpochBounds(archiveManifests.inegi,epoch?.id??null);if(bounds)map.current?.coverage(bounds);}} chapter={coastalChapter} onChapter={chapter=>{setCoastalChapter(chapter);setPanel(null);setEvidenceSelected(null);setResearchSelectedId(null);setPilotMode(false);setEvolutionMode(chapter!=='alec');if(chapter==='alec'){setResearchFollowsTime(false);}}} series={researchSeriesId} onSeries={series=>{setManualResearchSeries(series);setImageYear(series==='L5'?2011:2021);setResearchFollowsTime(false);setResearchSelectedId(null);}} count={researchData?.features.length??0} status={researchStatus} onRetry={()=>setResearchAttempt(n=>n+1)}>
        <CoastalAnalysisControls reviewedMunicipality={['Progreso','Hunucmá','Dzemul'].includes(municipalityScope?.municipality.name??photoLocation?.municipality??'')} scopeLabel={municipalityScope?.municipality.name} resultView={coastalResultView} alignmentSummary={alignedCoast?.summary} visibleCount={photoResultsInView} displayedYear={coastalResultView==='scenario'?backgroundYear:photoComparisonPresentation?.year??null} year={backgroundYear} years={availableAnalysisYears} municipality={photoLocation?.municipality??null} onYearChange={setImageYear} comparableCount={activeRegional?.features.filter(f=>f.properties.reference_only!==true).length??0} referenceCount={activeRegional?.features.filter(f=>f.properties.reference_only===true).length??0} status={scenarioStatus!=='ready'?scenarioStatus:photoComparisonStatus==='ready'&&coastalResultView==='photos'&&imageSource==='detail'&&photoComparisonCandidate!==photoComparisonPresentation?'loading':photoComparisonStatus} onRetry={()=>setAttempt(n=>n+1)}/>
        {!scenarioActive&&coverageRows.length>0&&['regional','2015','2020'].includes(coastalAnalysisMode)&&<CoastalCoverageSummary rows={coverageRows} year={backgroundYear} visible={coverageVisible} onVisible={setCoverageVisible}/>}
        {seriesError&&<button className="coastal-popup-retry" onClick={()=>setAttempt(n=>n+1)}>Reintentar inventario regional</button>}
      </CoastalPeriodSections>
      {coastalChapter!=='historical'&&<LittoralBackgroundDate compact source={imageSource} info={imageInfo} year={backgroundYear} status={imageSource==='detail'&&backgroundUnavailable?'ready':satelliteStatus}
        backgroundLabel={visibleBackgroundLabel}
        unavailable={false}
        note={'Análisis '+backgroundYear+' · '+(imageInfo?'imagen visible: '+imageInfo.capture+'. ':'fecha visible en consulta. ')+(!displayedDatedInView?'El centro está fuera de la cobertura de esta imagen; el fondo es una referencia Esri sin fecha local confirmada. ':requestedDatedRaster&&requestedDatedRaster.key!==displayedRasterKey?'La selección solicitada todavía no sustituye el fondo visible. ':multiArchive&&!multiArchiveReady?'El archivo se está preparando; todavía no se confirma su fecha visible. ':'')+(verifyingEsri?'Se está comprobando la fecha local. ':'')+'La fotografía conserva su fecha de captura.'} />}
      {coastalChapter!=='historical'&&imageSource === 'archive' && <ArchiveControls partial={archiveKind==='inegi'||archiveKind==='landsat'} kind={archiveKind} manifest={archiveManifest} epoch={archiveEpoch} year={photoYear} covered={archiveCovered} status={coverageStatus !== 'ready' ? coverageStatus : archiveManifestStatus[archiveKind]}
        availableKinds={availableArchiveKinds} excludedCount={archiveManifests[archiveKind]?.epochs.filter(entry => entry.year === photoYear).length ?? 0}
        onKind={setArchiveKind}
        onCoverage={() => { if (archiveBounds) map.current?.coverage(archiveBounds); }} onInfo={() => setPanel('image')} onRetry={() => setArchiveAttempt(n => n + 1)} /> }

      {coastalChapter==='current' && !evolutionMode && !pilotMode && researchVisible && researchMatches && (
        <div className="research-map-legend" aria-label="Leyenda de erosión">
          <p>
            Erosión publicada <span>· {activeResearch.period}</span>
          </p>
          <small>Investigación publicada · Alec y colaboradores</small>
          <small className="published-period-note">
            {researchFollowsTime
              ? publishedPeriod?.containsYear
                ? 'Promedio del periodo · sigue el año'
                : captureFrame?.date
                  ? 'Referencia: sin medición para ' +
                    captureFrame.date.slice(0, 4)
                  : 'Fecha de imagen en consulta'
              : 'Periodo fijo'}
          </small>
          <div className="erosion-legend">
            <span>
              <i className="erosion-high" />
              Alta
            </span>
            <span>
              <i className="erosion-low" />
              Baja
            </span>
            <span>
              <i className="coast-stable" />
              Estable
            </span>
            <span>
              <i className="coast-accretion" />
              Acumulación
            </span>
          </div>
        </div>
      )}
      {coastalChapter==='current' && !pilotMode && issueVisibility.vegetation &&
        mangroveComparison &&
        mangroveStatus === 'ready' && (
          <div
            className="mangrove-map-legend"
            aria-label="Cambio de cobertura de manglar"
          >
            <p>
              Manglar · {mangroveComparison.previous_year} →{' '}
              {mangroveComparison.year}
              {mangroveComparison.reference ? ' · referencia' : ''}
            </p>
            <span>
              <i style={{ background: '#f46c55' }} />
              Pérdida
            </span>
            <span>
              <i style={{ background: '#4fc4ad' }} />
              Ganancia
            </span>
            <small>Estimación anual · 30 m</small>
          </div>
        )}
      <fieldset
        className="map-tools"
        aria-label="Controles del mapa"
        disabled={!ready || !!error}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Acercar"
          disabled={zoomState.max}
          onClick={() => map.current?.zoom(1)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Alejar"
          disabled={zoomState.min}
          onClick={() => map.current?.zoom(-1)}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={municipalityScope?"Ver municipio":"Ver Chelem y Progreso"}
          onClick={() => {
            setActivePlace(null);setCoastPanorama(false);
            map.current?.home();
          }}
        >
          <LocateFixed />
        </Button>
      </fieldset>
      {coastalChapter==='historical'&&<Suspense fallback={<output className="minimal-loading">Cargando archivo histórico…</output>}><HistoricalDocumentViewer year={backgroundYear} onYear={setImageYear}/></Suspense>}
      <div hidden={coastalChapter==='historical'||imageSource !== 'detail' || pilotMode}>
        <SatelliteTimeline reviewedOnly={coastalChapter==='current'&&['Progreso','Hunucmá','Dzemul'].includes(municipalityScope?.municipality.name??photoLocation?.municipality??'')} scenarioReference={coastalChapter==='current'&&coastalResultView==='scenario'} selectedPhotoYear={currentComparisonPhoto?.year} compatibleComparison={coastalChapter==='current'} displayedInfo={imageInfo} firstYear={activeYearBounds.first} lastYear={activeYearBounds.last} photoCatalogue={municipalPhotoCatalogueJson} scopeKey={coastalChapter+':'+(photoLocation?.municipality??'panorama')} sourceAvailability={{sentinel:{disabled:backgroundYear<2015,reason:backgroundYear<2015?'Sentinel-2 no tiene imágenes de estos años.':'Consulta Sentinel del año elegido'}}} onFallbackRetry={()=>setFallbackAttempt(n=>n+1)} fallbackInfo={annualFallback?.info} fallbackLabel={annualFallback?.label} comparisonPeriod={coastalChapter==='alec'?activeResearch.period:coastalChapter==='historical'?'archivo 1910–1985':undefined} referenceYear={coastalChapter==='current'&&coastalAnalysisMode==='2010'?2010:undefined}
          year={backgroundYear}
          onYearChange={setImageYear}
          active={coastalChapter!=='historical'&&imageSource === 'detail'}
          onSource={(s) => {
            if (s === imageSource) return;
            setImageSource(s);
            setPanel(null);
          }}
          center={center}
          viewZoom={viewZoom}
          detail={resolvedSatelliteDetail}
          selected={historicalSatellite}
          flightSelected={null}
          onFlightChange={noop}
          localCaptureDates={localCaptureDates}
          flights={[]}
          onChange={(item) => setHistoricalSatellite(item)}
          photoLocation={photoLocation}
          imageStatus={satelliteStatus}
          onInfo={()=>setPanel('image')}
          onMetadata={setEsriImageInfo}
          onFrameChange={onFrameChange}
          onWarmFrames={onWarmFrames}
        />
      </div>
      {imageSource === 'sentinel' && (
        <div hidden={pilotMode || evolutionMode || coastalChapter!=='current'}><SentinelTimeline
          year={backgroundYear}
          onYearChange={setImageYear}
          error={sentinelError}
          manifest={sentinelManifest}
          selected={sentinelScene}
          center={center}
          status={satelliteStatus}
          onSource={(s) => {
            if (s === imageSource) return;
            setImageSource(s);
            setPanel(null);
          }}
          onChange={(s) => setSentinelId(s.id)}
          onRetry={() => {
            setSentinelError(false);
            setSentinelAttempt((n) => n + 1);
          }}
          onInfo={info=>annualFallback?setPanel('image'):showImage(info)}
          onMetadata={setSentinelImageInfo}
          onFrameChange={onFrameChange}
        /></div>
      )}
      {coastalChapter!=='historical' && (evolutionMode||coastalChapter!=='current') && imageSource !== 'detail' && <DateSourcePicker source={imageSource} value={String(photoYear)}
        options={(imageSource==='archive'?[...new Set(archiveManifest?.epochs.map(epoch=>epoch.year)??[])]:[2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]).filter(year=>year>=activeYearBounds.first&&year<=activeYearBounds.last&&(coastalChapter!=='current'||availableAnalysisYears.includes(year))).sort((a,b)=>a-b).map(year=>({value:String(year),label:String(year)}))}
        label="Año del mapa disponible" availability={{sentinel:{disabled:backgroundYear<2015,reason:'Sentinel-2 comienza en 2015'}}} status={satelliteStatus}
        caption={requestedPhotoCaption}
        onDate={value=>{const year=Number(value);setPhotoYear(year,imageSource==='archive'?'archive':'sentinel');setImageYear(year);}} onSource={setImageSource} onInfo={()=>setPanel('image')}
        onRetry={()=>{if(annualFallback||hasPcAnnualBackdrop(backgroundYear))setFallbackAttempt(n=>n+1);else if(imageSource==='archive')setArchiveAttempt(n=>n+1);else setSentinelAttempt(n=>n+1);}}/>}

      {!evolutionMode && pilotMode && pilotSeries && pilotCut && <LittoralTimeline series={pilotSeries} cut={pilotCut} year={selectedPilotYear} status={satelliteStatus} source={imageSource} onSource={setImageSource} onYearChange={selectPilotYear} onInfo={() => setPanel(imageSource === 'archive' ? 'image' : 'pilot')} onRetry={() => { if(annualFallback||hasPcAnnualBackdrop(backgroundYear))setFallbackAttempt(n=>n+1);else if (imageSource === 'archive') setArchiveAttempt(n => n + 1); else if (imageSource === 'detail') setHistoricalSatellite((item) => item ? { ...item } : null); else { setSentinelError(false); setSentinelAttempt((attempt) => attempt + 1); } }} />}
      {pilotMode && pilotStatus === 'loading' && <output className="littoral-loading">Cargando mediciones…</output>}
      {!ready && !error && (
        <output className="minimal-loading">Cargando mapa…</output>
      )}
      {error && (
        <div className="minimal-loading" role="alert">
          {error}
          <Button
            onClick={() => {
              setError('');
              setReady(false);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      <footer className="map-footer">
        {displayedAnnual?.provider==='eox' && <><a href="https://cloudless.eox.at" target="_blank" rel="noreferrer">EOxCloudless</a><a href="https://eox.at" target="_blank" rel="noreferrer">EOX IT Services GmbH</a></>}
        <button onClick={() => openPanel('sources')}>
          {coastalChapter==='historical'?'Archivo histórico · fuentes indicadas en cada pieza / Meyer-Arendt · tasas históricas':visibleBackgroundAttribution}{' '}
          · INEGI · CONABIO · ©Global Mangrove Watch
        </button>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          {' '}
          · © OpenStreetMap contributors
        </a>
      </footer>
      {panel && (
        <FloatingPanel
          title={
            panel === 'image' ? (imageInfo?.title ?? 'Imagen') : titles[panel]
          }
          onClose={closePanel}
        >
          <Suspense fallback={<output>Cargando…</output>}>
            {panel === 'pilot' && (evolutionMode ? evolutionIndex && pilotBar ? <><p className="littoral-pilot-name">Barra · {pilotBar.properties.idPol_Tran}</p><CoastalEvolutionDetails index={evolutionIndex} year={backgroundYear} id={pilotBar.properties.idPol_Tran} published={researchBars?.byId.get(pilotBar.properties.idPol_Tran)} cutId={pilotCutId} /><label className="littoral-control">Barra<select aria-label="Barra del piloto" value={pilotBar.properties.idPol_Tran} onChange={(event) => setPilotSelectedId(event.target.value)}>{pilotBars?.features.map((entry) => <option key={entry.properties.idPol_Tran} value={entry.properties.idPol_Tran}>{entry.properties.idPol_Tran}</option>)}</select></label><details className="compact-details"><summary>Mediciones originales y periodos de Alec</summary><LittoralPilotPanel series={pilotSeries} cut={pilotCut} barIndex={pilotBars} selectedId={pilotBar.properties.idPol_Tran} onSelect={setPilotSelectedId} onCut={selectPilotCut} status={pilotStatus} onRetry={() => setPilotAttempt((attempt) => attempt + 1)} /></details></> : <p>{evolutionStatus === 'error' ? 'No se pudieron cargar los datos.' : 'Cargando posiciones…'}</p> : <LittoralPilotPanel series={pilotSeries} cut={pilotCut} barIndex={pilotBars} selectedId={pilotBar?.properties.idPol_Tran ?? null} onSelect={setPilotSelectedId} onCut={selectPilotCut} status={pilotStatus} onRetry={() => setPilotAttempt((attempt) => attempt + 1)} />)}
            {panel === 'problems' && (
              <ProblemsPanel
                evolution={{ enabled: evolutionMode, index: evolutionIndex, year: backgroundYear, status: evolutionStatus, onEnabled: setEvolutionMode, onRetry: () => setEvolutionAttempt((value) => value + 1) }}
                areaBounds={municipalityScope?.municipality.bounds??(
                  coastalViews.find((place) => place.id === activePlace)
                    ?.bounds ?? CHELEM_PROGRESO_OVERVIEW)
                }
                captureFrame={captureFrame}
                historicalReferences={historicalReferences}
                onHistoricalReferences={setHistoricalReferences}
                studyMatched={researchMatches}
                mangrove={{
                  comparison: mangroveComparison,
                  status: mangroveStatus,
                  captureYear,
                  bounds:
                    municipalityScope?.municipality.bounds??mangroveManifest?.query_bounds_wgs84 ??
                    CHELEM_PROGRESO_OVERVIEW,
                  reference2020: mangrove2020Visible,
                  onReference2020: setMangrove2020Visible,
                }}
                evidence={evidence}
                evidenceStatus={{
                  ...evidenceStatus,
                  vegetation: mangroveStatus,
                }}
                evidenceSelected={evidenceSelected}
                onEvidenceRetry={() => {
                  setEvidenceStatus({
                    barriers: 'loading',
                    geotubes: 'loading',
                    vegetation: 'loading',
                  });
                  setEvidenceAttempt((n) => n + 1);
                  setMangroveStatus('loading');
                }}
                referencesVisible={referencesVisible}
                onReferencesVisible={setReferencesVisible}
                structures={{
                  expanded: structureExpanded,
                  onExpandedChange: setStructureExpanded,
                  data: structureData,
                  filtered: filteredStructures,
                  status: structureStatus,
                  filter: structureFilter,
                  selected: structureSelected,
                  onFilter: (f) => {
                    setStructureFilter(f);
                    setStructureSelected(null);
                  },
                  onLocate: (f) => {
                    setHistoricalReferences(true);
                    selectStructure(f);
                    setReferencesVisible(true);
                    setIssueVisibility((v) => ({ ...v, barriers: true }));
                    map.current?.coverage(structureView(f));
                  },
                  onCoverage: (b) => {
                    setIssueVisibility((v) => ({ ...v, barriers: true }));
                    map.current?.coverage(b);
                  },
                  onRetry: () => {
                    setStructureStatus('loading');
                    setStructureAttempt((n) => n + 1);
                  },
                }}
                issueVisibility={issueVisibility}
                onIssueVisibility={(id, value) => {
                  setIssueVisibility((v) => ({ ...v, [id]: value }));
                  if (!value && id === 'barriers') setStructureSelected(null);
                  if (!value && evidenceSelected?.kind === id)
                    setEvidenceSelected(null);
                }}
                series={researchSeriesId}
                followsTime={researchFollowsTime}
                onFollowsTime={setResearchFollowsTime}
                onSeries={(id) => {
                  setResearchFollowsTime(false);
                  setManualResearchSeries(id);
                }}
                visible={researchVisible}
                onVisible={(v) => {
                  setResearchVisible(v);
                  if (!v) setResearchSelected(null);
                }}
                status={researchStatus}
                selected={researchSelected}
                footprint={researchFootprint}
                barIndex={researchBars}
                onBarSelect={setResearchSelectedId}
                onRetry={() => {
                  setResearchStatus('loading');
                  setResearchInventory(null);
                  setResearchAttempt((n) => n + 1);
                }}
                onNavigate={(bounds) => {
                  setEvidenceSelected(null);
                  setStructureSelected(null);
                  setResearchSelected(null);
                  map.current?.coverage(bounds);
                }}
              />
            )}
            {panel === 'sources' && (
              <>
                <details className="compact-details">
                  <summary>Área preliminar de estudio</summary>
                  <ExplanationPoints points={[
                    { label: 'Lugares.', text: 'Explorar toda la costa muestra los años verificados por municipio y permite elegir su costa o una localidad. Cambiar de año conserva el lugar. Vista panorámica muestra el corredor de Celestún a El Cuyo.' },
                    { label: 'Área de estudio.', text: 'El encuadre no es un límite científico de una celda litoral.' },
                    { label: 'Predios.', text: 'El mapa todavía no incluye límites de propiedades verificados.' },
                  ]} />
                </details>
                <EvidencePanel
                  sources={sources}
                  focus={null}
                  state={sourceState}
                  onRetry={() => {
                    setSourceState('loading');
                    setAttempt((n) => n + 1);
                  }}
                />
                <a
                  className="compact-link"
                  href="https://doi.org/10.5281/zenodo.21346457"
                  target="_blank"
                  rel="noreferrer"
                >
                  ©Global Mangrove Watch · Bunting y col., 2026 · 4.1.12 · CC BY
                  4.0 <ArrowUpRight />
                </a>
                <button
                  className="compact-link"
                  onClick={() => setPanel('earth')}
                >
                  Google Earth Pro <ArrowUpRight />
                </button>
              </>
            )}
            {panel === 'earth' && <EarthPanel />}
            {panel === 'image' && !imageInfo && <p>{!displayedDatedInView?'El centro está fuera de la cobertura de la imagen recibida. El fondo de referencia no tiene aquí una fecha local confirmada.':'La imagen solicitada todavía no confirma la fecha del fondo visible. La referencia conserva su fecha propia mientras termina la consulta.'}</p>}
            {panel === 'image' && imageInfo && (
              <div className="image-info">
                <ExplanationPoints points={[
                  { label: 'Fecha de la imagen.', text: imageInfo.capture + (imageInfo.edition ? '. La edición ' + imageInfo.edition + ' es la publicación del mosaico, no la toma de la foto.' : '.') },
                  { label: 'Detalle.', text: imageInfo.resolution + '. Acercar más allá del detalle disponible no hace aparecer información nueva.' },
                  { label: 'Cómo leerla.', text: imageInfo.note },
                ]} />
                <Button
                  variant="ghost"
                  disabled={
                    !displayedDatedRaster && displayedRasterKey?.startsWith('esri:') &&
                    resolvedSatelliteDetail.status !== 'ready'
                  }
                  onClick={() =>
                    displayedDatedRaster?.bounds?map.current?.coverage(displayedDatedRaster.bounds):displayedDatedRaster?.nativeZoom!==undefined?map.current?.detail(displayedDatedRaster.nativeZoom):multiArchive?archiveBounds&&map.current?.coverage(archiveBounds):displayedRasterKey?.startsWith('esri:')
                      ? map.current?.detail((resolvedSatelliteDetail.nativeZoom??ESRI_TEMPORAL_MAX_ZOOM)-(satellitePixelRatio()>1?1:0))
                      : sentinelScene&&displayedRasterKey==='sentinel:'+sentinelScene.id&&map.current?.coverage(sentinelScene.bbox)
                  }
                >
                  <ImageIcon />
                  {displayedDatedRaster?.bounds||multiArchive?'Ver cobertura':'Ver detalle nativo'}
                </Button>
                {displayedAnnual && <a className="compact-link" href={displayedAnnual.licenseUrl} target="_blank" rel="noreferrer">Licencia del fondo alternativo</a>}
                {imageInfo.url && (
                  <a
                    className="compact-link"
                    href={imageInfo.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Metadatos <ArrowUpRight />
                  </a>
                )}
              </div>
            )}
          </Suspense>
        </FloatingPanel>
      )}
    </main>
  );
}
