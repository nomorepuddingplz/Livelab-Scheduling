import {test} from 'node:test';import assert from 'node:assert/strict';
import {memberScheduleSheets,workbookBytes} from '../public/excel.js';
import JSZip from '../public/vendor/jszip.js';import {epoch} from '../src/time.mjs';
const people=[{id:'a',name:'Alice',companyId:'00123',role:'host'},{id:'b',name:'Bob',companyId:'009',role:'moderator'},{id:'c',name:'Casey',companyId:'010',role:'both'},{id:'d',name:'Dana',companyId:'',role:'host'}];
const shift=(id,role,start,end)=>({member_id:id,role,start:epoch(start),end:epoch(end)});
const event=(title,assignments)=>({title,type:'live',project_name:'Project',room_name:'Room',notes:'',assignments});
const events=[event('Evening',[shift('a','host','2026-10-05T18:00','2026-10-05T20:00')]),event('Morning',[shift('a','host','2026-10-05T09:00','2026-10-05T10:00'),shift('b','moderator','2026-10-05T08:45','2026-10-05T10:15')]),event('Night',[shift('c','host','2026-10-04T23:00','2026-10-05T01:00'),shift('c','moderator','2026-10-06T09:00','2026-10-06T11:00')]),event('Outside week',[shift('a','host','2026-10-12T09:00','2026-10-12T10:00')])];
test('weekly member export groups roles and people and retains actual participation hours',async()=>{
 const sheet=memberScheduleSheets({members:people,events,week:'2026-10-05'})[0];const {rows}=sheet;
 const host=rows.findIndex(r=>r[0]==='Hosts / 主播'),mod=rows.findIndex(r=>r[0]==='Moderators / 场控');assert.ok(host<mod);
 const alice=rows.findIndex(r=>String(r[0]).startsWith('Alice   '));assert.equal(rows[alice+1][0],'Morning');assert.equal(rows[alice+2][0],'Evening');assert.equal(rows[alice+1][7],'00123');assert.ok(!rows.some(r=>r[0]==='Outside week'));
 const bob=rows.findIndex(r=>String(r[0]).startsWith('Bob   '));assert.ok(bob>mod);assert.equal(rows[bob+1][3].toISOString(),'2026-10-05T08:45:00.000Z');assert.equal(rows[bob+1][5],1.5);
 assert.equal(rows.filter(r=>String(r[0]).startsWith('Casey   ')).length,2);assert.equal(rows.find(r=>r[0]==='Night')[3].toISOString(),'2026-10-04T23:00:00.000Z');assert.ok(rows.some(r=>r[0]==='No events this week / 本周暂无活动'));
 const bytes=await workbookBytes([sheet]),zip=await JSZip.loadAsync(bytes);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/ySplit="4"/);assert.ok(!xml.includes('<autoFilter'));assert.match(xml,/<mergeCells/);assert.match(xml,/<c r="H\d+" t="inlineStr" s="0"><is><t xml:space="preserve">00123<\/t>/);assert.match(xml,/s="3"><v>/);
});
test('role filter, empty weeks and 100+ members retain explicit headings without duplicating shifts',()=>{
 const one=memberScheduleSheets({members:people,events,week:'2026-10-05',roleFilter:'moderator'})[0];assert.ok(!one.rows.some(r=>r[0]==='Hosts / 主播'));assert.equal(one.rows.filter(r=>r[0]==='Night').length,1);
 const many=Array.from({length:120},(_,i)=>({id:String(i),name:'Host '+i,role:'host'}));const empty=memberScheduleSheets({members:many,events:[],week:'2026-10-05'})[0];assert.equal(empty.rows.filter(r=>r[0]==='No events this week / 本周暂无活动').length,120);
});

test('cancelled Excel rows use grey styles for text, hours and dates',async()=>{const bytes=await workbookBytes([{name:'Cancelled',rows:[['Event','Hours','Start'],['Cancelled',0,new Date('2026-10-05T09:00Z')]],rowStyles:{1:8}}]);const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/<c r="A2" t="inlineStr" s="8">/);assert.match(xml,/<c r="B2" s="9">/);assert.match(xml,/<c r="C2" s="10">/)});

test('cancelled member rows retain original hours, IDs and status while deleted events are excluded',async()=>{
 const original={...events[1],cancelled:1,cancel_kind:'within_24h'};const deleted={...events[0],deleted:1};const sheet=memberScheduleSheets({members:people,events:[original,deleted],week:'2026-10-05'})[0];
 const hostRow=sheet.rows.findIndex(r=>r[0]==='Morning'&&r[7]==='00123'),modRow=sheet.rows.findIndex(r=>r[0]==='Morning'&&r[7]==='009');assert.ok(hostRow>0&&modRow>0);assert.equal(sheet.rows[hostRow][5],1);assert.equal(sheet.rows[modRow][5],1.5);assert.match(sheet.rows[hostRow][9],/within 24h/);assert.equal(sheet.rowStyles[hostRow],8);assert.equal(sheet.rowStyles[modRow],8);assert.ok(!sheet.rows.some(r=>r[0]==='Evening'));
 const zip=await JSZip.loadAsync(await workbookBytes([sheet]));const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/within 24h/);assert.match(xml,/<c r="F\d+" s="9"><v>1.5<\/v>/);
 const legacy=memberScheduleSheets({members:people,events:[{...original,cancel_kind:''}],week:'2026-10-05'})[0];assert.equal(legacy.rows.find(r=>r[0]==='Morning')[9],'Cancelled / 已取消');
});
