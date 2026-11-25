import {collectBrowserRaw,suggestedScope} from './browser-source.mjs';
import {assembleSnapshot,encryptSnapshot} from './archive.mjs';
const form=document.getElementById('capture');const status=document.getElementById('status'),issues=document.getElementById('issues');
document.getElementById('origin').textContent=location.origin;
form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button');button.disabled=true;issues.textContent='';status.textContent='只读检查中…';
  try{
    if(!crypto?.subtle)throw Error('HTTPS/localhost 安全上下文不可用');
    const sourceId=document.getElementById('source').value;
    const passphrase=document.getElementById('passphrase').value;
    const raw=await collectBrowserRaw({...suggestedScope,origin:location.origin});
    const snapshot=await assembleSnapshot({...raw,sourceId});
    if(!snapshot.coverage.complete){issues.textContent=JSON.stringify(snapshot.coverage.issues,null,2);throw Error('存在未覆盖项，禁止标记为完整备份');}
    const envelope=await encryptSnapshot(snapshot,passphrase);
    // No data transmission or localStorage mutation. Explicit browser download only.
    const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'});const url=URL.createObjectURL(blob);
    try{const a=document.createElement('a');a.href=url;a.download='beekeepy-raw-encrypted-qa-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();}
    finally{setTimeout(()=>URL.revokeObjectURL(url),2000);}
    status.textContent='已下载加密采集文件。跨存储不具备原子性，必须通过独立回读验证。';
  }catch(err){status.textContent='已安全停止：'+String(err?.message||err);}
  finally{document.getElementById('passphrase').value='';button.disabled=false;}
});
