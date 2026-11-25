/** Explicit, read-only browser inventory. Never invokes legacy app save/state.
 * Missing/blocked scopes are errors: they are not interpreted as empty stores.
 */
export const suggestedScope=Object.freeze({
  localStorageKeys:['hivedash_v9'],
  indexedDBNames:['hivedash_phase1','beekeepy_sync_v2']
});
const issue=(code,location)=>({code,location});
export async function collectBrowserRaw({localStorage=globalThis.localStorage,indexedDB=globalThis.indexedDB,origin=globalThis.location?.origin,localStorageKeys,indexedDBNames}={}){
  if(!Array.isArray(localStorageKeys)||!Array.isArray(indexedDBNames))throw Error('explicit_scope_required');
  const issues=[],localRecords=[],databaseRecords=[],schema=[];
  if(!origin)throw Error('origin_required');
  for(const key of localStorageKeys){
    try{
      const first=localStorage.getItem(key);
      if(first===null){issues.push(issue('MISSING_LOCAL_STORAGE_KEY',key));continue;}
      localRecords.push({surface:'localStorage',location:'localStorage',key,value:first});
    }catch{issues.push(issue('LOCAL_STORAGE_UNAVAILABLE',key));}
  }
  if(indexedDBNames.length){
    if(!indexedDB||typeof indexedDB.databases!=='function'){
      for(const name of indexedDBNames)issues.push(issue('IDB_INVENTORY_UNAVAILABLE',name));
    }else{
      let listed;
      try{listed=await indexedDB.databases();}catch{listed=null;}
      if(!listed){for(const name of indexedDBNames)issues.push(issue('IDB_INVENTORY_FAILED',name));}
      else for(const name of indexedDBNames){
        if(!listed.some(d=>d.name===name)){issues.push(issue('MISSING_IDB_DATABASE',name));continue;}
        try{
          const info=await inspectDatabase(indexedDB,name);
          schema.push(info.schema);databaseRecords.push(...info.records);
        }catch{issues.push(issue('IDB_READ_FAILED',name));}
      }
    }
  }
  // Local keys may have changed during cross-store traversal. Never certify as atomic.
  for(const item of localRecords){
    try{if(localStorage.getItem(item.key)!==item.value)issues.push(issue('LOCAL_STORAGE_CHANGED_DURING_READ',item.key));}
    catch{issues.push(issue('LOCAL_STORAGE_RECHECK_FAILED',item.key));}
  }
  return {origin,sourceId:'browser-origin:'+origin,localRecords,databaseRecords,schema,issues};
}
async function inspectDatabase(indexedDB,name){
  const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open(name);
    req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('database_disappeared_during_scan'));};
    req.onerror=()=>reject(req.error||Error('db_open_failed'));
    req.onblocked=()=>reject(Error('db_open_blocked'));
    req.onsuccess=()=>resolve(req.result);
  });
  try {
    const names=Array.from(db.objectStoreNames),records=[],stores=[];
    // Each store uses one read-only transaction to preserve cursor keys and values.
    for(const storeName of names){
      const {storeInfo,rows}=await new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,'readonly');const store=tx.objectStore(storeName);const rows=[];
        const storeInfo={name:storeName,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:Array.from(store.indexNames).map(n=>{
          const i=store.index(n);return{name:n,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};
        })};
        const request=store.openCursor();
        request.onerror=()=>reject(request.error||Error('cursor_failed'));
        request.onsuccess=()=>{const c=request.result;if(!c)return;rows.push({surface:'indexedDB',location:name+'/'+storeName,key:c.primaryKey,value:c.value});c.continue();};
        tx.oncomplete=()=>resolve({storeInfo,rows});tx.onerror=()=>reject(tx.error||Error('idb_transaction_failed'));
        tx.onabort=()=>reject(tx.error||Error('idb_transaction_aborted'));
      });
      stores.push(storeInfo);records.push(...rows);
    }
    return {schema:{name,version:db.version,stores},records};
  }finally{db.close();}
}
