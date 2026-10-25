// Short-lived attachment URLs support embedded browsers and explicit retries.
const types={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv;charset=utf-8',png:'image/png'};
const error=(error,status=400)=>Response.json({error},{status});
function attachment(filename,data){const ext=filename.split('.').pop().toLowerCase(),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),ascii=filename.replace(/[^\x20-\x7e]/g,'_');return new Response(bytes,{headers:{'Content-Type':types[ext],'Content-Length':String(bytes.length),'Content-Disposition':`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
export async function fileDownload(req,db,saveLocal){
 const pathname=new URL(req.url).pathname;
 if(req.method==='GET'){
  const token=pathname.split('/')[3];if(!/^[a-f0-9-]{36}$/.test(token||''))return error('download_expired',404);
  const row=await db.prepare('SELECT filename,data FROM download_files WHERE token=? AND expires_at>?').bind(token,Date.now()).first();
  return row?attachment(row.filename,row.data):error('download_expired',404);
 }
 const json=req.headers.get('content-type')?.startsWith('application/json'),form=req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded');if(!json&&!form)return error('invalid_download',415);
 const raw=await req.text();if(raw.length>28000000)return error('download_too_large',413);
 let body;try{body=json?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw))}catch{return error('invalid_download')}
 const original=body.filename||'',encoded=body.data||'';if(typeof original!=='string'||typeof encoded!=='string')return error('invalid_download');const ext=original.split('.').pop()?.toLowerCase();
 if(!types[ext]||!encoded||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return error('invalid_download');
 let bytes;try{bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))}catch{return error('invalid_download')}
 if((ext==='xlsx'&&(bytes[0]!==80||bytes[1]!==75))||(ext==='png'&&(bytes[0]!==137||bytes[1]!==80)))return error('invalid_download');
 const filename=original.replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g,'-').slice(0,170).replace(/\.(xlsx|csv|png)$/i,'')+'.'+ext;
 if(form)return attachment(filename,encoded); // Support already-open older tabs.
 const token=crypto.randomUUID(),expires=Date.now()+300000;
 await db.batch([db.prepare('DELETE FROM download_files WHERE expires_at<=?').bind(Date.now()),db.prepare('INSERT INTO download_files(token,filename,data,expires_at) VALUES(?,?,?,?)').bind(token,filename,encoded,expires)]);
 let saved={};if(saveLocal){try{saved=await saveLocal(filename,bytes)}catch{return error('download_save_failed',500)}}
 return Response.json({...saved,url:'/api/download/'+token+'/'+encodeURIComponent(filename),filename,expiresAt:expires},{status:201,headers:{'Cache-Control':'no-store'}});
}
