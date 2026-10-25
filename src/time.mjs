const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function wall(ms){const p=Object.fromEntries(formatter.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}
export function epoch(s){if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:[0-5]\d$/.test(s))throw new Error('invalid_time');const naive=Date.parse(s+'Z');const matches=[7,8].map(offset=>naive+offset*3600000).filter(ms=>wall(ms)===s);if(!matches.length)throw new Error('invalid_time');return Math.min(...matches)}
export function weekOf(date){const d=new Date(date.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export function plusDate(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
