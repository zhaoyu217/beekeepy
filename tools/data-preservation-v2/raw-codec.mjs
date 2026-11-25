/** Read-only archival codec. Never pass data through app.state/save/normalizers.
 * Version 0 is deliberately NOT the approved BKPTREE 1M protocol.
 */
const own=Object.prototype.hasOwnProperty;
const b64 = bytes => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
  let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s);
};
const unb64 = s => {
  if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
};
export {b64,unb64};
const plainObject=o=>{const p=Object.getPrototypeOf(o);return p===Object.prototype||p===null};
export async function encodeRaw(value,visited=new WeakSet()) {
  if(value===undefined)return {$bk:'undefined'};
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:{$bk:'number',value:String(value)};
  if(typeof value==='bigint')return {$bk:'bigint',value:String(value)};
  if(typeof value==='function'||typeof value==='symbol')throw Error('unsupported_storage_type');
  if(visited.has(value))throw Error('cyclic_value_requires_review');
  visited.add(value);
  try {
    if(value instanceof Date)return {$bk:'date',value:value.toISOString()};
    if(value instanceof ArrayBuffer)return {$bk:'arraybuffer',base64:b64(value)};
    if(ArrayBuffer.isView(value))return {$bk:'view',type:value.constructor.name,base64:b64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
    if(typeof Blob!=='undefined'&&value instanceof Blob)return {$bk:'blob',type:value.type,base64:b64(await value.arrayBuffer())};
    if(Array.isArray(value)){const out=[];for(const x of value)out.push(await encodeRaw(x,visited));return {$bk:'array',items:out};}
    if(value instanceof Map){const out=[];for(const [k,v] of value)out.push([await encodeRaw(k,visited),await encodeRaw(v,visited)]);return {$bk:'map',entries:out};}
    if(value instanceof Set){const out=[];for(const v of value)out.push(await encodeRaw(v,visited));return {$bk:'set',items:out};}
    if(!plainObject(value))throw Error('unknown_structured_clone_type');
    const out=Object.create(null);
    for(const k of Object.keys(value)){
      const d=Object.getOwnPropertyDescriptor(value,k);
      if(!d||!own.call(d,'value'))throw Error('accessor_property_disallowed');
      out[k]=await encodeRaw(d.value,visited);
    }
    return {$bk:'object',props:out};
  } finally {visited.delete(value);}
}
export async function sha256(bytes,cryptoProvider=globalThis.crypto){
  if(!cryptoProvider?.subtle)throw Error('webcrypto_unavailable');
  const h=new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes));
  return [...h].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export const utf8=s=>new TextEncoder().encode(s);
