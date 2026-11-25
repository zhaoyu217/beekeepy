/* Native mobile SpeechRecognition shim.
   It presents the small subset of the Web Speech API used by inspection-voice.js,
   while delegating all recognition to the Capacitor OfflineAsr native plugin. */
(function(){
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;

  const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.OfflineAsr;
  const scopedSessions = window.Capacitor.getPlatform?.() === 'android';
  if (!plugin) {
    console.warn('[OfflineAsr] Native plugin is not registered.');
    return;
  }

  async function bundledHotwords(){
    const response=await fetch('mobile-hotwords.txt');
    if(!response.ok)throw new Error('Bundled ASR hotwords are missing');
    const text=(await response.text()).replace(/\r\n/g,'\n').trim();
    if(!text)throw new Error('Bundled ASR hotwords are empty');
    window.__HD_NATIVE_OFFLINE_ASR_HOTWORDS__=text;
    return text;
  }

  class NativeSpeechRecognition {
    constructor(){
      this.lang='en-US';
      this.continuous=true;
      this.interimResults=true;
      this.maxAlternatives=1;
      this.onstart=null;
      this.onresult=null;
      this.onerror=null;
      this.onend=null;
      this._handles=[];
      this._running=false;
      this._starting=false;
      this._epoch=0;
      this._sessionId=null;
      this._resultIndex=0;
    }

    async _listen(name, fn, epoch){
      const id=this._sessionId;
      const h = await plugin.addListener(name, e=>{if(this._epoch===epoch&&(!scopedSessions||e.sessionId===id))fn(e)});
      if(this._epoch!==epoch){await h.remove();return;}
      this._handles.push(h);
    }

    _result(text, isFinal){
      const result = [{ transcript: String(text||''), confidence: 1 }];
      result.isFinal = !!isFinal;
      const results = [result];
      const ev = { resultIndex: 0, results };
      if (typeof this.onresult === 'function') this.onresult(ev);
    }

    async start(){
      if(this._running||this._starting) return;
      this._starting=true;
      const epoch=++this._epoch;
      const sessionId=globalThis.crypto?.randomUUID?.()||('asr-'+Date.now()+'-'+Math.random());
      this._sessionId=sessionId;
      const source=scopedSessions&&window.__HD_NATIVE_OFFLINE_ASR_FIXTURE_MODE__===true?'fixture':'microphone';
      try{
        const available = await plugin.isAvailable();
        if(this._epoch!==epoch)return;
        if(!available || available.available !== true) throw new Error(available?.reason || 'offline-asr-unavailable');
        await this._listen('asrPartial', e => this._result(e.text, false),epoch);
        await this._listen('asrFinal', e => this._result(e.text, true),epoch);
        await this._listen('asrError', e => {
          if(typeof this.onerror === 'function') this.onerror({ error:e.code||'native-asr-error', message:e.message||'' });
        },epoch);
        await this._listen('asrState', e => {if(e.state === 'ended')this._finish();},epoch);
        const hotwords=await bundledHotwords();
        if(this._epoch!==epoch)return;
        this._running=true;
        await plugin.start({language:this.lang||'en-US',hotwords,sessionId,source});
        if(this._epoch!==epoch){try{await plugin.abort({sessionId});}catch(_){}return;}
        window.__HD_NATIVE_OFFLINE_ASR_SESSION__=sessionId;
        if(typeof this.onstart === 'function') this.onstart();
      }catch(err){
        if(this._epoch===epoch){
          try{await plugin.abort({sessionId});}catch(_){}
          if(typeof this.onerror === 'function') this.onerror({ error:'native-asr-start-failed', message:String(err?.message||err) });
          await this._finish();
        }
      }finally{if(this._epoch===epoch)this._starting=false;}
    }

    async stop(){
      const sessionId=this._sessionId;
      if(this._starting){await this.abort();return;}
      if(!this._running){await this._finish();return;}
      try{await plugin.stop({sessionId});}
      catch(err){
        if(typeof this.onerror === 'function')this.onerror({error:'native-asr-stop-failed',message:String(err?.message||err)});
        await this._finish();
      }
    }

    async abort(){
      const sessionId=this._sessionId;
      await this._finish();
      try{await plugin.abort({sessionId});}catch(_){}
    }

    async _finish(){
      const hadSession=this._starting||this._running||this._handles.length>0;
      ++this._epoch;
      this._running=false;this._starting=false;this._sessionId=null;
      const handles=this._handles.splice(0);
      for(const h of handles){try{await h.remove();}catch(_){}}
      if(hadSession&&typeof this.onend === 'function')this.onend();
    }
  }

  window.SpeechRecognition = NativeSpeechRecognition;
  window.webkitSpeechRecognition = NativeSpeechRecognition;
  window.__HD_NATIVE_OFFLINE_ASR__ = true;
})();
