import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CalendarFrameChoice, datedChoiceForYear} from '../lib/calendar-time.ts';
const root=new URL('../',import.meta.url);
const fixturePath='scripts/fixtures/esri-local-capture-dates-2026-10-28.json';
const fixtureBytes=await readFile(new URL(fixturePath,root));
const fixture=JSON.parse(fixtureBytes);
const getKey=x=>x.key,getDate=x=>x.date;
let combinations=0, corrected=0;const corrections=[];
for(const point of fixture.points){
 for(let year=1986;year<=2026;year++){
  const selector=new CalendarFrameChoice();
  const hinted=point.entries.map(x=>({...x}));
  const initial=selector.choose('same-local-scope',hinted,year,getKey,getDate);
  const hydrated=hinted.map(x=>({...x,date:x.capture??x.date}));
  const correct=datedChoiceForYear(hydrated,year,getDate);
  const actual=selector.choose('same-local-scope',hydrated,year,getKey,getDate);
  if (!correct) assert.equal(actual,null,`${point.name}/${year}: a missing exact year must stay empty`);
  else {
    assert.ok(actual); assert.equal(Number(actual.date.slice(0,4)),year);
    const initialActual=initial?hydrated.find(x=>x.key===initial.key):null;
    if(initialActual&&Number(initialActual.date.slice(0,4))!==year){
      assert.equal(actual.key,correct.key);corrected++;corrections.push({point:point.name,year,previous_hint:initial.date,rejected_local_capture:initialActual.date,selected_local_capture:actual.date});
    }
  }
  assert.equal(selector.choose('same-local-scope',[...hydrated].reverse(),year,getKey,getDate)?.key??null,actual?.key??null);
  combinations++;
 }
}
assert.ok(combinations>0,'The real local-date fixture is exercised across every calendar year');
const empty=new CalendarFrameChoice();assert.equal(empty.choose('empty',[],2026,getKey,getDate),null);
const beforeCoverage=new CalendarFrameChoice();const onlyFuture=[{key:'first',date:'2011-08-01'},{key:'second',date:'2012-12-15'}];
assert.equal(beforeCoverage.choose('before',onlyFuture,1986,getKey,getDate),null,'Before coverage begins, no other year may be shown');
const stable=new CalendarFrameChoice();const tied=[{key:'a',date:'2022-09-25'},{key:'b',date:'2022-09-25'}];
assert.equal(stable.choose('ties',tied,2022,getKey,getDate).key,'b');assert.equal(stable.choose('ties',tied.toReversed(),2022,getKey,getDate).key,'b','Tie reordering cannot redirect an already-valid local image');
const report={checked_at:new Date().toISOString(),status:'passed',fixture:fixturePath,fixture_sha256:createHash('sha256').update(fixtureBytes).digest('hex'),sampled_locations:fixture.points.length,annual_selections:combinations,corrected_future_local_captures:corrected,checks:['Real Esri metadata hydration across all 41 calendar years','Only a capture in the exact requested year may be chosen','Stable valid selection and date ties after catalogue reordering','Before-coverage and missing years remain empty','Empty catalogue remains empty'],corrections};
await writeFile(new URL('docs/qa/strict-local-capture-choice-2026-10-28.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
