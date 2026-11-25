/** Experimental Beekeepy raw-evidence capsule. NOT the frozen V2 suite 0x0001.
 * Never uploads, modifies, migrates, or restores live user data.
 */
import {b64,unb64,utf8,sha256,encodeRaw} from './raw-codec.mjs';
export const format='beekeepy-raw-preservation-candidate-v0';
const MAX_BYTES=16*1024*1024;
const ITERATIONS=600000;
const owned=Object.prototype.hasOwnProperty;
const check=(cond,msg)=>{if(!cond)throw Error(msg)};
export async function assembleSnapshot({origin,sourceId,localRecords=[],databaseRecords=[],issues=[]},cryptoProvider=globalThis.crypto){
  check(typeof origin==='string'&&origin.length>0&&origin.length<1000,'origin_required');
  check(typeof sourceId==='string'&&sourceId.length>0&&sourceId.length<300,'source_identity_required');
  const entries=[];const ids=new Set();
  for(const r of [...localRecords,...databaseRecords]){
    check(r&&['localStorage','indexedDB'].includes(r.surface),'unknown_surface');
    check(typeof r.location==='string'&&r.location.length>0,'location_required');
    check(typeof r.key!=='function','bad_key');
    const payload=await encodeRaw(r.value);
    const k=await encodeRaw(r.key);
    const identity=JSON.stringify([r.surface,r.location,k]);
    check(!ids.has(identity),'duplicate_record_identity');ids.add(identity);
    const bytes=utf8(JSON.stringify(payload));
    check(bytes.byteLength<=MAX_BYTES,'single_record_exceeds_limit');
    entries.push({surface:r.surface,location:r.location,key:k,payload,payloadSha256:await sha256(bytes,cryptoProvider)});
  }
  check(issues.every(x=>x&&typeof x.code==='string'),'malformed_capture_issue');
  // A capture with gaps is NOT a restorable archive. Explicit metadata only.
  return {format,version:0,createdAt:new Date().toISOString(),source:{origin,sourceId},coverage:{complete:issues.length===0,issues:[...issues],recordCount:entries.length,atomicAcrossStores:false},entries};
}
async function derive(passphrase,salt,cryptoProvider){
  const base=await cryptoProvider.subtle.importKey('raw',utf8(passphrase),'PBKDF2',false,['deriveKey']);
  return cryptoProvider.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptSnapshot(snapshot,passphrase,cryptoProvider=globalThis.crypto){
  check(snapshot?.format===format&&snapshot.coverage?.complete===true,'incomplete_capture_cannot_be_sealed');
  check(typeof passphrase==='string'&&passphrase.length>=12,'passphrase_minimum_12_characters');
  check(cryptoProvider?.subtle&&cryptoProvider.getRandomValues,'crypto_unavailable');
  const plain=utf8(JSON.stringify(snapshot));check(plain.length<=MAX_BYTES,'archive_exceeds_memory_budget');
  const salt=cryptoProvider.getRandomValues(new Uint8Array(16));
  const iv=cryptoProvider.getRandomValues(new Uint8Array(12));
  const key=await derive(passphrase,salt,cryptoProvider);
  const encrypted=await cryptoProvider.subtle.encrypt({name:'AES-GCM',iv},key,plain);
  return {format,version:0,kdf:{name:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt)},cipher:{name:'AES-256-GCM',iv:b64(iv)},ciphertext:b64(encrypted)};
}
export async function verifySnapshot(snapshot,cryptoProvider=globalThis.crypto){
  check(snapshot?.format===format&&snapshot.version===0,'format_unknown');
  check(snapshot?.coverage?.complete===true,'capture_incomplete');
  check(snapshot?.source?.origin&&snapshot.source?.sourceId,'source_identity_missing');
  check(Array.isArray(snapshot.entries)&&snapshot.entries.length===snapshot.coverage.recordCount,'record_count_mismatch');
  const ids=new Set();
  for(const entry of snapshot.entries){
    const id=JSON.stringify([entry.surface,entry.location,entry.key]);
    check(!ids.has(id),'duplicate_record_identity');ids.add(id);
    check(/^[0-9a-f]{64}$/.test(entry.payloadSha256),'invalid_digest');
    const actual=await sha256(utf8(JSON.stringify(entry.payload)),cryptoProvider);
    check(actual===entry.payloadSha256,'payload_digest_mismatch');
  }
  return {verified:true,recordCount:snapshot.entries.length,source:snapshot.source,atomicAcrossStores:false};
}
export async function decryptAndVerify(envelope,passphrase,cryptoProvider=globalThis.crypto){
  check(typeof passphrase==='string'&&passphrase.length>0,'passphrase_required');
  check(envelope?.format===format&&envelope?.version===0,'format_unknown');
  check(envelope?.kdf?.name==='PBKDF2-SHA256'&&envelope.kdf.iterations===ITERATIONS,'kdf_parameters_invalid');
  check(envelope?.cipher?.name==='AES-256-GCM','cipher_invalid');
  const salt=unb64(envelope.kdf.salt),iv=unb64(envelope.cipher.iv),encrypted=unb64(envelope.ciphertext||'');
  check(salt.length===16&&iv.length===12&&encrypted.length>16&&encrypted.length<=MAX_BYTES+16,'archive_header_invalid');
  const key=await derive(passphrase,salt,cryptoProvider);
  let decrypted;
  try{decrypted=await cryptoProvider.subtle.decrypt({name:'AES-GCM',iv},key,encrypted);}
  catch{throw Error('authentication_failed_or_archive_tampered');}
  const snapshot=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decrypted));
  await verifySnapshot(snapshot,cryptoProvider);
  return snapshot; // caller must not pass records to live app persistence
}
