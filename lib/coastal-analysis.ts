import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { getJson, fetchJsonAsset, dataAssetBytes } from '@/lib/data-delivery';
import { ResourceCache } from '@/lib/resource-cache';
import {coastalDirectionUnresolved} from './coastal-direction.ts';
import receivedEsriCatalogue from '../public/data/history/esri-local-captures.json';
import {projectCoastLabel,hasProjectCoastLabel} from './project-coast-labels.ts';

export type CoastalAnalysisData = FeatureCollection<Geometry, Record<string, unknown>>;
export type ShorelinePair = { before: CoastalAnalysisData; after: CoastalAnalysisData; beforeYear: number; afterYear: number };
export const SHORELINE_COLORS = { before: '#ffcf59', after: '#53e2ef' };
// The entire 2010 reference series fits in this byte budget. Revisiting a year
// reuses its immutable geometry rather than parsing it on every slider move.
const layerCache=new ResourceCache<CoastalAnalysisData>(32,12*1024*1024);
const detailCache=new Map<string,Record<string,Record<string,unknown>>>();
const detailRequests=new Map<string,Promise<Record<string,Record<string,unknown>>>>();

export const peekCoastalLayer=(path:string)=>layerCache.peek(path);

export async function loadCoastalLayer(path:string,signal:AbortSignal):Promise<CoastalAnalysisData> {
  return layerCache.read(path,signal,async sharedSignal =>
    validateCoastalAnalysis(await getJson<unknown>(path,sharedSignal)),dataAssetBytes(path));
}

function loadDetails(url:string) {
  const cached=detailCache.get(url);
  if(cached){detailCache.delete(url);detailCache.set(url,cached);return Promise.resolve(cached);}
  const pending=detailRequests.get(url);if(pending)return pending;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  const request=fetchJsonAsset<{records:Record<string,Record<string,unknown>>}>(url,controller.signal,url+'.gz').then(data=>{
    if(!data.records || typeof data.records!=='object')throw new Error('Invalid details');
    detailCache.set(url,data.records);if(detailCache.size>6)detailCache.delete(detailCache.keys().next().value!);
    return data.records;
  }).finally(()=>{clearTimeout(timer);detailRequests.delete(url);});
  detailRequests.set(url,request);return request;
}

export function validateCoastalAnalysis(value: unknown): CoastalAnalysisData {
  const data = value as CoastalAnalysisData;
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Datos costeros inválidos');
  for (const feature of data.features) {
    if (feature.type !== 'Feature' || !feature.properties || !['Point', 'LineString', 'MultiLineString'].includes(feature.geometry?.type)) throw new Error('Geometría costera inválida');
    const coordinates = (feature.geometry as { coordinates: unknown }).coordinates;
    const check = (v: unknown): boolean => Array.isArray(v) && (typeof v[0] === 'number' ? v.length >= 2 && v.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 : v.every(check));
    if (!check(coordinates)) throw new Error('Coordenadas costeras inválidas');
  }
  return data;
}

export function coastalValue(feature: Feature, key: string): string {
  const value = feature.properties?.[key];
  if(key==='municipality'&&typeof value==='string')return projectCoastLabel(value);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.join(', ') : '';
}

export function coastalPopup(feature: Feature): HTMLElement {
  const p = feature.properties ?? {};
  if(typeof p.detail_url==='string' && /^\/data\/shorelines\/map\/details\/[a-f0-9]{64}\.json$/.test(p.detail_url)) {
    const shell=document.createElement('article');shell.className='coastal-analysis-popup';shell.setAttribute('aria-live','polite');
    const title=document.createElement('strong');title.textContent='Cargando cálculo y fuentes…';shell.appendChild(title);
    const load=()=>{
      title.textContent='Cargando cálculo y fuentes…';
      void loadDetails(p.detail_url).then(records=>{
        const details=records[String(p.detail_key)];if(!details)throw new Error('Missing record');
        const full={...details};delete full.detail_url;delete full.detail_key;
        if(p.display_symbol)full.display_symbol=p.display_symbol;
        if(p.display_endpoint){
          delete full.delta_m;delete full.apparent_change_toward_water_m;
          full.year=p.endpoint_year;full.estimated=p.endpoint_estimated===true;full.position_is_estimated=p.endpoint_estimated===true;
          full.date=p.endpoint_estimated?null:full[p.display_endpoint==='before'?'date_before':'date_after']??null;
          full.reference_only=p.display_endpoint==='before';
        }

        shell.replaceChildren(coastalPopup({...feature,properties:full}));
      }).catch(()=>{
        title.textContent='No se pudo cargar la explicación';
        const retry=document.createElement('button');retry.className='coastal-popup-retry';retry.textContent='Reintentar';
        retry.onclick=()=>{retry.remove();load();};shell.appendChild(retry);
      });
    };load();return shell;
  }
  const el = document.createElement('article'); el.className = 'coastal-analysis-popup';
  const addText = (parent: HTMLElement, text: string) => { const line = document.createElement('p'); line.textContent = text; parent.appendChild(line); };
  if(p.grid_spacing_m===100)addText(el,`Estación ${Number(p.grid_chainage_m).toLocaleString('es-MX')} m · malla de 100 m sobre la línea base de 2011. Los cruces originales se conservan como controles.`);
  const addUserReference=()=>{if(!p.user_reference_method)return;addText(el,String(p.user_reference_method).includes('user-')?'Referencia de 2011: línea blanca aportada por el usuario. Las otras fechas conservan su propia calidad de lectura.':'Referencia de 2011: borde visible entre arena y mar, interpretado en su fotografía fechada. Las otras fechas requieren su propia revisión.');const a=document.createElement('a');a.href=String(p.reference_method_url??'/data/shorelines/photo-alignment/user-guides-2011-method.md');a.target='_blank';a.rel='noreferrer';a.textContent='Trazos y referencia fija';el.appendChild(a);};
  if(p.photo_review_pending===true){
    const title=document.createElement('strong');title.textContent=p.baseline_fixed===false?'Referencia de 2011 pendiente':'Sin comparación fotográfica revisada';el.appendChild(title);
    addUserReference();
    addText(el,p.baseline_fixed===false?'No hay una orilla de 2011 interpretable y verificada en este perfil. El localizador indica el lugar de muestreo.':`Referencia fija: ${String(p.baseline_date??p.baseline_year)}. Para ${p.year} no hay una posición revisada compatible con esta imagen.`);
    addText(el,p.baseline_fixed===false?'Sin esa base no se calcula un cambio en metros.':'Se conserva el punto de referencia y no se le asignan metros mediante interpolación ni mediante el modelo.');
    addText(el,'Perfil '+coastalValue(feature,'profile_id')+' · '+coastalValue(feature,'municipality')+'.');
    const link=document.createElement('a');link.href=String(p.method_url);link.target='_blank';link.rel='noreferrer';link.textContent='Fechas revisadas y método';el.appendChild(link);
    return el;
  }
  if(p.photo_interpretation===true){
    const delta=typeof p.delta_m==='number'?p.delta_m:null;
    const title=document.createElement('strong');title.textContent=p.reference_only===true?'Referencia · '+p.year:delta===null?'Punto en revisión':p.estimated?'Cambio estimado · fotos':'Cambio aparente · fotos';el.appendChild(title);
    addUserReference();
    if(p.reference_only===true)addText(el,'Referencia '+p.year+'; todavía no se compara un cambio.');
    else if(delta!==null)addText(el,`${p.baseline_year} → ${p.year}: ≈ ${Math.round(Math.abs(delta)).toLocaleString('es-MX')} m ${p.direction_unresolved===true?'de diferencia · dirección incierta':delta<0?'hacia tierra':delta>0?'hacia el agua':'de cambio'}.`);
    else addText(el,p.photo_mismatch?`La foto de este punto es de ${String(p.photo_date).slice(0,4)}; el análisis está en ${p.year}. Elige su fecha para consultar la comparación compatible.`:p.baseline_year===null?'Falta una referencia interpretable de 2010 o 2011; este punto sigue pendiente.':p.photo_location_matched?'La foto tiene una posición interpretable, pero falta una pareja compatible con la base elegida.':'Este localizador es el lugar de muestreo; falta una orilla clara aceptada en esta foto.');
    addText(el,coastalValue(feature,'municipality')+(hasProjectCoastLabel(String(p.municipality))?' · rótulo del proyecto':p.municipality_is_approximate?' · municipio aproximado':'')+(p.photo_date?' · foto '+coastalValue(feature,'photo_date'):'')+'.');
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='coastal-method-details';summary.textContent='Cómo se calculó';details.appendChild(summary);
    addText(details,p.grid_spacing_m===100?'La malla se calcula con distancias geodésicas WGS84 sobre la orilla digitalizada de 2011. En otras fechas se interpola espacialmente entre dos controles revisados de la misma fotografía. Es una posición derivada, no una nueva lectura manual. No se interpolan años ni se unen fotografías de fechas o sensores distintos. Las consultas de fuente identifican los controles originales.':p.photo_review_method?'Se revisaron por separado los cruces del límite aparente entre agua y arena en cada foto disponible de este tramo. La referencia es la toma del 1 de agosto de 2011 y permanece fija; los metros se recalculan entre posiciones del mismo perfil. Revisión visual asistida por ChatGPT, sin validación de campo.':Array.isArray(p.photo_manual_reviews)&&p.photo_manual_reviews.length?'La referencia de 2011 se trazó sobre el límite visible de agua y arena en la foto, en una revisión manual asistida por ChatGPT. Se mantiene separado el candidato automático anterior. Los metros se recalculan entre las dos posiciones del mismo perfil; el trazado no es validación de campo.':'Se detectó el borde visible en cinco perfiles de la foto fechada y se comprobó con la conexión de tierra y mar en un área de la imagen. Ambos métodos deben coincidir dentro de 12 m. Los metros son la diferencia entre dos posiciones del mismo perfil. Investigación experimental asistida por ChatGPT; sin validación de campo.');
    if(p.photo_baseline_fallback===true)addText(details,'Se usa la foto de 2011 como referencia porque no hay una orilla interpretable aceptada de 2010 en este punto. El cambio empieza en 2011.');
    const reasons:Record<string,string>={water_classifier_ambiguous:'No se distingue el agua con suficiente claridad.',land_classifier_ambiguous:'No se distingue la tierra con suficiente claridad.',parallel_transects_disagree:'Los perfiles próximos no coinciden en una misma orilla.',search_edge:'El cruce queda junto al límite de búsqueda.',no_sharp_visible_edge:'No hay un borde visible suficientemente claro.',capture_footprint_seam:'El cruce cambia de huella o fuente de imagen.',non_beach_coast_type:'La cartografía identifica una obra, vegetación u otro tipo de costa; no se calcula como playa.',source_unavailable:'No se recibió una imagen suficiente para el cálculo.',edition_not_reviewed:'Esta edición del fondo todavía no forma parte de la revisión de posiciones.'};
    for(const reason of (Array.isArray(p.photo_rejection_reasons)?p.photo_rejection_reasons:[]).slice(0,2))if(reasons[String(reason)])addText(details,reasons[String(reason)]);
    if(p.photo_start_kind==='extrapolated')addText(details,'La base '+p.baseline_year+' se proyectó desde dos fotos posteriores. Es una estimación, no una observación de ese año.');
    if(p.photo_start_kind==='interpolated'||p.photo_end_kind==='interpolated')addText(details,'Parte de la comparación se interpoló entre las fotos disponibles; no es una nueva captura del año intermedio.');
    if(p.photo_end_kind==='extrapolated')addText(details,'El extremo final se proyectó hasta un año fuera de las fotos disponibles; sigue siendo estimado.');
    if(delta!==null&&p.direction_unresolved===true)addText(details,'La dirección no queda resuelta con el indicador de incertidumbre de posición disponible.');
    if(typeof p.registration_proxy_m==='number')addText(details,'Indicador de posición combinado: ≈ '+Math.round(p.registration_proxy_m)+' m; no incluye el error físico total.');
    addText(details,'Faltan correcciones de marea, oleaje y registro entre fotos. El movimiento visible no confirma por sí solo pérdida permanente de playa.');
    const link=document.createElement('a');link.href=typeof p.method_url==='string'?p.method_url:'/data/shorelines/photo-alignment/position-method.md';link.target='_blank';link.rel='noreferrer';link.textContent='Método completo y límites';details.appendChild(link);el.appendChild(details);
    const sources=document.createElement('details'),label=document.createElement('summary');label.textContent='Fechas y fuentes';sources.appendChild(label);
    if(typeof p.scenario_original_delta_m==='number')addText(sources,`Modelo anterior 2010 → ${p.year}: ${p.scenario_original_delta_m} m. La cifra mostrada arriba se recalculó entre las dos posiciones fotográficas; no se trasladó el modelo sobre la foto.`);
    const seen=new Set<string>();
    for(const source of Array.isArray(p.photo_sources)?p.photo_sources:[]){const c=source as {date?:string;provider?:string;source?:string};if(!c.date||seen.has(c.date))continue;seen.add(c.date);addText(sources,c.date+' · '+c.provider+' · '+c.source);}
    const anchor=p.photo_anchor_coordinate;
    const probes=Array.isArray(p.photo_metadata_points)?p.photo_metadata_points as {release:number;coordinate:number[];date?:string}[]:(Array.isArray(p.photo_source_releases)?p.photo_source_releases:[]).map(release=>({release:Number(release),coordinate:Array.isArray(anchor)?anchor as number[]:[],date:undefined}));
    const linked=new Set<string>();
    for(const probe of probes){if(!Array.isArray(probe.coordinate)||probe.coordinate.length!==2||probe.coordinate.some(v=>!Number.isFinite(v)))continue;const key=probe.release+':'+probe.coordinate.join(',');if(linked.has(key))continue;linked.add(key);const item=receivedEsriCatalogue.items.find(i=>i.releaseNum===probe.release);if(!item)continue;const url=new URL(item.metadataLayerUrl+'/6/query');url.search=new URLSearchParams({f:'json',where:'1=1',outFields:'SRC_DATE2,NICE_DESC,SRC_DESC,SAMP_RES,SRC_ACC',geometry:JSON.stringify({spatialReference:{wkid:4326},x:probe.coordinate[0],y:probe.coordinate[1]}),geometryType:'esriGeometryPoint',returnGeometry:'false',spatialRel:'esriSpatialRelIntersects'}).toString();const a=document.createElement('a');a.href=url.toString();a.target='_blank';a.rel='noreferrer';a.textContent='Metadatos del extremo'+(probe.date?' · '+probe.date:'')+' · edición '+item.releaseDateLabel;sources.appendChild(a);}
    addText(sources,'Perfil '+coastalValue(feature,'profile_id')+'.');el.appendChild(sources);
    if(Array.isArray(p.photo_manual_reviews)&&p.photo_manual_reviews.length){const a=document.createElement('a');a.href=typeof p.reference_method_url==='string'?p.reference_method_url:p.photo_review_method?'/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json':'/data/shorelines/photo-alignment/manual-digitization-20261103.json';a.target='_blank';a.rel='noreferrer';a.textContent=p.photo_review_method?'Intersecciones y procedencia · 5 nov 2026':'Trazado manual y procedencia · 3 nov 2026';sources.appendChild(a);}
    return el;
  }
  if(p.trajectory_estimate===true){
    const title=document.createElement('strong');title.textContent=p.before_reference===true?'Referencia aún no disponible':p.reference_only===true?'Referencia · '+p.baseline_year:'Cambio estimado · ChatGPT';el.appendChild(title);
    addUserReference();
    const delta=typeof p.delta_m==='number'?p.delta_m:null;
    addText(el,p.before_reference===true?`El año ${p.year} es anterior a la referencia ${p.baseline_year}; no se atribuye cero erosión.`:p.reference_only===true?`Punto de partida fijo: ${p.baseline_year}${p.trajectory_reference_kind==='model'?' · referencia reconstruida':''}.`:`${p.baseline_year} → ${p.year}: ≈ ${Math.round(Math.abs(delta??0)).toLocaleString('es-MX')} m ${delta!==null&&delta<0?'hacia tierra':delta!==null&&delta>0?'hacia el agua':'de cambio'} · estimación.`);
    addText(el,coastalValue(feature,'municipality')+' · '+(p.trajectory_reference_kind==='photo'?'base fotográfica':'base reconstruida con el modelo')+'.');
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Cómo se estimó';details.appendChild(summary);details.className='coastal-method-details';
    addText(details,'El punto inicial conserva la misma coordenada al cambiar de año o de foto. La barra une esa referencia con la posición del año analizado; su longitud es la diferencia sobre el mismo eje. No se fuerza un crecimiento continuo de erosión: puede haber avance o retroceso.');
    addText(details,p.trajectory_reference_kind==='photo'?'Se usa una posición aceptada de 2010 o 2011 como referencia.':'No hay referencia fotográfica aceptada de 2010/2011. Se reconstruye desde la primera foto aceptada y los cambios del modelo anterior; donde no hay fotos, desde la cartografía nominal de 2025. No se presenta como una orilla observada.');
    addText(details,p.trajectory_end_kind==='interpolated'?'El extremo del año se interpola entre posiciones fotográficas del mismo perfil.':p.trajectory_end_kind==='extrapolated'?'El extremo se proyecta como máximo un año con dos fotos próximas.':p.trajectory_end_kind==='spatial_estimate'?'El extremo se interpola entre vecinos de la misma captura y orientación; su ubicación y distancia siguen siendo estimadas.':p.trajectory_end_kind==='photo'?'El extremo se apoya en una lectura fotográfica; la comparación sigue estimada si su referencia es reconstruida o la foto no es la visible.':'El extremo usa los cambios anuales del modelo asistido por ChatGPT; no es una medición de esa orilla.');
    addText(details,'Estimación sin validación de campo ni corrección de marea, oleaje o registro. No confirma pérdida permanente de playa.');
    const method=document.createElement('a');method.href='/data/shorelines/photo-alignment/fixed-reference-method.md';method.target='_blank';method.rel='noreferrer';method.textContent='Método y límites';details.appendChild(method);el.appendChild(details);
    const sources=document.createElement('details'),label=document.createElement('summary');label.textContent='Fechas y fuentes';sources.appendChild(label);addText(sources,'Perfil '+coastalValue(feature,'profile_id')+'.');
    const seen=new Set<string>();for(const c of Array.isArray(p.trajectory_sources)?p.trajectory_sources:[]){const s=c as {date?:string;provider?:string;source?:string};if(!s.date||seen.has(s.date))continue;seen.add(s.date);addText(sources,s.date+' · '+s.provider+' · '+s.source);}
    addText(sources,'Cifra del modelo original 2010 → '+p.year+': '+coastalValue(feature,'scenario_original_delta_m')+' m. Se conserva separada del cálculo mostrado.');
    for(const [label,url] of [['Modelo original y apoyos','/data/shorelines/scenario/model.json.gz'],['Método del modelo','/data/shorelines/scenario/method.md']]){const a=document.createElement('a');a.href=url;a.textContent=label;a.target='_blank';a.rel='noreferrer';sources.appendChild(a);}el.appendChild(sources);
    return el;
  }
  if(p.scenario_unvalidated===true){
    const title=document.createElement('strong');title.textContent=p.image_alignment==='cartography'?'Ubicación por revisar':p.image_alignment==='spatial_estimate'?'Estimación · ubicación interpolada':'Estimación ChatGPT · sin validar';el.appendChild(title);
    const delta=Number(p.scenario_delta_m),before=Number(p.baseline_year),after=Number(p.comparison_end_year);
    addText(el,p.reference_only===true?`Inicio del escenario ${after}; no es cero erosión observada.`:`${before} → ${after}: ≈ ${Math.abs(delta).toLocaleString('es-MX')} m ${delta<0?'hacia tierra':delta>0?'hacia el agua':'de cambio'} en el modelo.`);
    addText(el,coastalValue(feature,'municipality')+(p.image_alignment_date?' · foto '+coastalValue(feature,'image_alignment_date'):'')+'.');
    addText(el,p.scenario_locator_only===true?(p.image_alignment==='photo'?'El punto está localizado en la foto indicada. Falta una pareja compatible para medir este periodo; la cifra anterior sigue siendo modelada.':p.image_alignment==='spatial_estimate'?'La ubicación se interpola entre dos perfiles de la misma captura. La cifra sigue siendo modelada; no es una medición local.':'Este punto conserva la ubicación cartográfica y la estimación anterior. Su posición en la foto y sus metros no están confirmados.'):'Es una estimación orientativa generada con ayuda de ChatGPT. No cuenta con validación local y no confirma daño real.');
    const details=document.createElement('details'),summary=document.createElement('summary');details.className='coastal-method-details';summary.textContent='Cómo se estimó';details.appendChild(summary);
    addText(details,'Se tomó la mediana ponderada de hasta cinco perfiles cercanos con datos preliminares. Los pesos disminuyen con la distancia. El algoritmo también admite apoyos cuya dirección sigue incierta.');
    if(p.scenario_extrapolated===true)addText(details,'Parte del periodo se proyectó con el año de apoyo más cercano, suponiendo una tasa constante.');
    if(p.scenario_temporal_interpolation===true)addText(details,'Los años interiores sin apoyos se interpolaron entre los años disponibles.');
    addText(details,p.scenario_locator_only===true?'La cifra del modelo anterior se conserva sin alterarla para hacerla coincidir con una foto. Se representa como punto, sin inventar dos orillas. Donde hay dos posiciones fotográficas aceptadas se dibuja una barra con su diferencia recalculada.':'Se tomó la cartografía INEGI 2023–2025 como ancla nominal de 2025. Los otros extremos se simularon sumando o restando los cambios anuales; no son orillas históricas comprobadas. Los cambios se redondearon a metros enteros, sin forzar un deterioro continuo.');
    if(p.image_alignment==='spatial_estimate')addText(details,'Perfiles usados sólo para localizar: '+coastalValue(feature,'image_alignment_donors')+'. Deben estar a ambos lados, a menos de 300 m cada uno, en la misma captura y con orientación compatible. Sus valores de erosión no se copian.');
    if(p.image_source_review)addText(details,'La ubicación cruza a otra captura o no tiene una huella fechada inequívoca. Su comparación fotográfica permanece pendiente.');
    addText(details,'Incertidumbre física sin cuantificar. No hay corrección de marea u oleaje ni validación de campo. En costas vegetadas o construidas la interpretación es especialmente hipotética.');
    const groups=Array.isArray(p.scenario_support)?p.scenario_support:[];
    if(groups.length){const trace=document.createElement('details'),label=document.createElement('summary');label.textContent='Ejemplos de datos de apoyo';trace.appendChild(label);for(const group of groups){const g=group as {year:number;rows:{id:string;value:number;weight:number;distance_m:number}[]};addText(trace,'Apoyos de '+g.year+':');for(const row of g.rows)addText(trace,`${row.id}: ${row.value.toLocaleString('es-MX',{maximumFractionDigits:1})} m; peso ${row.weight.toLocaleString('es-MX',{maximumFractionDigits:3})}; a ${(row.distance_m/1000).toLocaleString('es-MX',{maximumFractionDigits:1})} km.`);}details.appendChild(trace);}
    const link=document.createElement('a');link.href='/data/shorelines/scenario/method.md';link.target='_blank';link.rel='noreferrer';link.textContent='Método, supuestos y fuentes';details.appendChild(link);el.appendChild(details);
    const sources=document.createElement('details'),sourceTitle=document.createElement('summary');sourceTitle.textContent='Fuentes y cifras originales';sources.appendChild(sourceTitle);
    addText(sources,'Perfil '+coastalValue(feature,'profile_id')+' · años de apoyo: '+coastalValue(feature,'scenario_support_years')+'.');
    if(p.alignment_method_url){const a=document.createElement('a');a.href=String(p.alignment_method_url);a.target='_blank';a.rel='noreferrer';a.textContent='Revisión de ubicación y cálculo fotográfico';sources.appendChild(a);}
    for(const [text,url] of [['Valores por punto y año','/data/shorelines/scenario/values.csv.gz'],['Modelo y perfiles de apoyo','/data/shorelines/scenario/model.json.gz'],['Método de los datos preliminares','/data/shorelines/series-2015/method.md']]){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noreferrer';sources.appendChild(a);}el.appendChild(sources);
    return el;
  }
  if(p.assessment_only===true){
    const title=document.createElement('strong');title.textContent=p.assessment_reference_only?'Costa cartográfica de referencia · INEGI 2025':'Estado de investigación · '+coastalValue(feature,'municipality');el.appendChild(title);
    if(p.assessment_reference_only){addText(el,'Tipo de costa: '+coastalValue(feature,'SUBTIPO')+'. Referencia de ubicación, sin atribuirle una posición histórica ni metros de erosión.');}
    const status=p.assessment_status;addText(el,'Año analizado: '+coastalValue(feature,'assessment_year')+'. '+(p.assessment_reference_year===p.assessment_year&&status!==0?'Se conserva una posición de referencia; todavía no es una comparación de cambio.':status===1?'Hay una comparación procesada preliminar.':status===2?'Hay una comparación estimada, con apoyos y límites.':'Todavía no hay una pareja de posiciones cuantificable en este perfil.'));
    addText(el,'Esta franja ubica el tramo evaluado; no es la orilla de ese año y su anchura no representa metros de pérdida. Acerca y pulsa las barras para ver las cifras, fechas y fuentes.');
    const link=document.createElement('a');link.href='/data/shorelines/series-2015/method.md';link.target='_blank';link.rel='noreferrer';link.textContent='Método, cobertura y datos pendientes';el.appendChild(link);return el;
  }
  const delta = p.delta_m ?? p.apparent_change_toward_water_m;
  const isDelta = typeof delta === 'number' && Number.isFinite(delta) && p.position_is_estimated!==true;
  const resolution = Number(p.native_resolution_m ?? p.resolution_m ?? 10);
  const step = resolution >= 30 ? 10 : 5;
  const rounded = isDelta ? Math.round(Math.abs(delta) / step) * step : null;
  const strong = document.createElement('strong');
  strong.textContent = p.context_review === true ? 'Resultado en revisión' : isDelta && coastalDirectionUnresolved(p) ? (p.estimated?'Estimación':'Cambio aparente')+' · dirección incierta' : isDelta ? rounded === 0 ? `Cambio menor de ${step} m · por confirmar` : `≈ ${rounded?.toLocaleString('es-MX')} m ${delta < 0 ? 'hacia tierra' : 'hacia el agua'}` : `${p.estimated ? 'Posición estimada' : 'Borde del agua'} · ${coastalValue(feature, 'date') || coastalValue(feature, 'year')}`;
  if(p.reference_only===true)strong.textContent=(p.estimated?'Referencia estimada':'Posición de referencia')+' · '+(p.baseline_year??p.year??'')+' · sin comparación de cambio';
  if(isDelta && p.estimated===true && !strong.textContent.startsWith('Estimación') && p.reference_only!==true)strong.textContent='Estimación · '+strong.textContent;
  el.appendChild(strong);
  const startYear = p.baseline_year ?? p.comparison_start_year ?? 2025;
  const endYear = p.comparison_end_year ?? p.comparison_year ?? 2026;
  addText(el, isDelta ? `Comparación: ${startYear} → ${endYear}. ${coastalValue(feature, 'municipality')}` : `${coastalValue(feature, 'sensor') || 'Satélite'} · resolución de análisis: ${resolution} m por píxel.`);
  if(p.experimental_analysis === true) addText(el,'Estudio experimental · la compatibilidad entre familias de sensores y la exactitud física siguen sin validar.');
  addText(el, (p.estimated === true || p.spatial_estimate === true ? 'Estimación del proyecto' : 'Calculado a partir de imágenes') + ' · investigación asistida por ChatGPT.');
  if (p.display_symbol === 'profile_locator') addText(el, 'El punto señala dónde se calculó el cambio; su tamaño no representa metros. Acerca el mapa para distinguir la barra.');
  addText(el, 'El borde del agua también cambia con marea y oleaje. La cifra es preliminar y no equivale por sí sola a pérdida permanente de playa.');
  const method = document.createElement('details'); const methodTitle = document.createElement('summary'); methodTitle.textContent = 'Cómo se calculó y qué tan seguro es'; method.appendChild(methodTitle);
  addText(method, coastalValue(feature, 'method_summary') || coastalValue(feature,'basis_of_estimate_es') || 'Se calibraron bandas originales y se detectó el borde del agua en perfiles costeros. Se conservaron la captura y los controles de calidad de cada posición.');
  const contextExplanation=coastalValue(feature,'context_review_explanation');
  if(p.context_review && contextExplanation)addText(method,'Revisión del lugar: '+contextExplanation);
  if (isDelta) addText(method, 'Resultado numérico del algoritmo: ' + delta.toLocaleString('es-MX', {maximumFractionDigits:2}) + ' m. Los decimales permiten reproducir el cálculo; no representan precisión física centimétrica.');
  const persistence = coastalValue(feature, 'persistence_screen');
  const states: Record<string,string> = { modelled_NOT_observed_annual_change:'Posición modelada o comparación entre sensores: no es una medición anual de erosión.', faltan_tres_observaciones_validas_por_ano:'Todavía hay pocas capturas válidas para comprobar la persistencia.', single_capture_per_year_NO_temporal_persistence_test:'Sólo hay una captura por año en esta ventana; no se puede comprobar la persistencia del cambio.', revision_contextual_pendiente:'El lugar requiere revisión adicional de arena brillante, obras o canales.', retroceso_consistente_en_muestras:'Las muestras válidas coinciden en un movimiento hacia tierra.', avance_consistente_en_muestras:'Las muestras válidas coinciden en un movimiento hacia el agua.', variacion_intrannual_se_superpone:'La variación entre capturas se superpone; la dirección no queda resuelta.' };
  if (persistence) addText(method, states[persistence.split(';')[0]] ?? 'La comparación conserva los controles de calidad registrados en sus fuentes.');
  for (const [label,key] of [['Capturas usadas','n_obs'],['Variación entre capturas','within_year_spread_m'],['Incertidumbre','uncertainty_notes']] as const) { const value=coastalValue(feature,key); if(value) addText(method,label+': '+value); }
  const interval=p.interval_model_error_vs_proxy;
  if(!p.uncertainty_notes && Array.isArray(interval) && interval.length===2 && interval.every(v=>typeof v==='number'&&Number.isFinite(v)))addText(method,`Rango del modelo frente al indicador satelital: ${interval[0].toLocaleString('es-MX',{maximumFractionDigits:1})} a ${interval[1].toLocaleString('es-MX',{maximumFractionDigits:1})} m. No es un intervalo del error físico total.`);
  const neighbours=Array.isArray(p.neighbor_sources)?p.neighbor_sources:[];
  if(neighbours.length){
    const trace=document.createElement('details'),title=document.createElement('summary');title.textContent='Perfiles de apoyo y pesos del cálculo';trace.appendChild(title);
    for(const neighbour of neighbours){if(!neighbour || typeof neighbour!=='object')continue;const n=neighbour as Record<string,unknown>;if(typeof n.weight!=='number' || typeof n.delta_m!=='number')continue;const id=typeof n.profile_id==='string' || typeof n.profile_id==='number'?String(n.profile_id):'sin identificador';addText(trace,`Perfil ${id}: peso ${n.weight.toLocaleString('es-MX',{maximumFractionDigits:4})} × cambio ${n.delta_m.toLocaleString('es-MX',{maximumFractionDigits:2})} m.`);}
    method.appendChild(trace);
  }
  const methodLink=document.createElement('a'); methodLink.textContent='Procedimiento completo del proyecto'; methodLink.href=['/data/shorelines/annual/method.md','/data/shorelines/reference-2010/method.md','/data/shorelines/series-2015/method.md'].includes(String(p.method_url))?String(p.method_url):'/data/shorelines/method.md'; methodLink.target='_blank';methodLink.rel='noreferrer';method.appendChild(methodLink);el.appendChild(method);
  const sources=document.createElement('details');const sourceTitle=document.createElement('summary');sourceTitle.textContent='Ver fechas y fuentes';sources.appendChild(sourceTitle);
  const dates=coastalValue(feature,'capture_dates') || [coastalValue(feature,'date2025'),coastalValue(feature,'date2026')].filter(Boolean).join(' → ') || coastalValue(feature,'date');
  if(dates) addText(sources,(p.estimated?'Fechas de las capturas de apoyo: ':'Fechas reales: ')+dates);
  const urls = Array.isArray(p.source_urls) ? p.source_urls : Array.isArray(p.refs)?p.refs:[p.source_url];
  for(const [index,url] of urls.entries()) { if(typeof url !== 'string' || !url.startsWith('https://')) continue;const a=document.createElement('a');a.textContent='Fuente original '+(index+1);a.href=url;a.target='_blank';a.rel='noreferrer';sources.appendChild(a); }
  const profile=coastalValue(feature,'profile_id') || coastalValue(feature,'transect_id') || coastalValue(feature,'segment_id');if(profile)addText(sources,'Referencia del cálculo: '+profile);
  el.appendChild(sources);return el;
}
