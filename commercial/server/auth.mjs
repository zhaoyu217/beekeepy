import {scryptSync,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {sha256} from './db.mjs';

export function encodeAdminPassword(password, salt=randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${scryptSync(password,Buffer.from(salt,'hex'),32).toString('hex')}`;
}
export function checkAdminPassword(password, encoded) {
  if(typeof password!=='string'||password.length>1024) return false;
  const match=/^scrypt\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded||'');
  if(!match)return false;
  const actual=scryptSync(password,Buffer.from(match[1],'hex'),32);
  return timingSafeEqual(actual,Buffer.from(match[2],'hex'));
}
export function decodeBase32(input){
  const clean=(input||'').replace(/\s/g,'').replace(/=+$/,'').toUpperCase();
  if(!/^[A-Z2-7]{16,}$/.test(clean))throw Error('Invalid base32 secret');
  let bits=0,num=0;const out=[];
  for(const char of clean){num=(num<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);bits+=5;if(bits>=8){bits-=8;out.push((num>>bits)&255);}}
  return Buffer.from(out);
}
export function totpAt(secret,step,digits=6) {
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const h=createHmac('sha1',decodeBase32(secret)).update(counter).digest();
  const offset=h[19]&15;
  const code=(h.readUInt32BE(offset)&0x7fffffff)%(10**digits);
  return String(code).padStart(digits,'0');
}
export function verifyTotp(store,code,secret,clock=Date.now()) {
  if(!/^\d{6}$/.test(String(code||'')))return false;
  const current=Math.floor(clock/30000);
  const last=Number(store.get("SELECT value FROM system_control WHERE key='admin_totp_step'")?.value||-1);
  for(let step=current-1;step<=current+1;step++){
    if(step<=last)continue;
    if(totpAt(secret,step)===code){
      store.sql("INSERT INTO system_control VALUES ('admin_totp_step',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(step));
      return true;
    }
  }
  return false;
}
export function createSession(store, clock=Date.now()) {
  const token=randomBytes(32).toString('base64url');
  const csrf=randomBytes(32).toString('base64url');
  store.sql('INSERT INTO admin_session VALUES (?,?,?,?)',sha256(token),sha256(csrf),clock+4*3600*1000,store.now());
  return {token,csrf,expiresAt:clock+4*3600*1000};
}
export function validateSession(store,token,csrf=null,clock=Date.now()) {
  if(typeof token!=='string'||token.length>128)return false;
  const record=store.get('SELECT * FROM admin_session WHERE token_hash=?',sha256(token));
  if(!record||record.expires_at<=clock)return false;
  if(csrf!==null && (typeof csrf!=='string'||!timingSafeEqual(Buffer.from(record.csrf_hash),Buffer.from(sha256(csrf)))))return false;
  return true;
}
export async function verifySupabaseAccessToken(token,{url,key,fetcher=fetch}={}) {
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||'')||!key||!token||token.length>10000)return null;
  try {
    const resp=await fetcher(url.replace(/\/$/,'')+'/auth/v1/user',{
      headers:{apikey:key,authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)
    });
    if(!resp.ok)return null;
    const user=await resp.json();
    if(!/^[\w-]{5,128}$/.test(user?.id||''))return null;
    return {id:user.id,email:user.email||''};
  }catch{return null;}
}
