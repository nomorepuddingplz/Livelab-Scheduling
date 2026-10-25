import json,re,datetime,collections,pathlib,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[2]
rows=json.loads((ROOT/'week-import-source.json').read_text())
TARGET='2026-10-05'; END='2026-10-11'
ALIASES={'nathan':'Nathan'}
config=ROOT/'week-import-decisions.json'
if config.exists(): ALIASES.update(json.loads(config.read_text()).get('aliases',{}))
def fold(x):return ''.join(c for c in unicodedata.normalize('NFKD',x) if not unicodedata.combining(c)).casefold()
ALIASES={fold(k):v for k,v in ALIASES.items()}
def name(x):
 x=re.sub(r'\s+',' ',str(x or '').strip().lstrip('@'))
 return ALIASES.get(fold(x),x)
def project(v,row):
 a=str(v.get('A','')).strip()
 if row in [123,124,125]:return 'Xtool Ebay'
 if row in [403,404]:return 'Creality Ebay'
 a=re.sub(r'\s+(?:mod(?:erator)?(?: training)?|training|trainer|daily review|weekly review|assistant)$','',a,flags=re.I)
 if a.lower()=='basic':return 'Basic Training'
 if a.lower()=='vevor':return 'VEVOR TOOL'
 if a.lower()=='cariloha':return 'Cariloha Amazon'
 return a
selected=[];skipped=[];issues=[]
for row in rows:
 v=row['values'];date=str(v.get('B',''))[:10];n=row['row']
 if not TARGET<=date<=END:
  if re.match(r'2026-\d\d-\d\d',date):skipped.append(n)
  continue
 p=project(v,n)
 if not p:continue
 a=str(v.get('A',''));mod=bool(re.search(r'\bmod\b',a,re.I)) or n in [111,112,155,156,157]
 typ='training' if re.search(r'train',a,re.I) or n==185 else 'other' if re.search(r'review',a,re.I) else 'live'
 selected.append({'row':n,'project':p,'date':date,'type':typ,'mod':mod,'name':name(v.get('F')),'raw':v,'time':str(v.get('D','')).strip()})
# Canonical project spelling prevents duplicate case variants.
project_names={}
for r in selected:r['project']=project_names.setdefault(r['project'].casefold(),r['project'])
# A person explicitly listed in moderator rows stays a moderator in training rows.
known_mod={r['name'] for r in selected if r['mod'] and r['name']}
known_host={r['name'] for r in selected if not r['mod'] and r['type']=='live' and r['name']}
for r in selected:
 if r['type']!='live' and r['name'] in known_mod and r['name'] not in known_host:r['mod']=True
 if r['row']==46:r['mod']=True

def parse_time(date,raw):
 s=raw.lower().replace(' ','').replace('：',':').replace('–','-').replace('—','-')
 parts=s.split('-');assert len(parts)==2,raw
 def options(t):
  m=re.fullmatch(r'(\d{1,2})(?::(\d{2}))?(?::00)?(am|pm)?',t);assert m,t
  h=int(m[1]);minute=int(m[2] or 0);ap=m[3];assert 1<=h<=12 and 0<=minute<60,t
  if ap:return [(h%12+(12 if ap=='pm' else 0))*60+minute]
  return [(h%12)*60+minute,(h%12+12)*60+minute]
 choices=[]
 for st in options(parts[0]):
  for en in options(parts[1]):
   end=en+(1440 if en<=st else 0);duration=end-st
   if duration<=16*60:choices.append((duration,st,end))
 if not choices:raise ValueError('ambiguous or >16h: '+raw)
 _,st,en=min(choices)
 d=datetime.datetime.fromisoformat(date)
 return (d+datetime.timedelta(minutes=st)),(d+datetime.timedelta(minutes=en))
for r in selected:
 if r['row']==173:
  issues.append({'row':173,'project':r['project'],'date':r['date'],'name':r['name'],'reason':'Time pending confirmation: 11:45pm–2:15pm / 时间待确认，未排入此 Mod 时段'});continue
 if not r['time']:
  issues.append({'row':r['row'],'project':r['project'],'date':r['date'],'name':r['name'],'reason':'Missing start/end time / 缺少开始或结束时间'});continue
 try:r['start'],r['end']=parse_time(r['date'],r['time'])
 except Exception as e:issues.append({'row':r['row'],'project':r['project'],'date':r['date'],'name':r['name'],'reason':str(e)})
# Explicit AM/PM typo is not silently changed: leave this single shift pending confirmation.
mods=[];events=[];people=collections.defaultdict(set)
def register(n,role):
 if n:people[n].add(role)
def notes(r):
 return [f"Excel row {r['row']} / 原表第 {r['row']} 行 · {r['raw'].get('A')} · {r['date']} · {r['time']}"]+[f"{k}: {r['raw'][k]}" for k in ['G','H','I','J','K'] if r['raw'].get(k)]
def ass(n,role,start,end,row):return {'name':n,'role':role,'start':start,'end':end,'sourceRows':[row]}
for r in selected:
 role='moderator' if r['mod'] else 'host';register(r['name'],role)
 if 'start' not in r:continue
 if r['mod'] and r['type']=='live':
  if not r['name'] and re.fullmatch(r'@[^\d]+',str(r['raw'].get('G','')).strip()):r['name']=name(r['raw']['G']);register(r['name'],'moderator')
  mods.append(r);continue
 key=(r['project'].lower(),r['type'],r['start'],r['end'])
 e=next((e for e in events if e['_key']==key),None)
 if not e:
  pad=datetime.timedelta(minutes=15 if r['type']=='live' else 0)
  e={'_key':key,'project':r['project'],'title':r['project']+(' · Training' if r['type']=='training' else ''),'type':r['type'],'start':r['start'],'end':r['end'],'roomStart':r['start']-pad,'roomEnd':r['end']+pad,'assignments':[],'sourceRows':[],'notes':[]};events.append(e)
 e['sourceRows'].append(r['row']);e['notes']+=notes(r)
 if r['name']:e['assignments'].append(ass(r['name'],role,r['start'],r['end'],r['row']))
 # Unambiguous inline moderator assignments in the Mod column.
 if r['row'] in [271,272]:
  n=name(r['raw']['G']);register(n,'moderator');e['assignments'].append(ass(n,'moderator',e['roomStart'],e['roomEnd'],r['row']))
 # Preserve training coordinator as a participant.
 if r['row'] in [4,5]:
  n=name(r['raw']['G']);register(n,'moderator');e['assignments'].append(ass(n,'moderator',r['start'],r['end'],r['row']))
# Source note explicitly assigns a second moderator, 6–7pm.
extra=next((r for r in mods if r['row']==629),None)
if extra:
 other=dict(extra);other['name']='Xi Chen';other['time']='6:00pm-7:00pm';other['start'],other['end']=parse_time(other['date'],other['time']);mods.append(other);register('Xi Chen','moderator')
for r in mods:
 live=sorted([e for e in events if e['type']=='live' and e['project'].lower()==r['project'].lower() and e['start'].date().isoformat()==r['date']],key=lambda e:e['start'])
 matches=[e for e in live if e['start']<r['end'] and e['end']>r['start']]
 if len(live)==1 and not matches:matches=live
 if not matches:
  # Keep independent moderator-only slots when the source has no matching live session.
  e={'_key':None,'project':r['project'],'title':r['project']+' · Moderator shift','type':'other','start':r['start'],'end':r['end'],'roomStart':r['start'],'roomEnd':r['end'],'assignments':[],'sourceRows':[],'notes':['Moderator-only source slot / 原表独立场控时段']};events.append(e);matches=[e]
 # Split a long moderator shift only at successive event boundaries; the union stays exact.
 boundaries=[r['start']]+[e['start'] for e in matches[1:]]+[r['end']]
 for i,e in enumerate(matches):
  st,en=boundaries[i:i+2]
  if en<=st:continue
  e['sourceRows'].append(r['row']);e['notes']+=notes(r)
  if r['name']:e['assignments'].append(ass(r['name'],'moderator',st,en,r['row']))
  else:e['notes'].append('Moderator not assigned / 场控待指定')
for e in events:
 e.pop('_key');e['sourceRows']=sorted(set(e['sourceRows']));e['notes']='\n'.join(dict.fromkeys(e['notes']))
 # Same training coordinator repeated in individual trainee rows should occur once.
 unique={}
 for a in e['assignments']:
  k=(a['name'],a['role'],a['start'],a['end'])
  if k in unique:unique[k]['sourceRows']+=a['sourceRows']
  else:unique[k]=a
 e['assignments']=list(unique.values())
plan={'week':TARGET,'source':'美区主播排班表（运营_场控共享）.xlsx','sheet':'2026.10.05 -2026.10.11','projects':sorted(set(r['project'] for r in selected)),'members':[{'name':n,'role':'both'} for n,r in sorted(people.items())],'events':events,'pending':issues,'excludedDateRows':skipped,'sourceRows':len(selected)}
def default(x):return x.isoformat(timespec='minutes') if isinstance(x,datetime.datetime) else list(x)
(ROOT/'week-import-plan.json').write_text(json.dumps(plan,default=default,ensure_ascii=False,indent=2))
print(json.dumps({'projects':plan['projects'],'members':len(plan['members']),'events':len(events),'pending':issues,'outsideWeekRows':len(skipped)},ensure_ascii=False,indent=2))
