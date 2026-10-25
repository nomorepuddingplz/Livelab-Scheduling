import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventHostNames,projectOverlayItems} from '../public/schedule-tools.js';
test('calendar host labels follow shift order, deduplicate split shifts, and exclude moderators',()=>{
 const e={assignments:[{member_id:'b',member_name:'Max',role:'host',start:3},{member_id:'a',member_name:'Joseph',role:'host',start:1},{member_id:'a',member_name:'Joseph',role:'host',start:4},{member_id:'c',member_name:'Juan',role:'moderator',start:0}]};
 assert.deepEqual(eventHostNames(e),['Joseph','Max']);assert.deepEqual(eventHostNames({}),[]);
});
test('multiple project overlays omit an already visible event without affecting base schedules',()=>{
 const a={id:'a',project_id:'p1',start:1,end:4},b={id:'b',project_id:'p2',start:2,end:3},c={id:'c',project_id:'p3',start:4,end:7};
 const items=[{event:a,start:1,end:4}];
 assert.deepEqual(projectOverlayItems([a,b,c],items,['p1','p2','p3']).map(i=>i.event.id),['b','c']);
 assert.equal(items.length,1);assert.deepEqual(projectOverlayItems([a,b,c],items,[]),[]);
 // A member's shorter shift can still show the entire project event behind it.
 assert.equal(projectOverlayItems([a],[{event:a,start:2,end:3}],['p1']).length,1);
});
