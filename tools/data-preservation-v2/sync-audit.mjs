/** Non-mutating preflight for comparing raw local/cloud sync snapshots.
 * This does not replace the existing sync-v2 bridge / SQL CAS protocol.
 * No automatic merge, no writes, no receipt replay.
 */
import {sha256,utf8} from './raw-codec.mjs';
const present=o=>o!==null&&o!==undefined;
export async function auditSyncSnapshots({userId,localRaw,remoteRaw,baseRaw,localAccountId,remoteAccountId,cryptoProvider=globalThis.crypto}={}){
  if(!userId||localAccountId!==userId||remoteAccountId!==userId)return {status:'BLOCKED',reason:'account_identity_mismatch'};
  if(!present(localRaw)||!present(remoteRaw))return {status:'BLOCKED',reason:'missing_snapshot_is_not_empty'};
  if(typeof localRaw!=='string'||typeof remoteRaw!=='string')return {status:'BLOCKED',reason:'raw_bytes_required'};
  // A cloud body must not be parsed, normalized or written to local storage as part of audit.
  const [l,r]=await Promise.all([sha256(utf8(localRaw),cryptoProvider),sha256(utf8(remoteRaw),cryptoProvider)]);
  if(l===r)return {status:'MATCH',hash:l,writeAllowed:false};
  if(!present(baseRaw)||typeof baseRaw!=='string')return {status:'CONFLICT',reason:'no_proven_common_base',localHash:l,remoteHash:r,writeAllowed:false};
  const b=await sha256(utf8(baseRaw),cryptoProvider);
  if(l===b)return {status:'REMOTE_UPDATED',reason:'requires_original_sync_v2_CAS_and_manual_gate',localHash:l,remoteHash:r,baseHash:b,writeAllowed:false};
  if(r===b)return {status:'LOCAL_UPDATED',reason:'requires_original_sync_v2_CAS_and_manual_gate',localHash:l,remoteHash:r,baseHash:b,writeAllowed:false};
  return {status:'CONFLICT',reason:'both_sides_changed',localHash:l,remoteHash:r,baseHash:b,writeAllowed:false};
}
