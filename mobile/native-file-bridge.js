/* APK-only adapter: preserve the shared export bytes and use Android's picker. */
(function(root){
  'use strict';
  const cap=root.Capacitor;
  if(!cap?.isNativePlatform?.()||cap.getPlatform()!=='android')return;
  const unavailable=()=>Promise.reject(Error('Native file service unavailable'));
  const files=cap.Plugins?.DeviceFiles||cap.registerPlugin?.('DeviceFiles')||{saveDocument:unavailable,printPage:unavailable,printHtml:unavailable};
  const blobs=new Map();
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=function(value){const url=create(value);if(value instanceof Blob)blobs.set(url,value);return url;};
  URL.revokeObjectURL=function(url){blobs.delete(url);return revoke(url);};
  let pending=false;
  function message(text){if(typeof root.toast==='function')root.toast(text);}
  async function save(anchor,blob){
    if(pending){message('Finish the current file export first');return;}
    pending=true;
    try{
      if(blob.size>20*1024*1024)throw Error('This export exceeds the Android 20 MiB file limit');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read export'));reader.readAsDataURL(blob);});
      const result=await files.saveDocument({name:anchor.download||'beekeepy-export',mimeType:blob.type||'application/octet-stream',base64:data});
      if(result.saved===true)message('File saved');else if(result.cancelled!==true)throw Error('Android did not confirm the file save');
    }catch(error){message('File export failed: '+String(error.message||error));}
    finally{pending=false;}
  }
  function intercept(anchor){const blob=anchor.download&&blobs.get(anchor.href);if(!blob)return false;void save(anchor,blob);return true;}
  const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(!intercept(this))return click.apply(this,arguments);};
  let reportClick=false;
  const open=root.open;
  root.open=function(url,target){
    if(reportClick&&url===''&&target==='_blank'){
      let html='';
      return {opener:null,document:{write:text=>{html+=String(text);},close(){}},focus(){},print(){void files.printHtml({html}).catch(error=>message('Print failed: '+String(error.message||error)));}};
    }
    return open.apply(this,arguments);
  };
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('[data-hd-print]')){reportClick=true;queueMicrotask(()=>{reportClick=false;});}
    const anchor=target?.closest('a[download]');if(anchor&&intercept(anchor)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  root.print=function(){void files.printPage().catch(error=>message('Print failed: '+String(error.message||error)));};
})(window);
