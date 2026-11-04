import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEvolutionIndex,evolutionComparison} from '../lib/coastal-evolution.ts';
import {mergePublishedTransects} from '../lib/problems.ts';
import {CHELEM_PROGRESO_OVERVIEW} from '../lib/coastal-views.ts';
const root=new URL('../',import.meta.url),bytes=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await bytes(p));
const catalogue=await json('public/data/littoral/coastal-evolution.json');
const trends=await json('public/data/littoral/alec-trend-models.json');
const inventory=mergePublishedTransects(await Promise.all(['l5','l8','s2'].map(s=>json(`public/data/problems/s34-${s}.geojson`))));
const index=createEvolutionIndex(catalogue,{referencePolicy:'earliest',trends});
const [w,s,e,n]=CHELEM_PROGRESO_OVERVIEW;
// Existing camera window, not a new scientific delimitation or coastline area.
const sites=inventory.features.filter(f=>{const p=f.geometry.coordinates[0];return p[0]>=w&&p[0]<=e&&p[1]>=s&&p[1]<=n;});
const describe=c=>({id:c.id,year:c.year,status:c.status,reference:c.beforeCut?.datetime??null,change_m_rounded:c.changeM,
 observation:c.afterCut?{datetime:c.afterCut.datetime,product:c.afterCut.product.id,origin:c.afterCut.origin}:null,
 estimate:c.estimate?{rate_m_year:c.estimate.model.rate_m_year,period:c.estimate.period,anchor_datetime:c.estimate.anchorCut.datetime,anchor_product:c.estimate.anchorCut.product.id,evaluation:c.estimate.evaluationDate}:null});
const counts={};
for(const year of [2010,2011,2026]){
 const records=sites.map(f=>evolutionComparison(index,f.properties.idPol_Tran,year));
 counts[year]=Object.fromEntries(['available','estimated','baseline','no_reference','no_observation'].map(status=>[status,records.filter(c=>c.status===status).length]));
}
const pairs=sites.map(f=>({id:f.properties.idPol_Tran,old:evolutionComparison(index,f.properties.idPol_Tran,2010),now:evolutionComparison(index,f.properties.idPol_Tran,2026)})).filter(p=>p.old.changeM!==null&&p.now.changeM!==null);
const report={processed_at:new Date().toISOString(),source_catalogue_sha256:createHash('sha256').update(await bytes('public/data/littoral/coastal-evolution.json')).digest('hex'),
 window:{bounds:CHELEM_PROGRESO_OVERVIEW,meaning:'Existing interface camera window; axes selected by their authored first coordinate, not a scientific coastline boundary',axes:sites.length},counts,
 actual_2010_products:catalogue.observations.filter(c=>c.datetime.startsWith('2010')).map(c=>c.product.id),
 actual_2011_products:catalogue.observations.filter(c=>c.datetime.startsWith('2011')).map(c=>c.product.id),
 same_axis_pairs_2010_2026:pairs.length,
 apparent_difference_only:{seaward:pairs.filter(p=>p.now.changeM>p.old.changeM).length,landward:pairs.filter(p=>p.now.changeM<p.old.changeM).length,same_rounded_value:pairs.filter(p=>p.now.changeM===p.old.changeM).length,warning:'Not measured 2010–2026 recovery or erosion: the old endpoints are estimates, and the instantaneous 2026 waterlines are uncorrected'},
 example:['P16_T296'].map(id=>({id,comparisons:[2010,2011,2026].map(year=>describe(evolutionComparison(index,id,year)))})),
 conclusion:'No verified general recovery of the coast from 2010 to 2026 can be established from this viewer. A shorter measured bar than a prior modeled bar is not evidence of recovered sand. The first supplied screenshot is labeled 2011, not 2010. Its selected axis ID is not visible, so no exact pixel-to-axis identification is asserted.',
 remaining_controls:['Accepted observed 2010/2011 shorelines at the same sites','Tide and wave setup correction using beach slope and capture conditions','Independent registration and sensor/method homologation','Repeated within-season observations and field validation'],
 scientific_sources:[{url:'https://doi.org/10.1016/j.rsma.2023.103247',claim:'Regional study reports mixed erosion/accretion and migrating shoreline sand waves; it does not establish 2026 recovery'},{url:'https://doi.org/10.1038/s43247-023-01001-2',claim:'Waterline detection is affected by georeferencing, resolution, method, tides and waves; accuracy must be validated locally'}]};
await writeFile(new URL('scientific/coverage-extension/audit-2010-2026.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
