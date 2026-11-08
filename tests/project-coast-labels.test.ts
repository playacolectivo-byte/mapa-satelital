import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectCoastLabel,projectPlaceLabel,PROJECT_COAST_LABEL_NOTE} from '../lib/project-coast-labels.ts';
import {municipalityHref} from '../lib/municipal-pages.ts';
test('project aliases retain source identifiers and never invent the unresolved western sector',()=>{
 const places=JSON.parse(readFileSync(new URL('../public/data/coastal-places.json',import.meta.url),'utf8')).places;
 for(const [code,label] of [['310260035','Ixil San Benito'],['310260004','Ixil San Bruno']]){
  const p=places.find((p:{cvegeo:string})=>p.cvegeo===code);assert.ok(p);assert.equal(p.municipality,'Dzemul');assert.equal(projectPlaceLabel(p.name,p.cvegeo),label);assert.notEqual(p.name,label);
 }
 assert.equal(projectCoastLabel('Progreso'),'Progreso');assert.equal(projectCoastLabel('Ixil'),'Ixil');assert.equal(municipalityHref('dzemul'),'/municipio/dzemul/');
 assert.ok(!projectCoastLabel('Dzemul').includes('Poniente'));assert.match(PROJECT_COAST_LABEL_NOTE,/no están verificados/);
});
