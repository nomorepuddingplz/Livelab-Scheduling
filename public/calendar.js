export const blank=()=>Array.from({length:7},()=>Array(96).fill(0));
export const clone=x=>x.map(d=>[...d]);
export function parseDate(v){return new Date(v+'T00:00:00Z')}
export function plus(v,n){const d=parseDate(v);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function monday(v){const d=parseDate(v);return plus(v,-((d.getUTCDay()+6)%7))}
export function time(slot){if(slot===96)return '12:00 AM +1';const m=slot*15,h=Math.floor(m/60);return `${h%12||12}:${String(m%60).padStart(2,'0')} ${h<12?'AM':'PM'}`}
export function intervals(slots){const rows=[];slots.forEach((day,d)=>{let start=null;for(let i=0;i<=96;i++){if(day[i]===1&&start===null)start=i;if(day[i]!==1&&start!==null){rows.push({day:d,start,end:i});start=null}}});return rows}
const en=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],zh=['周一','周二','周三','周四','周五','周六','周日'];
export function calendar(el,{week,slots=blank(),availability=false,editable=false,zoom='normal',onZoom=()=>{},onChange=()=>{}}){
let value=clone(slots),drag=null;el.innerHTML=`<div class="calendar-scale"><label><span class="bi"><span>Calendar zoom</span><small>日历缩放</small></span><select aria-label="Calendar zoom / 日历缩放">${[['fit','Fit 24 hours / 全日总览'],['compact','Compact / 缩小'],['normal','Standard / 标准'],['large','Large / 放大']].map(([v,label])=>`<option value="${v}" ${zoom===v?'selected':''}>${label}</option>`).join('')}</select></label><span class="bi"><span>15-minute precision at every zoom</span><small>任何缩放比例下均按 15 分钟框选</small></span></div><div class="calendar-scroll"><div class="calendar-grid"><div class="calendar-head time-head">LA<small>洛杉矶</small></div>${en.map((d,i)=>{const date=parseDate(plus(week,i));return `<div class="calendar-head${i>4?' weekend':''}"><span>${d}<small>${zh[i]}</small></span><strong>${date.getUTCMonth()+1}/${date.getUTCDate()}</strong></div>`}).join('')}<div class="time-axis">${Array.from({length:24},(_,h)=>`<span data-hour="${h}" style="top:calc(${h*4} * var(--slot-height))">${h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':h-12+' PM'}</span>`).join('')}<span class="end-time">12 AM</span></div>${en.map((d,i)=>`<div class="day-column${availability?' availability-column':''}${editable?' editable':''}" data-day="${i}" aria-label="${d} ${plus(week,i)}">${Array.from({length:96},(_,s)=>`<div class="slot${availability&&value[i][s]?' available':''}" data-slot="${s}"></div>`).join('')}</div>`).join('')}</div></div>`;
const cols=[...el.querySelectorAll('.day-column')];function paint(){cols.forEach((col,d)=>[...col.querySelectorAll('.slot')].forEach((cell,s)=>cell.classList.toggle('available',availability&&value[d][s]===1)))}
function point(event){const rect=cols[0].getBoundingClientRect();const last=cols[6].getBoundingClientRect();return {day:Math.max(0,Math.min(6,Math.floor((event.clientX-rect.left)/((last.right-rect.left)/7)))),slot:Math.max(0,Math.min(95,Math.floor((event.clientY-rect.top)/(rect.height/96))))}}
function update(event){if(!drag)return;const to=point(event);value=clone(drag.before);for(let d=Math.min(drag.day,to.day);d<=Math.max(drag.day,to.day);d++)for(let s=Math.min(drag.slot,to.slot);s<=Math.max(drag.slot,to.slot);s++)value[d][s]=drag.fill;paint()}
if(editable){cols.forEach(col=>col.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('.event-block'))return;event.preventDefault();const p=point(event);drag={...p,fill:value[p.day][p.slot]?0:1,before:clone(value)};col.setPointerCapture(event.pointerId);update(event)}));el.addEventListener('pointermove',update);el.addEventListener('pointerup',event=>{if(!drag)return;update(event);drag=null;onChange(clone(value))});el.addEventListener('pointercancel',()=>{if(drag){value=clone(drag.before);paint();drag=null}})}
const scroll=el.querySelector('.calendar-scroll'),select=el.querySelector('.calendar-scale select');
function scale(initial=false){const old=cols[0].getBoundingClientRect().height/96||14,top=scroll.scrollTop/old,head=el.querySelector('.calendar-head').offsetHeight;const size=zoom==='fit'?Math.max(2,(scroll.clientHeight-head-2)/96):zoom==='compact'?7:zoom==='large'?22:14;el.style.setProperty('--slot-height',size+'px');el.dataset.zoom=zoom;scroll.scrollTop=zoom==='fit'?0:(initial?32:top)*size}
select.onchange=()=>{zoom=select.value;scale();onZoom(zoom)};scale(true);
const observer=new ResizeObserver(()=>{if(zoom==='fit'&&el.isConnected)scale()});observer.observe(scroll);

return {destroy(){observer.disconnect()},set(next){value=clone(next);paint()},get(){return clone(value)}}

}
// Event drag endpoints snap to quarter-hour boundaries; an exact 10:00 endpoint
// must not include the 10:00–10:15 slot. Reverse and overnight drags use the same rule.
export function eventSelectionRange(anchor,endpoint){const a=Math.max(0,Math.min(671,Math.floor(anchor))),b=Math.max(0,Math.min(672,Math.round(endpoint)));return b===a?{start:a,end:a+1}:{start:Math.min(a,b),end:Math.max(a,b)}}
