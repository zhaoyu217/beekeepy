/* Native mobile SpeechRecognition shim.
   It presents the small subset of the Web Speech API used by inspection-voice.js,
   while delegating all recognition to the Capacitor OfflineAsr native plugin. */
(function(){
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;

  const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.OfflineAsr;
  if (!plugin) {
    console.warn('[OfflineAsr] Native plugin is not registered.');
    return;
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
      this._resultIndex=0;
    }

    async _listen(name, fn){
      const h = await plugin.addListener(name, fn);
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
      if(this._running) return;
      try{
        const available = await plugin.isAvailable();
        if(!available || available.available !== true) throw new Error(available?.reason || 'offline-asr-unavailable');

        await this._listen('asrPartial', e => this._result(e.text, false));
        await this._listen('asrFinal', e => this._result(e.text, true));
        await this._listen('asrError', e => {
          if(typeof this.onerror === 'function') this.onerror({ error:e.code||'native-asr-error', message:e.message||'' });
        });
        await this._listen('asrState', e => {
          if(e.state === 'ended') this._finish();
        });

        await plugin.start({
          language: this.lang || 'en-US',
          hotwords: [
            'QUEEN','QUEEN SEEN','QUEEN CELLS','EGGS','LARVAE',
            'BROOD PATTERN','COLONY STRENGTH','HONEY STORES',
            'POLLEN STORES','SWARM SIGNS','VARROA','TREATMENT'
          ].join('\n')
        });
        this._running=true;
        if(typeof this.onstart === 'function') this.onstart();
      }catch(err){
        if(typeof this.onerror === 'function') this.onerror({ error:'native-asr-start-failed', message:String(err?.message||err) });
        this._finish();
      }
    }

    async stop(){
      if(!this._running){ this._finish(); return; }
      try{ await plugin.stop(); }
      catch(err){
        if(typeof this.onerror === 'function') this.onerror({ error:'native-asr-stop-failed', message:String(err?.message||err) });
        this._finish();
      }
    }

    async abort(){
      try{ await plugin.abort(); }catch(_){}
      this._finish();
    }

    async _finish(){
      if(!this._running && this._handles.length===0) return;
      this._running=false;
      for(const h of this._handles.splice(0)){
        try{ await h.remove(); }catch(_){}
      }
      if(typeof this.onend === 'function') this.onend();
    }
  }

  window.SpeechRecognition = NativeSpeechRecognition;
  window.webkitSpeechRecognition = NativeSpeechRecognition;
  window.__HD_NATIVE_OFFLINE_ASR__ = true;
})();
