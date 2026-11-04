'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type * as Leaflet from 'leaflet';
import { themes, type TerritoryFeature } from '@/lib/territory';
import { geometryBounds, type Bounds } from '@/lib/view';
import { coastalPopup, SHORELINE_COLORS, type CoastalAnalysisData } from '@/lib/coastal-analysis';
import {coastalDirectionUnresolved} from '@/lib/coastal-direction';
import {coastalSpacingLinks} from '@/lib/coastal-spacing';
import {esriPhotoMetadataZoom} from '@/lib/esri-photo-options';
import {cachedEsriNativeZoom,cachedRenderedEsriMetadata} from '@/lib/esri-catalogue';
import { imageryService } from '@/lib/imagery';
import type { MapHandle, TerritoryMapProps } from './territory-map';
import { erosionColor, type ErosionFeature } from '@/lib/problems';
import { barMapLabels, type BarMapLabel } from '@/lib/littoral-series';
import { unavailableLabelPositions, UNAVAILABLE_TEXT } from '@/lib/coastal-evolution';
import { createBarLabelElement, createBarExplanationElement } from '@/lib/bar-labels';
import { createRoadKilometreButton, createRoadKilometreExplanation, visibleRoadKilometres } from '@/lib/road-kilometres';
import { isMangroveChange, mangroveChangeColor } from '@/lib/mangrove-history';
import { coastalCases } from '@/lib/coastal-issues';
import { satellitePixelRatio } from '@/lib/satellite-detail';
import type { StructureFeature } from '@/lib/coastal-structures';
import {
  batchOutlines,
  batchTransects,
  boundsIntersect,
  nearestTransect,
} from '@/lib/map-display';
import { RasterFrameCache, type RasterFrame } from '@/lib/raster-frame-cache';
import { resilientTileLayer } from '@/lib/resilient-tile-layer';
import { onMapSettled } from '@/lib/map-settled';
import {keepMapPopupsVisible} from '@/lib/popup-viewport';
import {
  evidenceColors,
  evidenceViews,
  type EvidenceData,
  type EvidenceKind,
  type EvidenceFeature,
} from '@/lib/map-evidence';

const failedHistoryLayers=new WeakSet<Leaflet.TileLayer>();
const latLngBounds = ([w, s, e, n]: Bounds): Leaflet.LatLngBoundsLiteral => [
  [s, w],
  [n, e],
];

function useEvidencePaths(
  kind: EvidenceKind,
  data: EvidenceData | null,
  visible: boolean,
  loaded: number,
  refs: {
    map: RefObject<Leaflet.Map | null>;
    api: RefObject<typeof Leaflet | null>;
    latest: RefObject<TerritoryMapProps>;
    selection: RefObject<Leaflet.GeoJSON | null>;
  },
) {
  const { map, api, latest, selection } = refs;
  useEffect(() => {
    const m = map.current,
      L = api.current;
    if (!loaded || !m || !L || !visible || !data) return;
    const pane = kind === 'geotubes' ? 'coastal-geotubes' : 'coastal-evidence';
    const halo = L.geoJSON(undefined, {
      pane,
      interactive: false,
      style: {
        color: '#142b30',
        weight: kind === 'geotubes' ? 9 : 5.5,
        opacity: 0.85,
        fill: false,
      },
    });
    const layer = L.geoJSON(undefined, {
      pane,
      style: (feature) => {
        const color =
          feature && isMangroveChange(feature as EvidenceFeature)
            ? mangroveChangeColor(feature as EvidenceFeature)
            : evidenceColors[kind];
        return {
          color,
          fillColor: color,
          weight: kind === 'geotubes' ? 5 : 2.5,
          opacity: 1,
          dashArray:
            feature?.properties.temporal_state === 'deflated' ||
            (kind === 'geotubes' &&
              feature?.properties.temporal_state === 'reference')
              ? kind === 'geotubes'
                ? '6 10'
                : '5 5'
              : undefined,
          fillOpacity: kind === 'vegetation' ? 0.3 : 0.08,
          bubblingMouseEvents: false,
        };
      },
      onEachFeature: (feature, shape) => {
        shape.on('click', () =>
          latest.current.onEvidenceSelect({
            kind,
            feature: feature as EvidenceFeature,
          }),
        );
        shape.on('add', () => {
          const element = (shape as Leaflet.Path).getElement?.();
          element?.setAttribute('data-evidence-id', String(feature.id ?? ''));
          element?.setAttribute('data-evidence-kind', kind);
        });
      },
    });
    halo.addTo(m);
    layer.addTo(m);
    const indexed = data.features.map((feature) => ({
      feature,
      bounds: geometryBounds(feature.geometry),
    }));
    let signature = '';
    const draw = () => {
      const view = m.getBounds().pad(0.15);
      const window: Bounds = [
        view.getWest(),
        view.getSouth(),
        view.getEast(),
        view.getNorth(),
      ];
      const features = indexed
        .filter(
          (entry) => entry.bounds && boundsIntersect(entry.bounds, window),
        )
        .map((entry) => entry.feature);
      const next = features.map((feature) => feature.id).join('|');
      if (next === signature) return;
      signature = next;
      halo.clearLayers().addData(batchOutlines(features));
      const collection: EvidenceData = { type: 'FeatureCollection', features };
      layer.clearLayers().addData(collection);
      selection.current?.bringToFront();
    };
    m.on('moveend', draw);
    draw();
    return () => {
      m.off('moveend', draw);
      halo.remove();
      layer.remove();
    };
  }, [kind, data, visible, loaded, map, api, latest, selection]);
}

function mountCoastalLayer(m:Leaflet.Map,L:typeof Leaflet,data:CoastalAnalysisData,color:string,bars:boolean){
  const pane=m.getPane('coastal-observed')??m.createPane('coastal-observed');pane.style.zIndex='645';
  const linesPane=m.getPane('coastal-observed-lines')??m.createPane('coastal-observed-lines');linesPane.style.zIndex='644';
  const locator=(feature:GeoJSON.Feature):GeoJSON.Position|null=>feature.geometry.type==='Point'?feature.geometry.coordinates:feature.geometry.type==='LineString'?feature.geometry.coordinates.at(-1)??null:null;

        const indexed=data.features.map((feature,index)=>({feature,index,bounds:geometryBounds(feature.geometry)}));
        const live=new Map<number,{shape:Leaflet.Layer;kind:string}>();
        let addingIndex=-1;
        const overview=L.layerGroup().addTo(m);
        const referencePane=m.getPane('coastal-fixed-reference')??m.createPane('coastal-fixed-reference');referencePane.style.zIndex='647';referencePane.style.pointerEvents='none';
        const referenceMarks=L.layerGroup().addTo(m);
        const spacingLinks=bars?coastalSpacingLinks(data.features.flatMap(feature=>{
          if((feature.properties?.scenario_unvalidated!==true&&feature.properties?.photo_interpretation!==true)||feature.properties.spacing_eligible===false)return [];
          const p=feature.geometry.type==='LineString'?feature.geometry.coordinates[0]:locator(feature);if(!p)return [];
          return [{id:String(feature.properties.profile_id),coordinate:[p[0],p[1]] as [number,number]}];
        }),150):[];
        const spacing=spacingLinks.length?document.createElement('canvas'):null;
        if(spacing){
          const pane=m.getPane('coastal-spacing')??m.createPane('coastal-spacing');pane.style.zIndex='646';pane.style.pointerEvents='none';
          spacing.className='coastal-spacing-canvas leaflet-zoom-hide';spacing.setAttribute('role','img');
          spacing.setAttribute('aria-label','Píldoras de 100 metros: intervalo nominal del muestreo, no distancia exacta entre resultados ni metros de erosión.');
          spacing.dataset.pointCount=String(new Set(spacingLinks.flatMap(link=>[link.from.id,link.to.id])).size);
          spacing.dataset.linkCount=String(spacingLinks.length);pane.appendChild(spacing);
        }
        let overviewPopup:Leaflet.Popup|null=null;
        let signature='';
        const drawSpacing=()=>{
          if(!spacing)return;
          const size=m.getSize(),ratio=Math.min(2,window.devicePixelRatio||1);
          spacing.width=Math.round(size.x*ratio);spacing.height=Math.round(size.y*ratio);
          spacing.style.width=size.x+'px';spacing.style.height=size.y+'px';
          L.DomUtil.setPosition(spacing,m.containerPointToLayerPoint([0,0]));
          const context=spacing.getContext('2d');if(!context)return;
          context.scale(ratio,ratio);let pills=0,labels=0;
          for(const link of spacingLinks){
            const a=m.latLngToContainerPoint([link.from.coordinate[1],link.from.coordinate[0]]),b=m.latLngToContainerPoint([link.to.coordinate[1],link.to.coordinate[0]]);
            if(Math.max(a.x,b.x)<-20||Math.min(a.x,b.x)>size.x+20||Math.max(a.y,b.y)<-20||Math.min(a.y,b.y)>size.y+20)continue;
            const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.1)continue;
            let nx=dy/length,ny=-dx/length;if(ny>0){nx=-nx;ny=-ny;}
            const width=Math.max(1,length-14),height=Math.min(16,Math.max(2,width*.35));
            const x=(a.x+b.x)/2+nx*13,y=(a.y+b.y)/2+ny*13;
            let angle=Math.atan2(dy,dx);if(angle>Math.PI/2)angle-=Math.PI;if(angle<-Math.PI/2)angle+=Math.PI;
            context.save();context.translate(x,y);context.rotate(angle);
            context.beginPath();context.roundRect(-width/2,-height/2,width,height,height/2);
            context.fillStyle='rgba(255,255,255,0.035)';context.fill();
            context.strokeStyle='rgba(255,255,255,0.10)';context.lineWidth=.6;context.stroke();pills++;
            // At overview scale there is physically no room for type. Keep
            // every pill; show its nominal label as soon as the gap can fit it.
            if(width>=30){context.fillStyle='rgba(255,255,255,0.36)';context.font='500 '+Math.min(10,width/3.4)+'px system-ui, sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText('100 m',0,.5);labels++;}
            context.restore();
          }
          spacing.dataset.pillCount=String(pills);spacing.dataset.labelCount=String(labels);
        };
        const paint = (feature: GeoJSON.Feature | undefined) => {
          const p=feature?.properties, delta=p?.delta_m ?? p?.apparent_change_toward_water_m;
          if(bars&&p?.context_review===true)return '#becdd4';
          if(bars&&p?.scenario_unvalidated===true)return typeof delta==='number'?(delta<0?'#ff695b':delta>0?'#67d793':'#c8cbc0'):'#c8cbc0';
          return bars && p?.context_review===true ? '#f2bd53' : bars && coastalDirectionUnresolved(p??{}) ? '#becdd4' : bars ? typeof delta === 'number' ? delta < 0 ? '#ff695b' : delta > 0 ? '#67d793' : '#c8cbc0' : '#c8cbc0' : color;
        };
        const layer = L.geoJSON(undefined, {
          pane: bars?'coastal-observed':'coastal-observed-lines',
          style: feature => {
            const estimated = feature?.properties?.estimated === true || feature?.properties?.spatial_estimate === true || feature?.properties?.quality === 'spatial_estimate';
            const review = feature?.properties?.context_review === true;
            return { color:paint(feature), weight: bars ? 4 : 2.5, opacity: .96, dashArray: estimated || review ? '4 4' : undefined, bubblingMouseEvents:false };
          },
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, { pane:bars?'coastal-observed':'coastal-observed-lines', radius:2.5, color:bars ? paint(feature) : '#193d40', weight:1.25, fillColor:paint(feature), fillOpacity:feature.properties?.spatial_estimate ? .25 : .9, bubblingMouseEvents:false }),
          onEachFeature: (feature, shape) => {
            live.set(addingIndex,{shape,kind:feature.geometry.type});
            shape.bindPopup(() => coastalPopup(feature), { minWidth:280, maxWidth:320, maxHeight:340, autoPan:false });
            shape.on('add', () => {
              const path = (shape as Leaflet.Path).getElement?.();
              if (!path) return;
              path.setAttribute('role','button'); path.setAttribute('tabindex','0');
              path.setAttribute('aria-label', bars ? 'Ver cálculo y fuentes de la barra ' + String(feature.properties?.profile_id ?? '') : 'Ver fecha y fuente del borde del agua ' + String(feature.properties?.date ?? feature.properties?.year ?? ''));
              path.addEventListener('keydown', event => { if (['Enter',' '].includes((event as KeyboardEvent).key)) { event.preventDefault(); event.stopPropagation(); shape.openPopup(); } });
            });
          },
        }).addTo(m);
        const draw = () => {
          const bounds=m.getBounds().pad(.2),window:Bounds=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
          const entries=indexed.filter(entry=>entry.bounds && boundsIntersect(entry.bounds,window) && (bars || entry.feature.geometry.type!=='Point' || m.getZoom()>=14));
          drawSpacing();
          const overviewMode=bars && m.getZoom()<13;
          const features=entries.map(({feature}) => {
            if(overviewMode)return feature;
            if (!bars || feature.geometry.type !== 'LineString' || feature.geometry.coordinates.length !== 2) return feature;
            const [a,b]=feature.geometry.coordinates;
            const pa=m.latLngToLayerPoint([a[1],a[0]]),pb=m.latLngToLayerPoint([b[1],b[0]]);
            // A locator keeps a sub-pixel/zero-length measurement clickable.
            // It never stretches the distance or changes the source geometry.
            return pa.distanceTo(pb)>=.75 ? feature : {...feature,properties:{...feature.properties,display_symbol:'profile_locator'},geometry:{type:'Point' as const,coordinates:a}};
          });
          const next=(overviewMode?'overview:':'detail:')+entries.map((entry,index)=>entry.index+':'+features[index].geometry.type).join('|');
          if(next===signature)return;
          signature=next;
          overview.clearLayers();
          referenceMarks.clearLayers();
          const references=entries.flatMap(({feature})=>feature.geometry.type==='LineString'&&feature.properties?.baseline_fixed===true?[feature.geometry.coordinates[0]]:[]);
          if(references.length){
            const markers=L.polyline(references.map(p=>[[p[1],p[0]],[p[1],p[0]]] as Leaflet.LatLngTuple[]),{pane:'coastal-fixed-reference',color:'#f1f7f5',weight:6,lineCap:'round',opacity:.85,interactive:false,className:'coastal-fixed-reference-marks'}).addTo(referenceMarks);
            markers.getElement()?.setAttribute('data-reference-count',String(references.length));
          }
          if(overviewMode){
            for(const [index,item] of live)if(!item.shape.isPopupOpen()){layer.removeLayer(item.shape);live.delete(index);}
            const groups=new Map<string,typeof entries>();
            for(const entry of entries){const key=paint(entry.feature)+(entry.feature.properties?.estimated||entry.feature.properties?.spatial_estimate?':estimate':'');const group=groups.get(key)??[];group.push(entry);groups.set(key,group);}
            for(const group of groups.values()){
              const pairs=group.flatMap(({feature})=>feature.geometry.type==='LineString'?[feature.geometry.coordinates.map(p=>[p[1],p[0]] as Leaflet.LatLngTuple)]:feature.geometry.type==='Point'?[[[feature.geometry.coordinates[1],feature.geometry.coordinates[0]],[feature.geometry.coordinates[1],feature.geometry.coordinates[0]]] as Leaflet.LatLngTuple[]]:[]);
              // Keep the actual reference/end geometry even at overview scale.
              // Batching changes node count, never the distance or anchor.
              const batch=L.polyline(pairs,{pane:'coastal-observed',color:paint(group[0].feature),weight:5,lineCap:'round',dashArray:group[0].feature.properties?.estimated===true?'4 4':undefined,opacity:group[0].feature.properties?.spatial_estimate===true ? .65 : .95,bubblingMouseEvents:false}).addTo(overview);
              const nearest=(point:Leaflet.Point,candidates=group)=>{
                let chosen:typeof group[number]|null=null,best=Infinity;
                for(const entry of candidates){const p=locator(entry.feature);if(!p)continue;const distance=m.latLngToLayerPoint([p[1],p[0]]).distanceTo(point);if(distance<best){chosen=entry;best=distance;}}
                return {chosen,distance:best};
              };
              batch.on('click',event=>{
                const {chosen,distance}=nearest(event.layerPoint,entries);if(!chosen || distance>10)return;
                const p=locator(chosen.feature);if(!p)return;
                overviewPopup=L.popup({maxWidth:320,maxHeight:340,autoPan:false}).setLatLng([p[1],p[0]]).setContent(coastalPopup({...chosen.feature,properties:{...chosen.feature.properties,display_symbol:'profile_locator'}})).openOn(m);
              });
              const path=batch.getElement();
              if(path){path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label','Acercar para consultar '+group.length+' resultados costeros');path.addEventListener('keydown',event=>{if(!['Enter',' '].includes((event as KeyboardEvent).key))return;event.preventDefault();const {chosen}=nearest(m.latLngToLayerPoint(m.getCenter()));const p=chosen&&locator(chosen.feature);if(p)m.setView([p[1],p[0]],14,{animate:false});});}
            }
            return;
          }
          const requested=new Map(entries.map((entry,index)=>[entry.index,features[index]]));
          // Retain common SVG paths and their open popup while panning.
          // Rebuilding a whole layer closed a popup when its auto-pan ended.
          for(const [index,item] of live) if(!item.shape.isPopupOpen()&&(!requested.has(index) || requested.get(index)!.geometry.type!==item.kind)){layer.removeLayer(item.shape);live.delete(index);}
          for(const [index,feature] of requested) if(!live.has(index)){addingIndex=index;layer.addData(feature);addingIndex=-1;}
        };
        draw(); const disposeMovement=onMapSettled(m,draw);m.on('resize',draw);
        return () => {disposeMovement();m.off('resize',draw);referenceMarks.remove();overview.remove();overviewPopup?.remove();spacing?.remove();layer.remove();};
      
}

// Same received coordinates and images, with a DOM/SVG renderer for devices
// without WebGL. It does not create new datasets or alter scientific geometry.
export const RasterTerritoryMap = forwardRef<MapHandle, TerritoryMapProps>(
  function RasterTerritoryMap(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const map = useRef<Leaflet.Map | null>(null);
    const api = useRef<typeof Leaflet | null>(null);
    const latest = useRef(props);
    const vectors = useRef<Record<string, Leaflet.GeoJSON>>({});
    const vectorContents=useRef<Record<string,unknown>>({});
    const rasters = useRef<Record<string, Leaflet.TileLayer>>({});
    const frameCache = useRef<RasterFrameCache | null>(null);
    const caseMarkers = useRef<Leaflet.LayerGroup | null>(null);
    const labels = useRef<Leaflet.LayerGroup | null>(null);
    const selection = useRef<Leaflet.GeoJSON | null>(null);
    const coverage = useRef<Leaflet.GeoJSON | null>(null);
    const researchLayer = useRef<Leaflet.GeoJSON | null>(null);
    const researchHalo = useRef<Leaflet.GeoJSON | null>(null);
    const researchHit = useRef<Leaflet.GeoJSON | null>(null);
    const structuresLayer = useRef<Leaflet.GeoJSON | null>(null);
    const barPopup = useRef<Leaflet.Popup | null>(null);
    const barHelp = useRef<{ id: string; kind: BarMapLabel['kind'] } | null>(null);
    const barButtons = useRef<HTMLButtonElement[]>([]);
    // A generation, rather than a boolean: a remounted map needs all layers
    // rebound even when React retains component state during a live update.
    const [loaded, setLoaded] = useState(0);
    const hasSatellite = !!props.satellite;
    const hasFlight = !!props.studyFlight;
    const rasterFrames = useMemo(() => {
      if(props.fallbackFrame)return {selected:props.fallbackFrame,nearby:[]};
      const archive = props.history?.frames.filter(frame => frame.epoch === props.epoch) ?? [];
      if (props.epoch) {
        // Annual mosaics use the same bounded, release-only transition as Esri.
        // Multi-sheet historical flights retain their footprint-aware renderer.
        if (archive.length !== 1) return { selected: null, nearby: [] };
        const frame = archive[0];
        return {
          selected: {
            key: 'archive:' + frame.id,
            url: frame.wms?.url ?? frame.tiles,
            wms: frame.tile_protocol === 'wms' ? frame.wms : undefined,
            options: {
              tileSize: frame.tile_size,
              zoomOffset: frame.tile_size === 512 ? -1 : 0,
              minNativeZoom: frame.minzoom + (frame.tile_size === 512 ? 1 : 0),
              maxNativeZoom: frame.maxzoom + (frame.tile_size === 512 ? 1 : 0),
              minZoom: 7,
              maxZoom: 20,
              noWrap: true,
              bounds: latLngBounds(frame.bounds),
              updateWhenIdle: true,
              updateWhenZooming: false,
              keepBuffer: 1,
              className: 'temporal-raster-frame',
            },
          } satisfies RasterFrame,
          nearby: [],
        };
      }
      const ratio = satellitePixelRatio(),
        offset = ratio === 2 ? 1 : 0;
      const camera=map.current;
      const center=camera?.getCenter();
      const editionNativeZoom=(item:NonNullable<TerritoryMapProps['satellite']>)=>center&&camera
        ? cachedRenderedEsriMetadata(item,center.lng,center.lat,esriPhotoMetadataZoom(camera.getZoom(),ratio))?.nativeZoom??cachedEsriNativeZoom(item,center.lng,center.lat)??(item.releaseNum===props.satellite?.releaseNum?props.satelliteDetail.nativeZoom:18)??18
        :props.satelliteDetail.nativeZoom??18;
      const esri = (
        item: NonNullable<TerritoryMapProps['satellite']>,
      ): RasterFrame => ({
        key: 'esri:' + item.releaseNum,
        url: item.itemURL
          .replace('{level}', '{z}')
          .replace('{row}', '{y}')
          .replace('{col}', '{x}'),
        options: {
          tileSize: 256 / ratio,
          zoomOffset: offset,
          // Every edition uses its own available tile level. The independent
          // date inventory resolves that same level before accepting a date.
          maxNativeZoom: editionNativeZoom(item) - offset,
          maxZoom: 20,
          noWrap: true,
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 1,
          className: 'temporal-raster-frame',
        },
      });
      const sentinel = (
        scene: NonNullable<TerritoryMapProps['sentinel']>,
      ): RasterFrame => ({
        key: 'sentinel:' + scene.id,
        url: scene.tiles,
        options: {
          tileSize: 256,
          maxNativeZoom: scene.native_zoom,
          maxZoom: 20,
          bounds: latLngBounds(scene.bbox),
          noWrap: true,
          updateWhenIdle: true,
          updateWhenZooming: false,
          keepBuffer: 1,
          className: 'sentinel-tiles temporal-raster-frame',
        },
      });
      return props.studyFlight
        ? { selected: null, nearby: [] }
        : props.sentinelMode
          ? {
              selected: props.sentinel ? sentinel(props.sentinel) : null,
              nearby: props.sentinelWarm.map(sentinel),
            }
          : {
              selected: props.satellite ? esri(props.satellite) : null,
              nearby: props.satelliteWarm.map(esri),
            };
    }, [
      props.fallbackFrame,
      props.satellite,
      props.sentinel,
      props.sentinelMode,
      props.satelliteWarm,
      props.sentinelWarm,
      props.satelliteDetail.nativeZoom,
      props.studyFlight,
      props.history,
      props.epoch,
    ]);
    const cachedHistoryId = rasterFrames.selected?.key.startsWith('archive:')
      ? rasterFrames.selected.key.slice('archive:'.length) : null;
    useEvidencePaths(
      'barriers',
      props.evidence.barriers,
      props.issueVisibility.barriers,
      loaded,
      { map, api, latest, selection },
    );
    useEvidencePaths(
      'geotubes',
      props.evidence.geotubes,
      props.issueVisibility.geotubes,
      loaded,
      { map, api, latest, selection },
    );
    useEvidencePaths(
      'vegetation',
      props.evidence.vegetation,
      props.issueVisibility.vegetation,
      loaded,
      { map, api, latest, selection },
    );
    useEffect(() => {
      latest.current = props;
    }, [props]);

    useEffect(()=>{
      const m=map.current,L=api.current,record=props.roadSearchSelection;
      if(!m||!L||!record)return;
      const dot=L.circleMarker([record.coordinate[1],record.coordinate[0]],{radius:8,color:'#fff',weight:3,fillColor:'#48bfb1',fillOpacity:1}).addTo(m);
      const article=document.createElement('article'),title=document.createElement('strong'),note=document.createElement('p'),source=document.createElement('a');
      article.className='coastal-analysis-popup';title.textContent='km '+record.km+' · '+record.road;
      note.textContent=record.kind==='official'?'Poste de referencia · RNC 2025.':'Ubicación aproximada entre los postes '+(record.km-.5)+' y '+(record.km+.5)+', siguiendo la red vial recibida.';
      source.href='https://rnc.imt.mx/';source.target='_blank';source.rel='noreferrer';source.textContent='Fuente: SICT-IMT / INEGI';article.appendChild(title);article.appendChild(note);article.appendChild(source);
      dot.bindPopup(article,{autoPan:false,maxWidth:290}).openPopup();return()=>{dot.closePopup();dot.remove();};
    },[props.roadSearchSelection,loaded]);

    function fit(bounds: Bounds) {
      if(latest.current.config.municipality_scope){const n=latest.current.config.navigation_bounds;const clipped:Bounds=[Math.max(bounds[0],n[0]),Math.max(bounds[1],n[1]),Math.min(bounds[2],n[2]),Math.min(bounds[3],n[3])];bounds=clipped[0]<clipped[2]&&clipped[1]<clipped[3]?clipped:latest.current.config.focus_bounds;}
      const m = map.current,
        element = host.current;
      if (!m || !element) return;
      const { width, height } = element.getBoundingClientRect();
      m.fitBounds(latLngBounds(bounds), {
        animate: false,
        maxZoom: 18,
        paddingTopLeft: [width < 768 ? 24 : 64, Math.min(90, height * 0.2)],
        paddingBottomRight: [
          width < 768 ? 24 : 64,
          Math.min(110, height * 0.25),
        ],
      });
    }
    useImperativeHandle(ref, () => ({
      home: () => fit(latest.current.config.focus_bounds),
      coverage: fit,
      place: (id) => {
        const p = latest.current.config.places.find((p) => p.id === id);
        if (p) fit(p.bounds);
      },
      zoom: (delta) => {
        const m = map.current;
        if (m)
          m.setZoom(
            Math.min(
              m.getMaxZoom(),
              Math.max(m.getMinZoom(), m.getZoom() + delta),
            ),
          );
      },
      detail: (nativeZoom) =>
        map.current?.setZoom(nativeZoom, { animate: false }),
      north: () => {}, // This renderer always keeps north up.
      capture: () => {
        const m = map.current;
        return m
          ? {
              center: [m.getCenter().lng, m.getCenter().lat],
              zoom: m.getZoom(),
              bearing: 0,
            }
          : undefined;
      },
      restore: (camera) =>
        map.current?.setView(
          [camera.center[1], camera.center[0]],
          camera.zoom,
          { animate: false },
        ),
    }));
    useEffect(() => {
      let cancelled = false;
      let observer: ResizeObserver | undefined;
      let surface: Element | null=null;
      let disposeMovement:(()=>void)|undefined;
      let disposePopups:(()=>void)|undefined;
      import('leaflet')
        .then((L) => {
          if (cancelled || !host.current) return;
          api.current = L;
          const p = latest.current;
          const [w, s, e, n] = p.config.navigation_bounds;
          const m = L.map(host.current, {
            zoomControl: false,
            attributionControl: false,
            // Separate Canvas panes swallow clicks on the empty area above
            // lower layers. SVG only captures each actual interactive path.
            preferCanvas: false,
            minZoom: 8,
            maxZoom: 20,
            zoomSnap: 1,
            maxBounds: [
              [s, w],
              [n, e],
            ],
            maxBoundsViscosity: 1,
            fadeAnimation: false,
            zoomAnimation: !window.matchMedia(
              '(prefers-reduced-motion: reduce)',
            ).matches,
          });
          map.current = m;
          disposePopups=keepMapPopupsVisible(m);
          surface=host.current.closest('.minimal-explorer');
          m.on('movestart zoomstart',()=>surface?.classList.add('is-map-moving'));
          m.on('moveend zoomend',()=>surface?.classList.remove('is-map-moving'));
          m.createPane('coastal-research').style.zIndex = '640';
          m.createPane('coastal-evidence').style.zIndex = '650';
          m.createPane('coastal-geotubes').style.zIndex = '655';
          m.createPane('coastal-geotube-labels').style.zIndex = '665';
          m.createPane('coastal-towns').style.zIndex = '670';
          m.createPane('coastal-annotations').style.zIndex = '668';
          const selectedPane = m.createPane('coastal-selection');
          selectedPane.style.zIndex = '660';
          selectedPane.style.pointerEvents = 'none';
          L.control
            .scale({ position: 'bottomright', imperial: false, maxWidth: 88 })
            .addTo(m);
          const imagery = resilientTileLayer(L.tileLayer(imageryService + '/tile/{z}/{y}/{x}', {
            zIndex:0,
            maxNativeZoom: 19,
            maxZoom: 20,
            noWrap: true,
          }));
          imagery.on('tileerror', () => latest.current.onImageryError());
          rasters.current.satellite = imagery;
          vectors.current.context = L.geoJSON(undefined, {
            interactive: false,
            style: {
              color: '#a8afa3',
              weight: 0.7,
              fillColor: '#e0dccf',
              fillOpacity: 1,
            },
          });
          for (const theme of [...themes].reverse()) {
            vectors.current[theme.id] = L.geoJSON(undefined, {
              style: {
                color: theme.color,
                weight:
                  theme.id === 'coast'
                    ? 2
                    : theme.id === 'localities'
                      ? 1.25
                      : 0.7,
                fillColor: theme.color,
                fillOpacity: 0.2,
                bubblingMouseEvents: false,
              },
              onEachFeature: (feature, layer) =>
                layer.on('click', () =>
                  latest.current.onSelect(feature as TerritoryFeature),
                ),
            });
          }
          const markers = p.config.places.map((place) => {
            const button = document.createElement('button');
            button.className = 'map-town-label';
            button.textContent = place.name;
            button.setAttribute('aria-label', 'Explorar ' + place.name);
            button.addEventListener('click', (event) => {
              event.stopPropagation();
              latest.current.onPlaceSelect(place.id);
            });
            return L.marker([place.coordinates[1], place.coordinates[0]], {
              pane: 'coastal-towns',
              icon: L.divIcon({
                html: button,
                className: 'raster-place',
                iconSize: [0, 0],
              }),
              keyboard: false,
            });
          });
          labels.current = L.layerGroup(markers);
          caseMarkers.current = L.layerGroup(
            coastalCases.features.map((feature) => {
              const button = document.createElement('button');
              button.className = 'coastal-case-pin';
              button.textContent = feature.properties.label;
              button.title = feature.properties.scope;
              button.setAttribute(
                'aria-label',
                'Geotubos de Punta San Miguel, sector aproximado del caso 2017',
              );
              button.addEventListener('click', (event) => {
                event.stopPropagation();
                latest.current.onCaseSelect();
              });
              return L.marker(
                [
                  feature.geometry.coordinates[1],
                  feature.geometry.coordinates[0],
                ],
                {
                  icon: L.divIcon({
                    html: button,
                    className: 'coastal-case-marker',
                    iconSize: [0, 0],
                  }),
                  keyboard: false,
                },
              );
            }),
          );
          selection.current = L.geoJSON(undefined, {
            pane: 'coastal-selection',
            interactive: false,
            style: { color: '#ffffff', weight: 2, fill: false },
            pointToLayer: (_, latlng) =>
              L.circleMarker(latlng, {
                pane: 'coastal-selection',
                radius: 8,
                color: '#ffffff',
                weight: 2,
                fill: false,
                interactive: false,
              }),
          });
          coverage.current = L.geoJSON(undefined, {
            interactive: false,
            style: {
              color: '#e9dfbc',
              weight: 1,
              opacity: 0.7,
              dashArray: '4 4',
              fill: false,
            },
          });
          const view = () => {
            const b = m.getBounds();
            latest.current.onView(
              [m.getCenter().lng, m.getCenter().lat],
              m.getZoom(),
              [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
            );
            latest.current.onZoom(
              m.getZoom() <= m.getMinZoom() + 0.02,
              m.getZoom() >= m.getMaxZoom() - 0.02,
            );
          };
          disposeMovement=onMapSettled(m,view);
          m.on('click', () => latest.current.onSelect(null));
          if(p.config.municipality_scope)m.setMinZoom(Math.max(8,Math.floor(m.getBoundsZoom(latLngBounds(p.config.navigation_bounds)))));
          fit(p.config.focus_bounds);
          view();
          observer = new ResizeObserver(() => m.invalidateSize({ pan: false }));
          observer.observe(host.current);
          setLoaded(generation=>generation+1);
          latest.current.onReady();
        })
        .catch(() =>
          latest.current.onError(
            'No se pudo iniciar el mapa. Las fuentes siguen disponibles.',
          ),
        );
      return () => {
        cancelled = true;
        observer?.disconnect();
        disposeMovement?.();
        disposePopups?.();
        surface?.classList.remove('is-map-moving');
        frameCache.current?.dispose();
        frameCache.current=null;
        map.current?.remove();
        map.current = null;
        rasters.current = {};
        vectors.current = {};
        vectorContents.current={};
      };
    }, []);
    useEffect(() => {
      const m = map.current,
        L = api.current;
      if (!loaded || !m || !L) return;
      const p = latest.current;
      const show = (
        layer: Leaflet.Layer | null | undefined,
        visible: boolean,
      ) => {
        if (!layer) return;
        if (visible && !m.hasLayer(layer)) m.addLayer(layer);
        else if (!visible && m.hasLayer(layer)) m.removeLayer(layer);
      };
      if (host.current)
        host.current.style.background =
          p.epoch || p.sentinelMode || p.studyFlight ? '#35484a' : '#dbe6e4';
      show(
        rasters.current.satellite,
        p.imageryVisible &&
          !p.studyFlight &&
          !p.epoch &&
          (!p.satellite||!!p.referenceUnderlay) &&
          !p.fallbackFrame &&
          !p.sentinelMode,
      );
      if(!p.imageryVisible && !p.epoch && vectorContents.current.context!==p.data.context){vectors.current.context.clearLayers().addData(p.data.context);vectorContents.current.context=p.data.context;}
      show(vectors.current.context, !p.imageryVisible && !p.epoch);
      if (!cachedHistoryId) latest.current.onHistoryStatus('loading');
      const currentEpoch=p.epoch;
      // Retain just the current and most recently used archive epoch.
      const historyEpochs=[...new Set((p.history?.frames??[]).filter(f=>rasters.current[f.id]).map(f=>f.epoch))];
      const keepEpochs=new Set([currentEpoch,...historyEpochs.filter(e=>e!==currentEpoch).slice(-1)]);
      for(const frame of p.history?.frames??[])if(rasters.current[frame.id] && !keepEpochs.has(frame.epoch)){rasters.current[frame.id].remove();rasters.current[frame.id].off();delete rasters.current[frame.id];}
      for (const frame of p.history?.frames.filter(f=>f.id!==cachedHistoryId && (f.epoch===currentEpoch || !!rasters.current[f.id])) ?? []) {
        if (!rasters.current[frame.id]) {
          const options: Leaflet.TileLayerOptions = {
            tileSize: frame.tile_size,
            zoomOffset: frame.tile_size === 512 ? -1 : 0,
            minNativeZoom: frame.minzoom + (frame.tile_size === 512 ? 1 : 0),
            maxNativeZoom: frame.maxzoom + (frame.tile_size === 512 ? 1 : 0),
            minZoom: 7,
            maxZoom: 20,
            noWrap: true,
            bounds: latLngBounds(frame.bounds),
          };
          const layer = frame.tile_protocol === 'wms' && frame.wms
            ? L.tileLayer.wms(frame.wms.url, { ...options, layers: frame.wms.layers, version: frame.wms.version, format: frame.wms.format, transparent: true, crs: L.CRS.EPSG3857 })
            : L.tileLayer(frame.tiles, options);
          layer.on('loading', () => {
            failedHistoryLayers.delete(layer);
            if (latest.current.epoch === frame.epoch)
              latest.current.onHistoryStatus('loading');
          });
          layer.on('load', () => {
            const active =
              latest.current.history?.frames.filter(
                (f) => f.epoch === latest.current.epoch,
              ) ?? [];
            if (
              latest.current.epoch === frame.epoch &&
              active.every((f) => !rasters.current[f.id]?.isLoading() && !failedHistoryLayers.has(rasters.current[f.id]!))
            )
              latest.current.onHistoryStatus('ready');
          });
          layer.on('tileerror', () => {
            failedHistoryLayers.add(layer);
            if (latest.current.epoch === frame.epoch)
              latest.current.onHistoryStatus('error');
          });
          rasters.current[frame.id] = layer;
        }
        if(p.epoch===frame.epoch && failedHistoryLayers.has(rasters.current[frame.id])){failedHistoryLayers.delete(rasters.current[frame.id]);rasters.current[frame.id].redraw();}
        show(rasters.current[frame.id], p.epoch === frame.epoch);
      }
      if (!cachedHistoryId && (
        !p.epoch ||
        !p.history?.frames
          .filter((f) => f.epoch === p.epoch)
          .some((f) => rasters.current[f.id]?.isLoading())
      ))
        latest.current.onHistoryStatus(p.history?.frames.some(f=>f.epoch===p.epoch && rasters.current[f.id] && failedHistoryLayers.has(rasters.current[f.id]))?'error':'ready');
      for (const theme of themes) {
        const layer = vectors.current[theme.id];
        if(!p.visibility[theme.id]){show(layer,false);continue;}
        if(p.visibility[theme.id] && vectorContents.current[theme.id]!==p.data[theme.id]){layer.clearLayers().addData(p.data[theme.id]);vectorContents.current[theme.id]=p.data[theme.id];}
        const photo = p.imageryVisible || !!p.epoch;
        layer.setStyle({
          fillOpacity: photo
            ? theme.id === 'localities'
              ? 0.045
              : theme.id === 'water'
                ? 0.15
                : 0.3
            : theme.id === 'localities'
              ? 0.12
              : 0.65,
        });
        show(layer, p.visibility[theme.id]);
      }
      // Maintain the same thematic order after switches are changed.
      for (const id of ['water', 'wetlands', 'mangrove', 'localities', 'coast'])
        vectors.current[id].bringToFront();
      show(labels.current, p.entered);
      researchLayer.current?.bringToFront();
      structuresLayer.current?.bringToFront();
      selection.current?.bringToFront();
    }, [
      props.data,
      props.visibility,
      props.imageryVisible,
      props.referenceUnderlay,
      props.history,
      props.epoch,
      hasSatellite,
      props.fallbackFrame,
      props.sentinelMode,
      props.entered,
      hasFlight,
      cachedHistoryId,
      loaded,
    ]);
    useEffect(() => {
      const m = map.current,
        L = api.current,
        flight = props.studyFlight;
      if (!loaded || !m || !L || !flight) return;
      latest.current.onSatelliteStatus('loading');
      const layer = L.imageOverlay(flight.image, latLngBounds(flight.bounds), {
        opacity: 1,
        interactive: false,
        className: flight.id.startsWith('landsat-background-')?'landsat-background-frame':undefined,
      });
      layer.on('load', () => {if(latest.current.studyFlight?.id===flight.id)latest.current.onSatelliteStatus('ready');});
      layer.on('error', () => {if(latest.current.studyFlight?.id===flight.id)latest.current.onSatelliteStatus('error');});
      layer.addTo(m);
      return () => {
        layer.remove();
        layer.off();
      };
    }, [props.studyFlight, loaded]);
    useEffect(() => {
      const m = map.current;
      if (!loaded || !m) return;
      // Preserve the camera when switching providers. Sentinel remains a 10 m
      // image even when overzoomed; its metadata reports that native resolution.
      m.setMaxZoom(20);
      if (m.getZoom() > m.getMaxZoom())
        m.setZoom(m.getMaxZoom(), { animate: false });
      latest.current.onZoom(
        m.getZoom() <= m.getMinZoom(),
        m.getZoom() >= m.getMaxZoom(),
      );
    }, [props.sentinelMode, loaded]);
    useEffect(() => {
      const m = map.current,
        L = api.current,
        data = props.evidence.geotubes;
      if (!loaded || !m || !L || !data || !props.issueVisibility.geotubes)
        return;
      const tags = L.layerGroup();
      const overview = L.layerGroup();
      for (const feature of data.features) {
        if (feature.geometry.type !== 'LineString') continue;
        const coords = feature.geometry.coordinates;
        const a = coords[0],
          b = coords[coords.length - 1];
        const id = String(feature.id).match(/(\d+)$/)?.[1];
        const number = id ? Number(id) : tags.getLayers().length + 1;
        const button = document.createElement('button');
        button.className =
          'geotube-axis-tag' + (number % 2 ? ' is-above' : ' is-below');
        button.textContent = 'G' + number;
        button.setAttribute(
          'aria-label',
          'Geotubo G' +
            number +
            (feature.properties.temporal_state === 'deflated'
              ? ', desinflado'
              : feature.properties.temporal_state === 'reference'
                ? ', disposición documentada de 2017–2018'
                : ', presencia cotejada') +
            '. Ver evidencia',
        );
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          latest.current.onEvidenceSelect({ kind: 'geotubes', feature });
        });
        tags.addLayer(
          L.marker([(a[1] + b[1]) / 2, (a[0] + b[0]) / 2], {
            pane: 'coastal-geotube-labels',
            keyboard: false,
            icon: L.divIcon({
              html: button,
              className: 'geotube-label-marker',
              iconSize: [0, 0],
            }),
          }),
        );
      }
      const button = document.createElement('button');
      button.className = 'geotube-overview-tag';
      button.textContent = 'Ver geotubos';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        fit(evidenceViews.geotubes);
      });
      const first = data.features[0];
      if (first?.geometry.type === 'LineString')
        overview.addLayer(
          L.marker(
            [
              first.geometry.coordinates[0][1],
              first.geometry.coordinates[0][0],
            ],
            {
              pane: 'coastal-geotube-labels',
              keyboard: false,
              icon: L.divIcon({
                html: button,
                className: 'geotube-label-marker',
                iconSize: [0, 0],
              }),
            },
          ),
        );
      const update = () => {
        if (m.getZoom() >= 17) {
          overview.remove();
          tags.addTo(m);
        } else {
          tags.remove();
          overview.addTo(m);
        }
      };
      m.on('zoomend', update);
      update();
      return () => {
        m.off('zoomend', update);
        tags.remove();
        overview.remove();
      };
    }, [props.evidence.geotubes, props.issueVisibility.geotubes, loaded]);
    useEffect(() => {
      const m = map.current,
        L = api.current;
      if (!loaded || !m || !L || !props.structuresVisible || !props.structures) return;
      const radius = () =>
        Math.min(4.5, Math.max(2, 2 + (m.getZoom() - 10) * 0.5));
      const layer = L.geoJSON(props.structures ?? undefined, {
        pointToLayer: (_, latlng) =>
          L.circleMarker(latlng, {
            pane: 'coastal-evidence',
            radius: radius(),
            color: '#30213b',
            weight: 1.1,
            fillColor: '#d3a8e8',
            fillOpacity: 0.95,
            bubblingMouseEvents: false,
          }),
        onEachFeature: (feature, marker) =>
          marker.on('click', () =>
            latest.current.onStructureSelect(feature as StructureFeature),
          ),
      });
      structuresLayer.current = layer;
      const scale = () =>
        layer.eachLayer((marker) => {
          if (marker instanceof L.CircleMarker) marker.setRadius(radius());
        });
      m.on('zoomend', scale);
      if (props.structuresVisible) layer.addTo(m).bringToFront();
      selection.current?.bringToFront();
      return () => {
        m.off('zoomend', scale);
        layer.remove();
        if (structuresLayer.current === layer) structuresLayer.current = null;
      };
    }, [props.structures, props.structuresVisible, loaded]);
    useEffect(() => {
      const m = map.current,
        layer = caseMarkers.current;
      if (!loaded || !m || !layer) return;
      if (props.entered && props.issueVisibility.geotubes) layer.addTo(m);
      else layer.remove();
    }, [props.issueVisibility, props.entered, loaded]);
    useEffect(() => {
      const m = map.current,
        L = api.current;
      if (!loaded || !m || !L) return;
      const cache = new RasterFrameCache(
        m,
        (frame) => resilientTileLayer(frame.wms
          ? L.tileLayer.wms(frame.url, { ...frame.options, ...frame.wms, transparent: true, crs: L.CRS.EPSG3857 })
          : L.tileLayer(frame.url, frame.options)),
        (status) => latest.current.epoch
          ? latest.current.onHistoryStatus(status)
          : latest.current.onSatelliteStatus(status),
        60,600,12000,
        key=>latest.current.onRasterFrameDisplayed?.(key),
        ()=>latest.current.keepRasterReference!==false&&!latest.current.epoch,
      );
      frameCache.current = cache;
      return () => {
        cache.dispose();
        frameCache.current = null;
      };
    }, [loaded]);
    useEffect(() => {
      if (loaded)
        frameCache.current?.select(rasterFrames.selected, rasterFrames.nearby);
    }, [loaded, rasterFrames, props.fallbackRetryToken]);
    useEffect(() => {
      const m = map.current,
        layer = coverage.current;
      if (!loaded || !m || !layer) return;
      layer.clearLayers();
      for (const frame of props.history?.frames.filter(
        (frame) => frame.epoch === props.epoch,
      ) ?? [])
        layer.addData(frame.footprint);
      if (props.sentinel) layer.addData(props.sentinel.geometry);
      if (props.epoch || props.sentinel) layer.addTo(m).bringToFront();
      else layer.remove();
    }, [props.history, props.epoch, props.sentinel, loaded]);
    useEffect(()=>{
      const m=map.current,L=api.current;if(!m||!L||!loaded)return;
      labels.current?.remove();
      const entries=[...props.config.places].sort((a,b)=>Number(['Progreso','Chelem'].includes(b.name))-Number(['Progreso','Chelem'].includes(a.name))).map(place=>{
        const button=document.createElement('button');button.type='button';button.className='map-town-label';button.textContent=place.name;
        if(place.municipality&&place.municipality!==place.name){const subtitle=document.createElement('small');subtitle.textContent='Mun. '+place.municipality;button.appendChild(subtitle);}
        button.title=place.municipality?`Municipio de ${place.municipality} · INEGI · referencia de orientación actual`:place.name;
        button.setAttribute('aria-label','Explorar '+place.name+(place.municipality?' · municipio de '+place.municipality:''));
        button.onclick=event=>{event.stopPropagation();latest.current.onPlaceSelect(place.id);};
        const marker=L.marker([place.coordinates[1],place.coordinates[0]],{pane:'coastal-towns',icon:L.divIcon({html:button,className:'raster-place',iconSize:[0,0]}),keyboard:false});
        return {place,button,marker};
      });
      const group=L.layerGroup(entries.map(x=>x.marker));labels.current=group;if(props.entered)group.addTo(m);
      const update=()=>{const visible:[number,number][]=[];for(const {place,button} of entries){const p=m.latLngToContainerPoint([place.coordinates[1],place.coordinates[0]]);const show=m.getZoom()>=(place.minZoom??8)&&!visible.some(q=>Math.hypot(q[0]-p.x,q[1]-p.y)<105);button.hidden=!show;if(show)visible.push([p.x,p.y]);}};
      m.on('zoomend moveend',update);update();return()=>{m.off('zoomend moveend',update);group.remove();};
    },[props.config.places,props.entered,loaded]);
    useEffect(() => {
      const m = map.current, L = api.current, data = props.roadKilometres;
      if (!m || !L || !loaded || !props.entered || !data) return;
      let popup: Leaflet.Popup | null = null;
      const entries = data.features.map(feature => {
        const button = createRoadKilometreButton(feature, () => {
          popup?.remove();
          popup = L.popup({ className: 'bar-help-popup road-kilometre-popup', autoPan: false, closeButton: false, closeOnClick: true, maxWidth: 290, minWidth: 240, offset: [0, -12] });
          const close = () => { popup?.remove(); button.focus({ preventScroll: true }); };
          const content = createRoadKilometreExplanation(feature, close);
          popup.on('remove', () => button.setAttribute('aria-expanded', 'false'));
          popup.setLatLng([feature.geometry.coordinates[1], feature.geometry.coordinates[0]]).setContent(content).openOn(m);
          button.setAttribute('aria-expanded', 'true'); content.querySelector('button')?.focus({ preventScroll: true });
        });
        button.hidden = true;
        const marker = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
          pane: 'coastal-towns', keyboard: false, bubblingMouseEvents: false,
          icon: L.divIcon({ html: button, className: 'road-kilometre-marker', iconSize: [0, 0] }),
        });
        return { feature, button, marker };
      });
      const group = L.layerGroup(entries.map(entry => entry.marker)).addTo(m);
      const update = () => {
        const size = m.getSize();
        const occupied = latest.current.config.places.filter(place => m.getZoom() >= (place.minZoom ?? 8)).map(place => m.latLngToContainerPoint([place.coordinates[1], place.coordinates[0]]));
        const visible = new Set(visibleRoadKilometres(data, m.getZoom(), size.x, size.y, xy => m.latLngToContainerPoint([xy[1], xy[0]]), occupied).map(feature => feature.id));
        for (const entry of entries) entry.button.hidden = !visible.has(entry.feature.id);
      };
      m.on('zoomend moveend', update); update();
      return () => { m.off('zoomend moveend', update); popup?.remove(); group.remove(); };
    }, [props.roadKilometres, props.entered, loaded]);
    useEffect(()=>{
      const m=map.current,L=api.current,data=props.historicalContext;
      if(!loaded||!m||!L||!data||!props.researchVisible)return;
      const layer=L.geoJSON(undefined,{pane:'coastal-research',interactive:false,
        style:f=>({color:erosionColor(f?.properties.category??''),weight:2.1,opacity:.9,dashArray:'3 4',fill:false})}).addTo(m);
      const indexed=data.features.map(feature=>({feature,bounds:geometryBounds(feature.geometry)}));
      const update=()=>{
        const b=m.getBounds().pad(.15),view:Bounds=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
        layer.clearLayers().addData(batchTransects(indexed.filter(e=>e.bounds&&boundsIntersect(e.bounds,view)).map(e=>e.feature)));
      };
      m.on('moveend',update);update();
      researchLayer.current?.bringToFront();selection.current?.bringToFront();
      return ()=>{m.off('moveend',update);layer.remove();};
    },[props.historicalContext,props.researchVisible,loaded]);
    useEffect(() => {
      const m = map.current,
        L = api.current;
      if (!loaded || !m || !L || !props.researchVisible) return;
      const halo = L.geoJSON(undefined, {
        pane: 'coastal-research',
        interactive: false,
        style: { color: '#142b30', opacity: 0.5, fill: false },
      });
      const lines = L.geoJSON(undefined, {
        pane: 'coastal-research',
        interactive: false,
        style: (feature) => ({
          color: feature?.properties.evolution_color ?? erosionColor(feature?.properties.category ?? ''),
          dashArray: feature?.properties.evolution_status==='estimated'?'7 5':undefined,
          opacity: 0.95,
          fill: false,
        }),
      });
      let rendered: ErosionFeature[] = [];
      let keyboardIndex = -1;
      const hits = L.geoJSON(undefined, {
        pane: 'coastal-research',
        style: {
          color: 'transparent',
          weight: 14,
          opacity: 1,
          fill: false,
          className: 'erosion-hit-target',
          bubblingMouseEvents: false,
        },
        onEachFeature: (_, layer) => {
          layer.on('click', (event: Leaflet.LeafletMouseEvent) => {
            const feature = nearestTransect(
              rendered,
              [event.containerPoint.x, event.containerPoint.y],
              (coordinate) => {
                const point = m.latLngToContainerPoint([
                  coordinate[1],
                  coordinate[0],
                ]);
                return [point.x, point.y];
              },
            );
            if (feature) latest.current.onResearchSelect(feature);
          });
          layer.on('add', () => {
            const path = (layer as Leaflet.Path).getElement();
            if (!path) return;
            path.setAttribute('role', 'button');
            path.setAttribute('tabindex', '0');
            path.setAttribute(
              'aria-label',
              'Elegir barra de medición. Pulsa una línea o usa las flechas izquierda y derecha para recorrer los sitios.',
            );
            path.setAttribute('data-transect-count', String(rendered.length));
            path.addEventListener('keydown', (event) => {
              const key = (event as KeyboardEvent).key;
              if (
                !rendered.length ||
                !['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(key)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              keyboardIndex =
                (keyboardIndex +
                  (key === 'ArrowLeft' ? -1 : 1) +
                  rendered.length) %
                rendered.length;
              latest.current.onResearchSelect(rendered[keyboardIndex]);
            });
          });
        },
      });
      researchHalo.current = halo;
      researchLayer.current = lines;
      researchHit.current = hits;
      const availabilityLabels = L.layerGroup().addTo(m);
      const baselinePoints = L.layerGroup().addTo(m);
      halo.addTo(m);
      lines.addTo(m);
      hits.addTo(m);
      const indexed =
        props.research?.features.map((feature) => ({
          feature,
          bounds: geometryBounds(feature.geometry),
        })) ?? [];
      let signature = '';
      const update = () => {
        const view = m.getBounds().pad(0.15);
        const window: Bounds = [
          view.getWest(),
          view.getSouth(),
          view.getEast(),
          view.getNorth(),
        ];
        const features = indexed
          .filter(
            (entry) => entry.bounds && boundsIntersect(entry.bounds, window),
          )
          .map((entry) => entry.feature);
        const zoom = m.getZoom();
        const next =
          zoom + ':' + features.map((feature) => feature.id).join('|');
        if (next === signature) return;
        signature = next;
        rendered = features;
        keyboardIndex = -1;
        const measured = features.filter((feature) => !['no_reference', 'no_observation'].includes(String(feature.properties.evolution_status)));
        halo.clearLayers().addData(batchOutlines(measured));
        lines.clearLayers().addData(batchTransects(features));
        availabilityLabels.clearLayers();
        baselinePoints.clearLayers();
        for (const feature of features.filter((feature) => ['baseline','no_reference'].includes(String(feature.properties.evolution_status)))) {
          const point = feature.geometry.coordinates[0];
          L.circleMarker([point[1], point[0]], { pane: 'coastal-research', radius: 3, color: '#fff9e8', weight: 1, fillColor: '#8b9690', fillOpacity: 1 }).on('click', () => latest.current.onResearchSelect(feature)).addTo(baselinePoints);
        }
        const unavailable = unavailableLabelPositions(features, (point) => { const screen = m.latLngToContainerPoint([point[1], point[0]]); return [screen.x, screen.y]; });
        for (const label of unavailable) {
          if (props.config.places.some((place) => { const point = m.latLngToContainerPoint([place.coordinates[1], place.coordinates[0]]); return Math.hypot(point.x - label.screen[0], point.y - label.screen[1]) < 100; })) continue;
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'erosion-no-data-label'; button.textContent = latest.current.historicalContext?.features.some(f=>f.properties.idPol_Tran===label.id)?'Sin medición anual':UNAVAILABLE_TEXT;
          button.setAttribute('aria-label', UNAVAILABLE_TEXT + ' para cambio costero en ' + latest.current.researchEvolutionYear + ', barra ' + label.id);
          button.dataset.unavailableBar = label.id;
          L.DomEvent.disableClickPropagation(button);
          button.addEventListener('click', () => { const feature = features.find((entry) => entry.properties.idPol_Tran === label.id); if (feature) latest.current.onResearchSelect(feature); });
          L.marker([label.point[1], label.point[0]], { pane: 'coastal-annotations', keyboard: false, icon: L.divIcon({ className: 'erosion-no-data-marker', html: button, iconSize: [1, 1] }) }).addTo(availabilityLabels);
        }
        const combined = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'MultiLineString' as const,
            coordinates: features.map(
              (feature) => feature.geometry.coordinates,
            ),
          },
        };
        hits.clearLayers();
        if (features.length) hits.addData(combined);
        halo.setStyle({ weight: zoom >= 16 ? 3.8 : zoom >= 14 ? 2.4 : 1.5 });
        lines.setStyle({ weight: zoom >= 16 ? 1.9 : zoom >= 14 ? 1.2 : 0.7 });
      };
      m.on('moveend', update);
      update();
      selection.current?.bringToFront();
      return () => {
        m.off('moveend', update);
        halo.remove();
        lines.remove();
        hits.remove();
        availabilityLabels.remove();
        baselinePoints.remove();
        researchHalo.current = null;
        researchLayer.current = null;
        researchHit.current = null;
      };
    }, [props.research, props.researchVisible, props.config.places, loaded]);
    useEffect(() => {
      // Calendar gaps reuse invisible axes; refresh only the accessible label.
      for (const button of host.current?.querySelectorAll<HTMLButtonElement>('[data-unavailable-bar]') ?? []) {
        button.setAttribute('aria-label', UNAVAILABLE_TEXT + ' para cambio costero en ' + props.researchEvolutionYear + ', barra ' + button.dataset.unavailableBar);
        button.textContent=props.historicalContext?.features.some(f=>f.properties.idPol_Tran===button.dataset.unavailableBar)?'Sin medición anual':UNAVAILABLE_TEXT;
      }
    }, [props.researchEvolutionYear,props.historicalContext]);
    const pilotData=props.pilot?.data,pilotAxes=props.pilot?.axes,pilotPoints=props.pilot?.points;
    useEffect(() => {
      const m = map.current, L = api.current;
      if (!loaded || !m || !L || !pilotData || !pilotAxes || !pilotPoints) return;
      const outlines = L.geoJSON(pilotData, { pane: 'coastal-research', interactive: false, style: { color: '#17333a', weight: 5, opacity: 0.55 } }).addTo(m);
      const bars = L.geoJSON(pilotData, {
        pane: 'coastal-research',
        interactive: false,
        style: (feature) => ({ color: feature?.properties.color ?? '#9ba7a8', weight: 5, opacity: 1, dashArray: feature?.properties.no_data ? '3 5' : undefined }),
      }).addTo(m);
      const hits = L.geoJSON(pilotAxes, {
        pane: 'coastal-research',
        style: { color: 'transparent', weight: 14, opacity: 1, bubblingMouseEvents: false },
        onEachFeature: (feature, layer) => {
          const id = String(feature.properties.transect_id);
          layer.on('click', (event: Leaflet.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            const nearest = nearestTransect(pilotAxes.features, [event.containerPoint.x, event.containerPoint.y], (coordinate) => {
              const point = m.latLngToContainerPoint([coordinate[1], coordinate[0]]);
              return [point.x, point.y];
            });
            latest.current.pilot?.onSelect(nearest?.properties.transect_id ?? id);
          });
          layer.on('add', () => {
            const element = (layer as Leaflet.Path).getElement();
            if (!element) return;
            element.setAttribute('tabindex', '0');
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', 'Barra del piloto ' + id);
            element.setAttribute('data-pilot-transect', id);
            element.addEventListener('keydown', (event) => {
              if (['Enter', ' '].includes((event as KeyboardEvent).key)) { event.preventDefault(); event.stopPropagation(); latest.current.pilot?.onSelect(id); }
            });
          });
        },
      }).addTo(m);
      const points = L.geoJSON(pilotPoints, { pane: 'coastal-research', pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: feature.properties.kind === 'baseline' ? 3.5 : 4, color: '#fff9e8', weight: feature.properties.kind === 'baseline' ? 1.5 : 1, fillColor: feature.properties.color, fillOpacity: feature.properties.kind === 'baseline' ? 0.55 : 1 }), onEachFeature: (feature, layer) => {
        layer.on('click', () => latest.current.pilot?.onSelect(String(feature.properties.transect_id)));
        layer.on('add', () => { const element = (layer as Leaflet.Path).getElement(); element?.setAttribute('data-water-endpoint', feature.properties.kind); element?.setAttribute('data-point-bar', feature.properties.transect_id); });
      } }).addTo(m);
      selection.current?.bringToFront();
      return () => { outlines.remove(); bars.remove(); hits.remove(); points.remove(); };
    }, [pilotData,pilotAxes,pilotPoints,loaded]);
    useEffect(() => {
      const m = map.current, L = api.current, footprint = props.transectFootprint, ruler = props.transectRuler;
      if (!loaded || !m || !L) return;
      if (!footprint) { barPopup.current?.remove(); barHelp.current = null; return; }
      const models = [...(props.transectLabels ?? barMapLabels(footprint, ruler, props.transectCut)), ...(props.pilot?.labels ?? []).filter((label) => label.id !== footprint.id)];
      if (props.researchEvolutionYear != null && barHelp.current?.id === footprint.id && !models.some((label) => label.kind === barHelp.current?.kind) && models.some((label) => label.kind === 'change')) barHelp.current.kind = 'change';
      if (barHelp.current && (barHelp.current.id !== footprint.id || !models.some((label) => label.id === footprint.id && label.kind === barHelp.current?.kind))) { barPopup.current?.remove(); barHelp.current = null; }
      const setExpanded = (kind?: BarMapLabel['kind'], id?: string) => barButtons.current.forEach((button) => button.setAttribute('aria-expanded', String(button.dataset.barAnnotation === kind && button.dataset.annotationBar === id)));
      if (!barPopup.current) {
        barPopup.current = L.popup({ className: 'bar-help-popup', autoPan: false, closeButton: false, closeOnClick: true, maxWidth: 290, minWidth: 240, maxHeight: 320, offset: [0, -14] });
        barPopup.current.on('remove', () => { barHelp.current = null; setExpanded(); });
      }
      const popup = barPopup.current;
      const explain = (label: BarMapLabel, manual = true) => {
        const expanded = popup.getElement()?.querySelector('details')?.open ?? false;
        const hadFocus = popup.getElement()?.contains(document.activeElement) ?? false;
        const content = createBarExplanationElement(label, () => { popup.remove(); (barButtons.current.find((button) => button.dataset.annotationBar === label.id && button.dataset.barAnnotation === label.kind) ?? barButtons.current.find((button) => button.dataset.barAnnotation === 'current'))?.focus({ preventScroll: true }); });
        if (!manual && expanded) content.querySelector('details')!.open = true;
        popup.setLatLng([label.point[1], label.point[0]]).setContent(content);
        if (!m.hasLayer(popup)) popup.openOn(m);
        if (manual || hadFocus) content.querySelector('button')?.focus({ preventScroll: true });
        barHelp.current = { id: label.id, kind: label.kind };
        setExpanded(label.kind, label.id);
        if (manual) {
          latest.current.onBarHelpOpen();
          if (label.id !== footprint.id) latest.current.pilot?.onSelect(label.id);
        }
      };
      const group = L.layerGroup().addTo(m);
      const at = (point: number[]): Leaflet.LatLngTuple => [point[1], point[0]];
      if (ruler) {
        if (ruler.current) {
          if (ruler.baseline && ruler.changeM !== null && (ruler.changeM !== 0 || props.researchEvolutionYear != null)) {
            L.polyline([at(ruler.baseline.point), at(ruler.current.point)], { pane: 'coastal-selection', interactive: false, color: ruler.color, weight: 7, opacity: 0.95 }).addTo(group);
            L.circleMarker(at(ruler.baseline.point), { pane: 'coastal-selection', interactive: false, radius: 5, color: '#fff9e8', weight: 2, fillColor: '#263b38', fillOpacity: 0.8 }).addTo(group);
            const a = m.latLngToContainerPoint(at(ruler.baseline.point)), b = m.latLngToContainerPoint(at(ruler.current.point));
            const arrow = document.createElement('span');
            arrow.className = 'bar-direction-arrow'; arrow.style.borderLeftColor = ruler.color; arrow.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI}deg)`;
            const point = ruler.current.point.map((value, i) => value * 0.65 + ruler.baseline!.point[i] * 0.35);
            L.marker(at(point), { pane: 'coastal-selection', interactive: false, keyboard: false, icon: L.divIcon({ className: 'bar-direction-marker', html: arrow, iconSize: [1, 1] }) }).addTo(group);
          }
          L.circleMarker(at(ruler.current.point), { pane: 'coastal-selection', interactive: false, radius: 7, color: '#fff9e8', weight: 2, fillColor: ruler.color, fillOpacity: 1 }).addTo(group);
        }
      }
      barButtons.current = [];
      const markers = models.filter((label) => label.kind !== 'change' || label.id !== footprint.id || !ruler?.current).map((label) => {
        const button = createBarLabelElement(label, () => explain(label));
        L.DomEvent.disableClickPropagation(button); L.DomEvent.disableScrollPropagation(button);
        barButtons.current.push(button);
        if (label.kind !== 'change') L.circleMarker(at(label.point), { pane: 'coastal-annotations', radius: 16, weight: 0, fillOpacity: 0, bubblingMouseEvents: false }).on('click', () => explain(label)).addTo(group);
        return L.marker(at(label.point), { pane: 'coastal-annotations', interactive: true, keyboard: false, icon: L.divIcon({ className: 'bar-map-label-wrap', html: button, iconSize: [1, 1], iconAnchor: [0, 0] }) }).addTo(group);
      });
      const active = models.find((label) => label.id === barHelp.current?.id && label.kind === barHelp.current?.kind);
      if (active) explain(active, false);
      const overview = () => markers.forEach((marker) => { marker.getElement()?.classList.toggle('is-overview', m.getZoom() < 17); marker.getElement()?.classList.toggle('hide-change-label', m.getZoom() < 18); });
      overview(); m.on('zoomend', overview);
      selection.current?.bringToFront();
      return () => { m.off('zoomend', overview); group.remove(); };
    }, [props.transectFootprint, props.transectRuler, props.transectCut, props.transectLabels, props.researchEvolutionYear, props.pilot?.labels, loaded]);
    useEffect(() => {
      if (!loaded || !map.current || !selection.current) return;
      const feature =
        props.pilot?.data.features.find((feature) => feature.properties.transect_id === props.pilot?.selectedId) ?? props.selected ??
        (props.evidenceSelected &&
        props.issueVisibility[props.evidenceSelected.kind]
          ? props.evidenceSelected.feature
          : null) ??
        (props.structuresVisible ? props.structureSelected : null) ??
        (props.researchVisible ? props.researchSelected : null);
      selection.current.clearLayers();
      if (props.researchEvolutionYear != null) {
        if (props.researchVisible && props.researchSelected && ['available','estimated'].includes(String(props.researchSelected.properties.evolution_status))) {
          selection.current.addData(props.researchSelected).setStyle({ color: props.researchSelected.properties.evolution_color as string ?? '#9ba7a8', weight: 7, opacity: .95,dashArray:props.researchSelected.properties.evolution_status==='estimated'?'7 5':undefined }).addTo(map.current).bringToFront();
        }
        return;
      }
      const recent = props.pilot && props.transectCut?.origin === 'sentinel';
      const selectionStyle = recent ? { color: props.transectRuler?.color ?? '#9ba7a8', weight: 7, opacity: 0.95, dashArray: undefined } : { color: '#ffffff', weight: 2, opacity: 1, dashArray: undefined };
      if (recent) {
        const segment = props.pilot!.data.features.find((entry) => entry.properties.transect_id === props.pilot!.selectedId);
        if (segment) {
          selection.current.addData(segment).setStyle(selectionStyle).addTo(map.current).bringToFront();
          selection.current.eachLayer((layer) => (layer as Leaflet.Path).getElement()?.setAttribute('data-selected-bar', props.pilot!.selectedId!));
        }
        return;
      }
      if (props.transectFootprint) {
        selection.current.addData(props.transectFootprint.feature).setStyle(selectionStyle).addTo(map.current).bringToFront();
        selection.current.eachLayer((layer) => (layer as Leaflet.Path).getElement()?.setAttribute('data-selected-bar', props.transectFootprint!.id));
      } else if (feature) {
        selection.current.addData(feature).setStyle(selectionStyle).addTo(map.current).bringToFront();
        if (props.selected) {
          const bounds = geometryBounds(feature.geometry);
          if (bounds) fit(bounds);
        }
      }
    }, [
      props.selected,
      props.evidenceSelected,
      props.issueVisibility,
      props.researchSelected,
      props.researchVisible,
      props.structureSelected,
      props.structuresVisible,
      props.pilot,
      props.transectFootprint,
      props.transectRuler,
      props.transectCut,
      props.researchEvolutionYear,
      loaded,
    ]);
    useEffect(()=>{
      const m=map.current,L=api.current;
      if(!loaded || !m || !L || !props.shorelinePair)return;
      const before=mountCoastalLayer(m,L,props.shorelinePair.before,SHORELINE_COLORS.before,false);
      const after=mountCoastalLayer(m,L,props.shorelinePair.after,SHORELINE_COLORS.after,false);
      return()=>{before();after();};
    },[props.shorelinePair,loaded]);
    useEffect(()=>{
      const m=map.current,L=api.current;
      if(!loaded || !m || !L || !props.coastalAnalysis)return;
      return mountCoastalLayer(m,L,props.coastalAnalysis,'#f0c975',true);
    },[props.coastalAnalysis,loaded]);
    useEffect(()=>{
      const m=map.current,L=api.current,data=props.coastalCoverage;
      if(!loaded||!m||!L||!data)return;
      const pane=m.getPane('coastal-assessment')??m.createPane('coastal-assessment');pane.style.zIndex='642';
      const renderer=L.canvas({pane:'coastal-assessment',padding:.2});
      const layer=L.geoJSON(undefined,{pane:'coastal-assessment',
        style:feature=>{const p=feature?.properties,code=p?.assessment_status,delta=p?.assessment_delta;return {renderer,color:code===0?'#b9c9ce':p?.direction_unresolved?'#e3bf76':typeof delta==='number'&&delta<0?'#ff695b':'#67d793',weight:p?.assessment_reference_only?2:5,opacity:code===0?.65:.82,dashArray:p?.assessment_reference_only?'3 5':code===2?'5 4':undefined,bubblingMouseEvents:false};},
        onEachFeature:(feature,shape)=>shape.bindPopup(()=>coastalPopup(feature),{maxWidth:320,maxHeight:320,autoPan:false}),
      }).addTo(m);
      const draw=()=>{const bounds=m.getBounds().pad(.15);layer.clearLayers();for(const feature of data.features){const b=geometryBounds(feature.geometry);if(b&&bounds.intersects([[b[1],b[0]],[b[3],b[2]]]))layer.addData(feature);}};
      draw();const dispose=onMapSettled(m,draw);return()=>{dispose();layer.remove();renderer.remove();};
    },[props.coastalCoverage,loaded]);
    return (
      <div
        ref={host}
        className="map-canvas raster-map"
        aria-label="Mapa interactivo de la costa de Yucatán. Arrastra para explorar; usa las flechas para desplazarte y más o menos para ampliar."
        aria-hidden={!props.entered}
      />
    );
  },
);
