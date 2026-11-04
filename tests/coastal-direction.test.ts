import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coastalDirectionUnresolved} from '../lib/coastal-direction.ts';
test('overlapping captures keep an uncertain direction when a legacy boolean is absent or false',()=>{
  const legacy={delta_m:-3.3294191287837425,persistence_screen:'variacion_intrannual_se_superpone'};
  assert.equal(coastalDirectionUnresolved(legacy),true);
  assert.equal(coastalDirectionUnresolved({...legacy,direction_unresolved:false}),true);
  assert.equal(coastalDirectionUnresolved({...legacy,persistence_screen:legacy.persistence_screen+';native_quality'}),true);
});
test('an explicit uncertainty flag remains authoritative for modelled or processed records',()=>{
  assert.equal(coastalDirectionUnresolved({direction_unresolved:true,estimated:false}),true);
  assert.equal(coastalDirectionUnresolved({direction_unresolved:true,estimated:true}),true);
});
test('a signed result without an overlap warning is not reclassified solely because it is negative',()=>{
  assert.equal(coastalDirectionUnresolved({delta_m:-40,direction_unresolved:false,persistence_screen:'retroceso_consistente_en_muestras'}),false);
});
