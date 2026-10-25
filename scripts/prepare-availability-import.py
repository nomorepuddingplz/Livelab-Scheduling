"""Read every complete exported cell, normalize confirmed names, keep latest response."""
import json,re,collections,pathlib,unicodedata,datetime
ROOT=pathlib.Path(__file__).resolve().parents[2]
rows=json.loads((ROOT/'availability-import-source.json').read_text())[1:]
# Explicit row-based mapping retains two user-deferred identity questions separately.
canonical={2:'Victoria Rose',3:'Ali Kassem',4:'Andrew Cobb',5:'Emily Bolt',6:'Asante Randall',7:'Amber Hergen',8:'Suzannah Samuel',9:'Jerry Alamo',10:'Simone Baker',11:'Ali Kassem',12:'Ismael U. Ramirez',13:'Adriana Vecchioli',14:'Rose Donahue',15:'Lisa Meyerovich',16:'Carolina Gutierrez',17:'Ryan Moreno',18:'Kaitlyn didi',19:'Rachel Jackson',20:'Angel Zhu',21:'Asante Randall',22:'Fiona Lee',23:'Lisa Meyerovich',24:'Venus',25:'Yanjia Wu',26:'Diana Larios',27:'Tiffany Rahban',28:'Andrew Cobb',29:'Theresa Leila Crumpton',30:'Aislinn Evans',31:'Christian Zuniga',32:'Dilara Foscht',33:'Bianca Foscht',34:'Leland Heflin',35:'Ying Xiong',36:'Victoria Williams',37:'Stella Daley',38:'Juan Castillo',39:'Marian Ebhamen',40:'Magdalena Zielonka',41:'Yu Geng',42:'Ryan Moreno',43:'Frank Hunter',44:'Anthony Traina',45:'Dina Veronica Zavala Fuentes',46:'Calvin Albarracin',47:'Brian Linsley',48:'Meredith Breitstein',49:'Audrey Forrester',50:'Jessica Katz',51:'Marina Hribernig',52:'Austine',53:'Dilara Foscht',54:'Sabrina Cortes',55:'Ava Gold',56:'Kutloano Headbush',57:'Ian Sandvik',58:'Jessie / Gigi',59:'Daniel Torres Guevara',60:'SebastianI',61:'Jack Farmer',62:'Naomi Griffin',63:'Joseph Davis Massingill',64:'Iris (Alexis) Perry',65:'Victoria Rose',66:'Byron Morse',67:'Cesar Heiberg Ramirez Sieber',68:'Jennie Marie Pacelli',69:'Emily Bolt',70:'Lourdes Urquiza',71:'Parker Elliott',72:'William Dennis',73:'Iris Zhang',74:'Maximillian',75:'Wanyi Zhao',76:'Cassi Jerkins',77:'Sebastian C',78:'Yanjia Wu',79:'Leland Heflin',80:'Simone Baker',81:'Jerry Alamo',82:'Zhaoen Fan',83:'Kate Feng',84:'Jillian Reeves',85:'Madox Dorsey',86:'Izzy Mu',87:'Maksymilian Bobieni Rondio',88:'Qinke Li',89:'Manni Xu',90:'Christian Sariol'}
def clean(x):return re.sub(r'\s+',' ',str(x or '').strip().lstrip('@'))
def fold(x):return ''.join(c for c in unicodedata.normalize('NFKD',clean(x)) if not unicodedata.combining(c)).casefold()
aliases={}
for r in rows:
 n=canonical[r['row']];aliases[clean(r['values']['B'])]=n
 k=clean(r['values'].get('K'))
 if k and not k.lower().startswith(('guest','访客')):aliases[k]=n
aliases.update({'nathan':'Nathan','Carolina':'Carolina Gutierrez','Carolina G':'Carolina Gutierrez','Jessica':'Jessica Katz','Rock':'Juan Castillo','Andy Cobb':'Andrew Cobb','Austine (Aui)':'Austine','Ryan M':'Ryan Moreno','Yuting Mu':'Izzy Mu','maximilianS':'Maximillian','Adriana V':'Adriana Vecchioli','AislinnE':'Aislinn Evans','Ismael':'Ismael U. Ramirez','Calvin':'Calvin Albarracin','Lisa':'Lisa Meyerovich','Byron':'Byron Morse','Meredith B':'Meredith Breitstein','Kate':'Kate Feng'})
# Stable case/accent normalization across both workbooks.
for n in canonical.values():aliases[n]=n
(ROOT/'week-import-decisions.json').write_text(json.dumps({'aliases':aliases,'pendingIdentities':['Jessie / Gigi vs Jessie Canizales','SebastianI vs Orlando Sebastian Ibanez'],'pendingScheduleRows':[173]},ensure_ascii=False,indent=2))
def ranges(value):
 s=clean(value).lower()
 if s=='not available':return []
 if s=='all day available':return [(0,1440)]
 assert s, 'Blank availability cell must be reviewed'
 if 'not available' in s: return [] # Pending contradictory selection; audit below.
 if 'all day available' in s: return [(0,1440)]
 result=[]
 for bit in s.split(','):
  m=re.fullmatch(r'\s*(\d{1,2}):(\d{2})(am|pm)?\s*-\s*(\d{1,2}):(\d{2})(am|pm)\s*',bit)
  assert m,repr(bit)
  def candidates(h,minute,ap):
   h=int(h);minute=int(minute);assert 1<=h<=12 and 0<=minute<60
   return [(h%12)*60+minute+(720 if a=='pm' else 0) for a in ([ap] if ap else ['am','pm'])]
  ends=candidates(m[4],m[5],m[6]);options=[]
  for a in candidates(m[1],m[2],m[3]):
   for b in ends:
    if b<=a:b+=1440
    options.append((b-a,a,b))
  duration,start,end=min(options)
  assert duration==60,repr(bit) # Collected form choices are complete one-hour ranges.
  assert end<=1440 and start%15==0 and end%15==0
  result.append((start,end))
 return result
latest={};all_rows=collections.defaultdict(list)
for r in rows:
 n=canonical[r['row']];v=r['values'];assert v['L']=='10/05-10/11'
 all_rows[n].append(r['row'])
 if n not in latest or (v['J'],r['row'])>(latest[n]['values']['J'],latest[n]['row']):latest[n]=r
out=[]
for n,r in sorted(latest.items()):
 v=r['values'];slots=[];hours=[]
 for col in 'CDEFGHI':
  day=[0]*96
  for st,en in ranges(v[col]):day[st//15:en//15]=[1]*((en-st)//15)
  slots.append(day);hours.append(sum(day)/4)
 notes='\n'.join(str(v[k]).strip() for k in ['N','O'] if str(v.get(k,'')).strip())
 out.append({'name':n,'role':'both','week':'2026-10-05','slots':slots,'hoursByDay':hours,'notes':notes,'sourceRow':r['row'],'submissionTime':v['J'],'replacedRows':[x for x in all_rows[n] if x!=r['row']]})
plan={'week':'2026-10-05','source':'主播时间收集表_收集表_收集结果.xlsx','sourceResponses':len(rows),'availability':out,'pendingIdentities':['Jessie / Gigi vs Jessie Canizales','SebastianI vs Orlando Sebastian Ibanez'],'pendingAvailability':[{'row':33,'days':['Thursday','Friday'],'name':'Bianca Foscht','reason':'Not available selected alongside 7am–4pm'},{'row':77,'days':['Friday'],'name':'Sebastian C','reason':'All day selected alongside 7am–12am'}]}
(ROOT/'availability-import-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2))
print(json.dumps({'responses':len(rows),'members':len(out),'replacedResponses':sum(len(x['replacedRows']) for x in out),'availableQuarterHours':sum(sum(sum(d) for d in x['slots']) for x in out),'notes':sum(bool(x['notes']) for x in out)},indent=2))
