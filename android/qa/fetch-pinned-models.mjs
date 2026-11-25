/** CI-only source provisioner: remote model/AAR bytes MUST pass recorded SHA256. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {base,lock} from '../../.github/scripts/verify-speech-resources.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const entryDir=path.join(root,'android/app/src/main/assets/sherpa-onnx-streaming-zipformer-en-2023-06-26');
const timeout=120000;
async function pinnedDownload(url,destination,sha256,bytes){
  const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw Error('Network dependency failed HTTP '+response.status+': '+new URL(url).pathname);
  const data=new Uint8Array(await response.arrayBuffer());
  const digest=createHash('sha256').update(data).digest('hex');
  if((bytes!==undefined&&data.length!==bytes)||digest!==sha256)throw Error('Pinned dependency integrity mismatch: '+path.basename(destination));
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination+'.download-verified',data,{flag:'wx'});
  await fs.rename(destination+'.download-verified',destination);
  console.log('Verified',path.basename(destination),data.length);
}
await pinnedDownload('https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar',
 path.join(root,'android/app/libs/sherpa-onnx-1.13.8.aar'),
 '633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96');
for(const [name,info]of Object.entries(lock.asr.files)){
 if(path.basename(name)!==name)throw Error('Unsafe model filename');
 await pinnedDownload(base('asr')+'/'+encodeURIComponent(name),path.join(entryDir,name),info.sha256,info.bytes);
}
console.log('All original locked model files present. bpe.vocab must be deterministically generated from the verified bpe.model.');
