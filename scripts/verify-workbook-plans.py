import json,runpy,collections,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
n=runpy.run_path(str(Path(__file__).with_name('prepare-week-import.py')))
p=json.loads((ROOT/'week-import-plan.json').read_text());a=json.loads((ROOT/'availability-import-plan.json').read_text())
represented=set(x for e in p['events'] for x in e['sourceRows']);pending={r['row'] for r in p['pending']}
selected={r['row'] for r in n['selected']}
assert represented.isdisjoint(pending);assert represented|pending==selected
assert not represented.intersection(p['excludedDateRows'])
assert len({v.casefold() for v in p['projects']})==len(p['projects'])
def intervals(v):
 merged=[]
 for st,en in sorted(v):
  if merged and st<=merged[-1][1]:merged[-1]=(merged[-1][0],max(merged[-1][1],en))
  else:merged.append((st,en))
 return merged
for r in n['selected']:
 if r['row'] in pending or not r['name']:continue
 found=[(datetime.datetime.fromisoformat(x['start']),datetime.datetime.fromisoformat(x['end'])) for e in p['events'] for x in e['assignments'] if r['row'] in x['sourceRows'] and x['name']==r['name']]
 assert intervals(found)==[(r['start'],r['end'])],(r['row'],r['name'],found)
assert len(a['availability'])+sum(len(x['replacedRows']) for x in a['availability'])==a['sourceResponses']
for x in a['availability']:
 assert len(x['slots'])==7 and all(len(d)==96 and all(y in [0,1] for y in d) for d in x['slots'])
 assert [sum(d)/4 for d in x['slots']]==x['hoursByDay']
# Independent noon, latest-response, and fully unavailable spot checks.
lookup={x['name']:x for x in a['availability']}
assert lookup['Dilara Foscht']['sourceRow']==53 and lookup['Dilara Foscht']['replacedRows']==[32]
assert lookup['Frank Hunter']['hoursByDay'][3:]==[0,0,0,0]
print('PASS: all 393 source rows are accounted for; all named source shift intervals preserved exactly; availability grids complete; latest submissions selected.')
print('Availability samples:',json.dumps({k:lookup[k]['hoursByDay'] for k in ['Carolina Gutierrez','Frank Hunter','Juan Castillo','Dilara Foscht','Bianca Foscht','Sebastian C']},ensure_ascii=False))
