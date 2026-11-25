import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const problems=[];
const file=rel=>path.join(root,rel);
const has=rel=>fs.existsSync(file(rel));
const text=rel=>fs.readFileSync(file(rel),'utf8');
const required=['android/build.gradle','android/settings.gradle','android/app/build.gradle','android/app/src/main/AndroidManifest.xml','android/app/src/main/java/app/hivefield/mobile/MainActivity.java','android/app/src/main/java/app/hivefield/mobile/OfflineAsrPlugin.kt','android/app/src/main/java/app/hivefield/mobile/DeviceFilesPlugin.kt'];
for(const rel of required)if(!has(rel))problems.push(`missing source: ${rel}`);
// Accept a Gradle wrapper JAR OR a verified pinned system Gradle binary (CI).
if(!has('android/gradle/wrapper/gradle-wrapper.jar')){
  const gradle=spawnSync('gradle',['--version'],{encoding:'utf8',timeout:30000});
  if(gradle.status!==0||!/Gradle 8\.14\.3\b/.test(gradle.stdout||''))
    problems.push('Gradle wrapper jar absent and pinned installed Gradle 8.14.3 unavailable');
}
for(const rel of ['node_modules/@capacitor/android/capacitor/build.gradle','mobile/dist/index.html','mobile/dist/vendor/supabase.min.js'])if(!has(rel))problems.push(`dependency/asset missing: ${rel}`);
const aar='android/app/libs/sherpa-onnx-1.13.8.aar';
if(!has(aar))problems.push(`missing pinned AAR: ${aar}`);
else if(createHash('sha256').update(fs.readFileSync(file(aar))).digest('hex')!=='633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96')problems.push('AAR SHA256 mismatch');
if(has('mobile/asr-resource-lock.json')){
  const lock=JSON.parse(text('mobile/asr-resource-lock.json'));
  const base='android/app/src/main/assets/sherpa-onnx-streaming-zipformer-en-2023-06-26';
  for(const [name,meta] of Object.entries(lock.asr.files)){
    const rel=base+'/'+name;
    if(!has(rel)){problems.push(`missing model asset: ${name}`);continue;}
    if(fs.statSync(file(rel)).size!==meta.bytes||createHash('sha256').update(fs.readFileSync(file(rel))).digest('hex')!==meta.sha256)problems.push(`model asset mismatch: ${name}`);
  }
}
const hotwords='android/app/src/main/assets/public/mobile-hotwords.txt';
if(!has(hotwords))problems.push('missing bundled hotwords');
if(has('android/app/src/main/java/app/hivefield/mobile/MainActivity.java')){
 const c=text('android/app/src/main/java/app/hivefield/mobile/MainActivity.java');
 if(!c.includes('registerPlugin(OfflineAsrPlugin.class)')||!c.includes('registerPlugin(DeviceFilesPlugin.class)'))problems.push('native plugin registration incomplete');
}
if(problems.length){console.error('Android build BLOCKED:\n'+problems.map(x=>' - '+x).join('\n'));process.exitCode=1;}
else console.log('Android source and pinned artifacts preflight: PASS; native compilation still required');
