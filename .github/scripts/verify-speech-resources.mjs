import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const lock=JSON.parse(fs.readFileSync(new URL('../../mobile/asr-resource-lock.json',import.meta.url),'utf8'));
export function base(kind){const item=lock[kind];if(!['asr','voice'].includes(kind)||!item||!/^[a-f0-9]{40}$/.test(item.revision))throw Error('Invalid speech resource lock');return 'https://huggingface.co/'+item.repository+'/resolve/'+item.revision+(item.subdirectory?'/'+item.subdirectory:'')}
export function verify(kind,directory){
  base(kind);const results=[];
  for(const [name,expected]of Object.entries(lock[kind].files)){
    if(path.basename(name)!==name||!/^[a-f0-9]{64}$/.test(expected.sha256))throw Error('Invalid resource identity');
    const bytes=fs.readFileSync(path.join(directory,name)),sha256=createHash('sha256').update(bytes).digest('hex');
    if(bytes.length!==expected.bytes||sha256!==expected.sha256)throw Error('Speech resource digest/length mismatch: '+name);
    results.push({name,bytes:bytes.length,sha256});
  }return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv[2]==='base')console.log(base(process.argv[3]));else console.log(JSON.stringify(verify(process.argv[2],process.argv[3])));
}
