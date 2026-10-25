// Explicit local import, with a fresh backup supplied by the operator and one atomic transaction.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {api} from '../src/api.mjs';
import {epoch} from '../src/time.mjs';
const root=path.resolve('..');
const schedule=JSON.parse(fs.readFileSync(path.join(root,'week-import-plan.json')));
const availability=JSON.parse(fs.readFileSync(path.join(root,'availability-import-plan.json')));
const decisions=JSON.parse(fs.readFileSync(path.join(root,'week-import-decisions.json')));
const dbFile=process.argv[2];if(!dbFile)throw new Error('Specify a backed-up database path');
const sql=new DatabaseSync(dbFile);sql.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');
function prepare(query,args=[]){return {bind(...v){return prepare(query,v)},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}}}}}
const DB={prepare,async batch(cmds){const out=[];for(const c of cmds)out.push(await c.run());return out}};
const env={DB,LOCAL_PREVIEW:'1',ADMIN_ACCESS_KEY:'import-local-only'};
async function call(route,method='GET',data){const res=await api(new Request('http://127.0.0.1/api/'+route,{method,headers:{'content-type':'application/json','origin':'http://127.0.0.1','x-local-admin':'1'},...(data?{body:JSON.stringify(data)}:{})}),env);const body=await res.json();if(!res.ok)throw new Error(route+': '+JSON.stringify(body));return body}
const fold=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const aliases=new Map(Object.entries(decisions.aliases).map(([k,v])=>[fold(k),v]));
const canonical=s=>aliases.get(fold(s))||s.trim();
const sourceKey='workbooks:2026-10-05:v1';
const hash=crypto.createHash('sha256').update(JSON.stringify({schedule,availability,decisions})).digest('hex');
const report={week:schedule.week,projectsCreated:0,projectsReused:0,membersCreated:0,membersReused:0,eventsCreated:0,availabilityImported:0,assignments:0,pending:schedule.pending,pendingIdentities:availability.pendingIdentities,sourceHash:hash,pendingAvailability:availability.pendingAvailability||[]};
sql.exec('BEGIN IMMEDIATE');
try{
 for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())if(!sql.prepare('SELECT name FROM _local_migrations WHERE name=?').get(file)){sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));sql.prepare('INSERT INTO _local_migrations(name) VALUES(?)').run(file)}
 sql.exec('CREATE TABLE IF NOT EXISTS _workbook_imports (source_key TEXT PRIMARY KEY, source_hash TEXT NOT NULL, imported_at TEXT NOT NULL, report TEXT NOT NULL)');
 const prior=sql.prepare('SELECT source_hash FROM _workbook_imports WHERE source_key=?').get(sourceKey);
 if(prior){assert.equal(prior.source_hash,hash,'Source changed since prior import; review changes before re-importing');sql.exec('ROLLBACK');console.log('Already imported; no duplicate records created');process.exit(0)}
 const projects=new Map(),members=new Map();
 const existingMembers=(await call('members')).members;
 const names=[...new Set([...schedule.members.map(m=>canonical(m.name)),...availability.availability.map(a=>canonical(a.name))])].sort();
 for(const name of names){
  const matches=existingMembers.filter(m=>fold(canonical(m.name))===fold(name));assert.ok(matches.length<=1,'Multiple existing records for '+name);
  let m=matches[0];
  if(m){assert.ok(!m.archived,'Archived member requires review: '+name);await call('members/'+m.id,'PUT',{name,role:'both'});report.membersReused++}
  else{m=(await call('members','POST',{name,role:'both',companyId:''})).member;report.membersCreated++}
  members.set(fold(name),m.id);
 }
 const existingProjects=(await call('projects')).projects;
 for(const name of schedule.projects){
  const matches=existingProjects.filter(p=>fold(p.name)===fold(name));assert.ok(matches.length<=1,'Multiple projects named '+name);
  let p=matches[0];
  if(p){assert.ok(!p.archived,'Archived project requires review: '+name);report.projectsReused++}
  else{p=(await call('projects','POST',{name,pm:'Unassigned / 待分配',notes:''})).project;report.projectsCreated++}
  projects.set(fold(name),p.id);
  const pending=schedule.pending.filter(x=>fold(x.project)===fold(name));
  if(pending.length){const old=sql.prepare('SELECT notes FROM projects WHERE id=?').get(p.id).notes;const note='Import review · 10/5–10/11 / 导入待处理\n'+pending.map(x=>`${x.date} · ${x.name||'Unassigned / 待指定'} · Excel row ${x.row}: ${x.reason}`).join('\n');assert.ok((old+'\n'+note).length<=1500,'Project notes exceed limit');sql.prepare('UPDATE projects SET notes=? WHERE id=?').run([old,note].filter(Boolean).join('\n'),p.id)}
 }
 let room=(await call('rooms')).rooms.find(r=>r.name.trim().toUpperCase()==='N/A'&&!r.archived);
 if(!room)room=await call('rooms','POST',{name:'N/A'});
 // Whole-week latest submission replaces only this specific imported week, using the current revision.
 for(const a of availability.availability){
  if((availability.pendingAvailability||[]).some(p=>p.name===a.name))continue;
  const memberId=members.get(fold(canonical(a.name)));assert.ok(memberId);
  const old=await call(`availability?memberId=${memberId}&week=${a.week}`);
  await call('availability','PUT',{memberId,week:a.week,slots:a.slots,revision:old.revision,source:'admin'});
  const note=a.notes?`Imported availability / 导入的可用时间备注\n${a.notes}`:'';
  sql.prepare('UPDATE availability SET notes=? WHERE member_id=? AND week=?').run(note,memberId,a.week);
  const saved=await call(`availability?memberId=${memberId}&week=${a.week}`);assert.deepEqual(saved.slots,a.slots);report.availabilityImported++;
 }
 const savedEvents=[];
 for(const e of schedule.events){
  const assignments=e.assignments.map(a=>({memberId:members.get(fold(canonical(a.name))),role:a.role,start:a.start,end:a.end}));
  assert.ok(assignments.every(a=>a.memberId),'Missing member');assert.ok(e.notes.length<=3000,'Source notes would be truncated');
  const b={title:e.title,type:e.type,projectId:projects.get(fold(e.project)),roomId:room.id,start:e.start,end:e.end,roomStart:e.roomStart,roomEnd:e.roomEnd,assignments,notes:e.notes};
  let result;try{result=await call('events','POST',b)}catch(error){throw new Error(`Source rows ${e.sourceRows.join(',')}: ${error.message}`)}
  savedEvents.push({id:result.id,rows:e.sourceRows});report.eventsCreated++;report.assignments+=assignments.length;
  const persisted=sql.prepare('SELECT * FROM events WHERE id=?').get(result.id);assert.equal(persisted.start,epoch(e.start));assert.equal(persisted.end,epoch(e.end));assert.equal(persisted.room_id,room.id);
  const shifts=sql.prepare('SELECT * FROM assignments WHERE event_id=? ORDER BY rowid').all(result.id);assert.equal(shifts.length,assignments.length);
  shifts.forEach((s,i)=>{assert.equal(s.member_id,assignments[i].memberId);assert.equal(s.start,epoch(assignments[i].start));assert.equal(s.end,epoch(assignments[i].end))});
 }
 report.events=savedEvents;report.importedAt=new Date().toISOString();report.totalImportedMembers=names.length;
 sql.prepare('INSERT INTO _workbook_imports(source_key,source_hash,imported_at,report) VALUES(?,?,?,?)').run(sourceKey,hash,report.importedAt,JSON.stringify(report));
 assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
 sql.exec('COMMIT');fs.writeFileSync(path.join(root,path.basename(dbFile).startsWith('import-dryrun')?'import-dryrun-report.json':'week-import-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,events:undefined,pending:report.pending.length},null,2));
}catch(error){sql.exec('ROLLBACK');throw error}finally{sql.close()}
