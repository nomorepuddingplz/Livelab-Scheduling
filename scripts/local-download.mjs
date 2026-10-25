import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Only the loopback preview uses this adapter; hosted sites keep normal downloads.
export function localDownloadWriter(directory=path.join(os.homedir(),'Downloads','LiveLab Exports')) {
 return async (filename,bytes)=>{
  if(filename!==path.basename(filename)||filename.startsWith('.')||!/^.+\.(xlsx|csv|png)$/i.test(filename))throw new Error('invalid_download_filename');
  await fs.mkdir(directory,{recursive:true});
  const ext=path.extname(filename),stem=filename.slice(0,-ext.length);
  for(let n=0;n<10000;n++){
   const savedName=n?`${stem} (${n})${ext}`:filename,savedPath=path.join(directory,savedName);
   let handle;try{handle=await fs.open(savedPath,'wx',0o600)}catch(e){if(e.code==='EEXIST')continue;throw e}
   try{await handle.writeFile(bytes);await handle.sync();await handle.close();return {savedLocally:true,savedName,savedPath,folder:directory}}
   catch(e){await handle.close().catch(()=>{});await fs.unlink(savedPath).catch(()=>{});throw e}
  }
  throw new Error('download_filename_limit');
 };
}
