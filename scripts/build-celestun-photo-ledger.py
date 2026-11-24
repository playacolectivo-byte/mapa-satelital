"""Small, lossless date ledger for one reviewed municipality."""
from pathlib import Path
import json,sys,collections
ROOT=Path(__file__).resolve().parents[1]
slug=sys.argv[1] if len(sys.argv)>1 else 'celestun'
assert slug in ['celestun','ixil']
version=json.loads((ROOT/f'lib/generated/{slug}-review-version.json').read_text())
photos=json.loads((ROOT/f'public/data/municipalities/{slug}/photos.json').read_text());model=json.loads((ROOT/f'public/data/municipalities/{slug}/scenario.json').read_text());byid={t['id']:t for t in model['targets']};groups=[];targets=[]
for row in photos['targets']:
 t=byid[row['id']]
 if not t['type'].startswith('Playa'):continue
 readings=[]
 for r in row['readings']:
  if not r['accepted']:continue
  if r['releases'] not in groups:groups.append(r['releases'])
  readings.append([r['capture'],groups.index(r['releases'])])
 # A profile rejected in every date must not hide the dates of its nearest
 # interpretable sandy shore when the camera passes over a breakwater.
 if readings:targets.append({'id':t['id'],'coordinates':t['p'],'readings':readings})
data={'method':version['method'],'captures':photos['captures'],'release_groups':groups,'targets':targets}
if slug=='ixil':
 coverage=collections.defaultdict(lambda:collections.defaultdict(set))
 for t in targets:
  for capture,group in t['readings']:
   for release in groups[group]:coverage[photos['captures'][capture]['date'][:4]][release].add(t['id'])
 data['preferred_releases']={year:sorted(editions,key=lambda release:(-len(editions[release]),-release)) for year,editions in coverage.items()}
(ROOT/f'lib/generated/{slug}-reviewed-photos.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print(slug+' date ledger:',len(targets),'profiles;',sum(len(t['readings']) for t in targets),'accepted captures')
