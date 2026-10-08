/* HiveDash Structured Voice Inspection v1 */
(function(){
  if(window.__HD_STRUCTURED_VOICE_V1__) return;
  window.__HD_STRUCTURED_VOICE_V1__=true;

  var recorder=null, mediaStream=null, listening=false, transcribing=false, cancelled=false, finalTranscript='', audioChunks=[], stopTimer=null, stopWatchdog=null, finalizing=false;

  function T(v){return String(v==null?'':v).trim();}
  function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function D(){try{return V49_INSPECTION_DRAFT||null;}catch(e){return window.V49_INSPECTION_DRAFT||null;}}

  var META={
    queenStatus:['Queen seen','queen'],queenMarked:['Queen marked','queen'],queenAge:['Queen age','queen'],
    eggs:['Eggs','queen'],larvae:['Larvae','queen'],queenCells:['Queen cells','queen'],layingPattern:['Laying pattern','queen'],
    brood:['Brood pattern','brood'],broodStrength:['Brood strength','brood'],abnormalities:['Abnormalities','brood'],
    colonySize:['Colony strength','colony'],populationFrames:['Population','colony'],temperament:['Temperament','colony'],
    honey:['Honey stores','stores'],pollen:['Pollen stores','stores'],feedingNeed:['Feeding need','stores'],
    pests:['Pests','additional'],disease:['Disease','additional'],swarming:['Swarming','additional'],super:['Super','additional']
  };
  var WORDS={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20};
  var NT='(?:\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)';

  function numberOf(v){var s=T(v).toLowerCase();if(Object.prototype.hasOwnProperty.call(WORDS,s))return WORDS[s];var n=Number(s);return Number.isFinite(n)?n:null;}
  function lastChoice(text,choices){
    var best=null;
    choices.forEach(function(c){
      var flags=c[0].flags.indexOf('g')>=0?c[0].flags:c[0].flags+'g';
      var src=c[0].source.replace(/\\\\/g,'\\');var re=new RegExp(src,flags),m;
      while((m=re.exec(text))){if(!best||m.index>=best.i)best={i:m.index,v:c[1]};if(m[0]==='')re.lastIndex++;}
    });
    return best?best.v:undefined;
  }
  function numMatch(text,sources,min,max){
    var best=null;
    sources.forEach(function(src){
      var re=new RegExp(src.replace('{N}','('+NT+')'),'gi'),m;
      while((m=re.exec(text))){
        var n=numberOf(m[1]);
        if(n!==null&&n>=min&&n<=max&&(!best||m.index>=best.i))best={i:m.index,v:n};
        if(m[0]==='')re.lastIndex++;
      }
    });
    return best?best.v:undefined;
  }
  function parse(raw){
    // Normalize frequent ASR variants before field parsing. This is lexical only:
    // it does not invent observations; it maps common Whisper spellings of the
    // same spoken phrase to the canonical Inspection vocabulary.
    raw=T(raw)
      .replace(/\bqueen\s+(?:c|see|sea)\.(?=\s|$)/ig,'Queen seen.')
      .replace(/\bqueen\s+(?:see|sea)(?=\s|$)/ig,'Queen seen')
      .replace(/\bhoney\s+storage\b/ig,'honey stores');
    var text=' '+T(raw).toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ')+' ';
    var out=[];
    function put(field,value){
      if(value===undefined||value===null||value==='')return;
      var meta=META[field];if(!meta)return;
      var row={field:field,label:meta[0],group:meta[1],value:value},old=out.find(function(x){return x.field===field;});
      if(old)Object.assign(old,row);else out.push(row);
    }

    var queenStatus=lastChoice(text,[
      [/\\b(?:did(?:n't| not) see|could(?:n't| not) find|never saw|no)\\s+(?:the\\s+)?queen\\b(?!\\s+cells?\\b)/i,'Not Seen'],
      [/\\bqueen\\s+(?:not seen|not found|absent)\\b/i,'Not Seen'],
      [/\\b(?:saw|seen|found|spotted)\\s+(?:the\\s+)?queen\\b/i,'Seen'],
      [/\\bqueen\\s+(?:seen|present|spotted|looked good|looks good)\\b/i,'Seen'],
      [/\\bqueen\\s+(?:c|see|seen)\\.?(?=\\s|$)/i,'Seen']
    ]);
    put('queenStatus',queenStatus);
    put('queenMarked',lastChoice(text,[
      [/\\bqueen\\s+(?:is\\s+)?(?:not marked|unmarked)\\b/i,'No'],
      [/\\b(?:marked queen|queen\\s+(?:is\\s+)?marked)\\b/i,'Yes']
    ]));
    var n=numMatch(text,['\\bqueen\\s+(?:is\\s+)?{N}\\s+(?:year|years)\\s+old\\b','\\bqueen\\s+age\\s+(?:is\\s+)?{N}\\b'],0,5);if(n!==undefined)put('queenAge',n);

    put('eggs',lastChoice(text,[
      [/\\b(?:no|did(?:n't| not) see|without)\\s+(?:any\\s+)?eggs\\b/i,'Not Seen'],
      [/\\beggs?\\s+(?:not seen|absent|missing)\\b/i,'Not Seen'],
      [/\\b(?:saw|seen|found|plenty of|fresh)\\s+eggs\\b/i,'Seen'],
      [/\\beggs?\\s+(?:present|seen|visible)\\b/i,'Seen']
    ]));
    put('larvae',lastChoice(text,[
      [/\\b(?:no|did(?:n't| not) see|without)\\s+(?:any\\s+)?larvae\\b/i,'Not Seen'],
      [/\\blarva(?:e)?\\s+(?:not seen|absent|missing)\\b/i,'Not Seen'],
      [/\\b(?:saw|seen|found|plenty of)\\s+larva(?:e)?\\b/i,'Seen'],
      [/\\blarva(?:e)?\\s+(?:present|seen|visible)\\b/i,'Seen']
    ]));
    put('queenCells',lastChoice(text,[
      [/\\b(?:no|without|did(?:n't| not) see)\\s+(?:any\\s+)?queen cells?\\b/i,'None'],
      [/\\bqueen cells?\\s+(?:none|absent|not seen)\\b/i,'None'],
      [/\\b(?:saw|seen|found|has|have)\\s+(?:some\\s+)?queen cells?\\b/i,'Present'],
      [/\\bqueen cells?\\s+(?:present|seen)\\b/i,'Present']
    ]));
    put('layingPattern',lastChoice(text,[
      [/\\blaying pattern\\s+(?:is\\s+|looks?\\s+)?good\\b/i,'Good'],
      [/\\blaying pattern\\s+(?:is\\s+|looks?\\s+)?fair\\b/i,'Fair'],
      [/\\blaying pattern\\s+(?:is\\s+|looks?\\s+)?poor\\b/i,'Poor']
    ]));

    put('brood',lastChoice(text,[
      [/\\bbrood pattern\\s+(?:is\\s+|looks?\\s+)?excellent\\b/i,'Excellent'],
      [/\\bbrood(?: pattern)?\\s+(?:is\\s+|looks?\\s+)?(?:good|solid|strong)\\b/i,'Good'],
      [/\\bbrood pattern\\s+(?:is\\s+|looks?\\s+)?fair\\b/i,'Fair'],
      [/\\bbrood(?: pattern)?\\s+(?:is\\s+|looks?\\s+)?poor\\b/i,'Poor']
    ]));
    n=numMatch(text,['\\bbrood strength\\s+(?:is\\s+|at\\s+|about\\s+|around\\s+)?{N}\\b','\\bbrood(?: is| looks)?[^.!?]{0,24}\\b{N}\\s*(?:out of ten|out of 10|/\\s*10)\\b'],0,10);if(n!==undefined)put('broodStrength',n);
    put('abnormalities',lastChoice(text,[
      [/\\b(?:no|without)\\s+(?:brood\\s+)?abnormalit(?:y|ies)\\b/i,'None'],
      [/\\bspotty brood\\b/i,'Spotty brood'],[/\\bdrone brood\\b/i,'Drone brood']
    ]));

    n=numMatch(text,['\\bcolony\\s+(?:strength|size)\\s+(?:is\\s+|at\\s+|about\\s+|around\\s+|roughly\\s+)?{N}\\b','\\bcolony\\s+(?:strength|size)[^.!?]{0,20}\\b{N}\\s*(?:out of ten|out of 10|/\\s*10)\\b'],0,10);if(n!==undefined)put('colonySize',n);
    n=numMatch(text,['\\bpopulation\\s+(?:is\\s+|about\\s+|around\\s+)?{N}\\s+frames?\\b','\\b{N}\\s+frames?\\s+of\\s+(?:bees|population)\\b'],1,20);if(n!==undefined)put('populationFrames',n);
    put('temperament',lastChoice(text,[
      [/\\b(?:temperament\\s+(?:is\\s+)?|bees?\\s+(?:are\\s+)?)calm\\b/i,'Calm'],
      [/\\b(?:temperament\\s+(?:is\\s+)?|bees?\\s+(?:are\\s+)?)normal\\b/i,'Normal'],
      [/\\b(?:temperament\\s+(?:is\\s+)?|bees?\\s+(?:are\\s+)?)defensive\\b/i,'Defensive'],
      [/\\b(?:temperament\\s+(?:is\\s+)?|bees?\\s+(?:are\\s+)?)aggressive\\b/i,'Aggressive']
    ]));

    put('honey',lastChoice(text,[
      [/\\bhoney(?: store(?:s)?| storage)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:high|plenty|full)\\b/i,'High'],
      [/\\bhoney(?: store(?:s)?| storage)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:medium|moderate|okay|ok|average)\\b/i,'Medium'],
      [/\\bhoney(?: store(?:s)?| storage)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:low|light|a little low|very low)\\b/i,'Low']
    ]));
    put('pollen',lastChoice(text,[
      [/\\bpollen(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:high|plenty|full)\\b/i,'High'],
      [/\\bpollen(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:medium|moderate|okay|ok|average)\\b/i,'Medium'],
      [/\\bpollen(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:low|light|a little low|very low)\\b/i,'Low']
    ]));
    put('feedingNeed',lastChoice(text,[
      [/\\b(?:no feeding needed|does(?:n't| not) need feeding|feeding not needed)\\b/i,'No'],
      [/\\b(?:needs? feeding|feeding needed|need to feed|should feed)\\b/i,'Yes']
    ]));

    put('pests',lastChoice(text,[
      [/\\b(?:no|without)\\s+(?:signs? of\\s+)?pests?\\b/i,'None'],
      [/\\b(?:small hive beetles?|wax moths?)\\b/i,'Present'],
      [/\\bpests?\\s+(?:present|seen|found)\\b/i,'Present']
    ]));
    put('disease',lastChoice(text,[
      [/\\b(?:no|without)\\s+(?:signs? of\\s+)?disease\\b/i,'None'],
      [/\\b(?:chalkbrood|foulbrood|sacbrood)\\b/i,'Present'],
      [/\\bdisease\\s+(?:present|seen|suspected|signs?)\\b/i,'Present']
    ]));
    put('swarming',lastChoice(text,[
      [/\\b(?:no|without)\\s+(?:swarm|swarming)\\s+signs?\\b/i,'None'],
      [/\\b(?:no signs? of swarming|not showing swarm signs?)\\b/i,'None'],
      [/\\b(?:swarm|swarming)\\s+signs?\\s+(?:present|seen|visible)\\b/i,'Signs'],
      [/\\b(?:signs? of swarming|looks? like (?:they are|they're) swarming)\\b/i,'Signs']
    ]));
    put('super',lastChoice(text,[
      [/\\bsuper\\s+(?:is\\s+)?(?:installed|on|added)\\b/i,'Installed'],
      [/\\bsuper\\s+(?:is\\s+)?(?:removed|off)\\b/i,'Removed']
    ]));

    return {fields:out,formalMention:/\b(varroa|mite count|mites per|treat(?:ed|ment|ing)?|apivar|oxalic acid|formic acid)\b/i.test(text)};
  }

  function confirmFlags(d,applied){
    d.__confirmedFields=d.__confirmedFields||{};
    d.__confirmedSections=d.__confirmedSections||{};
    applied.forEach(function(x){d.__confirmedFields[x.field]=true;});
    function known(f){var v=T(d[f]).toLowerCase();return v!==''&&v!=='not assessed'&&v!=='not confirmed'&&v!=='unknown';}
    function conf(f){return d.__confirmedFields[f]===true;}
    function num(f){return conf(f)&&T(d[f])!==''&&Number.isFinite(Number(d[f]));}
    var q=['queenStatus','eggs','larvae'].filter(function(f){return conf(f)&&known(f);}).length;
    if(q>=2)d.__confirmedSections.queen=true;
    if((conf('brood')&&known('brood'))||num('broodStrength'))d.__confirmedSections.brood=true;
    if(num('colonySize')||num('populationFrames'))d.__confirmedSections.colony=true;
    if(['honey','pollen'].some(function(f){return conf(f)&&known(f);}))d.__confirmedSections.stores=true;
  }

  function styles(){
    if(document.getElementById('hd-voice-structured-style'))return;
    var s=document.createElement('style');s.id='hd-voice-structured-style';
    s.textContent='.hd-notes-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-bottom:8px!important}.hd-notes-head>span{font-weight:700!important}.hd-notes-mic{display:inline-flex!important;align-items:center!important;gap:6px!important;min-height:34px!important;padding:0 10px!important;border:1px solid #D9D4C9!important;border-radius:999px!important;background:#FFFEFB!important;color:#49643F!important;font:inherit!important;font-size:11px!important;font-weight:800!important}.hd-voice-overlay{position:fixed;inset:0;z-index:18000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(35,45,35,.34)}.hd-voice-sheet{width:min(380px,100%);max-height:calc(100dvh - 36px);overflow:auto;box-sizing:border-box;padding:16px;border:1px solid #E2DDD3;border-radius:18px;background:#FFFEFB;box-shadow:0 20px 52px rgba(47,59,51,.22);color:#2F3B33}.hd-voice-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.hd-voice-head b{font-size:17px;color:#36512B}.hd-voice-close{width:34px;height:34px;border:0;background:transparent;font-size:20px;color:#2F3B33}.hd-voice-status{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:#677168;font-weight:700}.hd-voice-dot{width:9px;height:9px;border-radius:50%;background:#A8AEA6}.hd-voice-dot.listen{background:#C5921A;animation:hdvp 1.05s infinite ease-in-out}.hd-voice-dot.err{background:#B53A30}@keyframes hdvp{0%,100%{transform:scale(.82);opacity:.55}50%{transform:scale(1.25);opacity:1}}.hd-voice-transcript{width:100%;min-height:96px;box-sizing:border-box;margin-top:11px;padding:11px 12px;border:1px solid #DED8CE;border-radius:12px;background:#fff;color:#2F3B33;font:inherit;font-size:13px;line-height:1.5;resize:vertical}.hd-voice-controls,.hd-voice-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.hd-voice-controls button,.hd-voice-actions button{min-height:42px;border-radius:11px;font-weight:800}.hd-start{border:0;background:#C5921A;color:#fff}.hd-stop,.hd-cancel{border:1px solid #DCD6CB;background:#fff;color:#4F6744}.hd-apply{border:0;background:#5E7350;color:#fff}.hd-voice-controls button:disabled{opacity:.45}.hd-review{margin-top:14px;padding-top:12px;border-top:1px solid #ECE7DE}.hd-review-head{display:flex;justify-content:space-between;gap:8px}.hd-review-head b{font-size:13px}.hd-review-head span{font-size:10px;color:#7A817B}.hd-fields{display:grid;gap:7px;margin-top:9px}.hd-field{display:flex;align-items:center;gap:9px;padding:8px 9px;border:1px solid #E7E1D7;border-radius:10px;background:#fff}.hd-field input{width:17px;height:17px}.hd-field span{flex:1;font-size:11px;color:#667067}.hd-field b{font-size:11px;color:#36512B}.hd-empty,.hd-formal{margin-top:9px;padding:9px 10px;border-radius:10px;font-size:10px;line-height:1.45}.hd-empty{background:#F7F5EF;color:#6C746E}.hd-formal{border:1px solid #E8DDBF;background:#FFF9EB;color:#75622E}.hd-note{margin-top:9px;font-size:9px;line-height:1.4;color:#8A8E88}';
    document.head.appendChild(s);
  }

  function mimeType(){
    var list=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
    if(typeof MediaRecorder==='undefined')return '';
    for(var i=0;i<list.length;i++){try{if(MediaRecorder.isTypeSupported(list[i]))return list[i];}catch(e){}}
    return '';
  }
  function cleanupMedia(){
    clearTimeout(stopTimer);stopTimer=null;
    clearTimeout(stopWatchdog);stopWatchdog=null;
    if(mediaStream){try{mediaStream.getTracks().forEach(function(t){t.stop();});}catch(e){}}
    mediaStream=null;
  }
  var whisperWorker=null,whisperReady=false,whisperLoadPromise=null,whisperLoadResolve=null,whisperLoadReject=null,whisperLoadTimer=null,whisperSeq=0,whisperPending={},whisperStatusWindow=null;

  function whisperStatus(msg,kind){
    var w=whisperStatusWindow;
    if(w&&document.body.contains(w))status(w,msg,kind||'idle');
  }
  function whisperProgress(p){
    p=p||{};
    if(p.status==='progress'){
      var n=Number(p.progress);
      if(Number.isFinite(n)){
        if(n<=1)n*=100;
        whisperStatus('Downloading local Whisper model… '+Math.max(0,Math.min(100,Math.round(n)))+'%','idle');
        return;
      }
    }
    if(p.status==='done'){whisperStatus('Local Whisper model file ready. Continuing…','idle');return;}
    if(p.status==='initiate'||p.status==='download'){whisperStatus('Preparing local Whisper model download…','idle');}
  }
  function resetWhisperLoad(err){
    clearTimeout(whisperLoadTimer);whisperLoadTimer=null;
    if(err&&whisperLoadReject)whisperLoadReject(err);
    whisperLoadResolve=whisperLoadReject=null;
    if(err){whisperLoadPromise=null;whisperReady=false;}
  }
  function ensureWhisperWorker(){
    if(whisperWorker)return whisperWorker;
    var worker=new Worker('whisper-inspection-worker.js?v=voice-whisper-large-v3-turbo-1',{type:'module'});
    worker.onmessage=function(e){
      var m=e.data||{};
      if(m.type==='progress'){whisperProgress(m.progress);return;}
      if(m.type==='status'){whisperStatus(m.message||'Preparing local Whisper model…','idle');return;}
      if(m.type==='ready'){
        whisperReady=true;
        clearTimeout(whisperLoadTimer);whisperLoadTimer=null;
        if(whisperLoadResolve)whisperLoadResolve(true);
        whisperLoadResolve=whisperLoadReject=null;
        whisperStatus('Local Whisper model ready.','idle');
        return;
      }
      if(m.type==='result'){
        var p=whisperPending[m.id];delete whisperPending[m.id];
        if(p){clearTimeout(p.timer);p.resolve(T(m.text));}
        return;
      }
      if(m.type==='error'){
        var q=m.id!=null?whisperPending[m.id]:null;
        var err=new Error(m.message||'Local Whisper transcription failed.');
        if(q){delete whisperPending[m.id];clearTimeout(q.timer);q.reject(err);return;}
        resetWhisperLoad(err);
        whisperStatus(err.message,'err');
      }
    };
    worker.onerror=function(e){
      var err=new Error((e&&e.message)||'Local Whisper worker failed.');
      Object.keys(whisperPending).forEach(function(id){
        var p=whisperPending[id];delete whisperPending[id];
        try{clearTimeout(p.timer);p.reject(err);}catch(x){}
      });
      resetWhisperLoad(err);whisperWorker=null;
      whisperStatus(err.message,'err');
    };
    whisperWorker=worker;
    return worker;
  }
  function loadWhisper(w){
    whisperStatusWindow=w;
    if(whisperReady){status(w,'Local Whisper model ready.','idle');return Promise.resolve(true);}
    if(!navigator.gpu)return Promise.reject(new Error('WebGPU is required for local Whisper. Use current Edge/Chrome with hardware acceleration enabled.'));
    if(whisperLoadPromise)return whisperLoadPromise;
    whisperLoadPromise=new Promise(function(resolve,reject){
      whisperLoadResolve=resolve;whisperLoadReject=reject;
      whisperLoadTimer=setTimeout(function(){
        resetWhisperLoad(new Error('Local Whisper model took too long to initialize.'));
      },300000);
      try{ensureWhisperWorker().postMessage({type:'load'});}
      catch(e){resetWhisperLoad(e instanceof Error?e:new Error(String(e)));}
    });
    return whisperLoadPromise;
  }

  async function audioTo16k(blob){
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error('Audio decoding is not supported in this browser.');
    var ctx=new AC();
    try{
      var raw=await blob.arrayBuffer();
      var decoded=await ctx.decodeAudioData(raw.slice(0));
      if(decoded.sampleRate===16000&&decoded.numberOfChannels===1)return new Float32Array(decoded.getChannelData(0));
      var Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      if(!Offline)throw new Error('Audio resampling is not supported in this browser.');
      var frames=Math.max(1,Math.ceil(decoded.duration*16000));
      var off=new Offline(1,frames,16000),src=off.createBufferSource();
      src.buffer=decoded;src.connect(off.destination);src.start(0);
      var rendered=await off.startRendering();
      return new Float32Array(rendered.getChannelData(0));
    }finally{try{await ctx.close();}catch(e){}}
  }

  async function transcribe(blob,w){
    await loadWhisper(w);
    var audio=await audioTo16k(blob);
    status(w,'Transcribing locally with Whisper…','idle');
    var id=++whisperSeq,worker=ensureWhisperWorker();
    return new Promise(function(resolve,reject){
      var timer=setTimeout(function(){
        var p=whisperPending[id];delete whisperPending[id];
        if(p)p.reject(new Error('Local Whisper transcription took too long.'));
      },180000);
      whisperPending[id]={resolve:resolve,reject:reject,timer:timer};
      try{worker.postMessage({type:'transcribe',id:id,audio:audio},[audio.buffer]);}
      catch(e){
        delete whisperPending[id];clearTimeout(timer);
        reject(e instanceof Error?e:new Error(String(e)));
      }
    });
  }

  async function finishRecording(w,type,recorderRef){
    if(finalizing)return;
    finalizing=true;
    listening=false;
    cleanupMedia();
    if(cancelled){audioChunks=[];finalizing=false;return;}
    transcribing=true;
    if(w){buttons(w);status(w,'Transcribing…','idle');}
    try{
      var blob=new Blob(audioChunks,{type:(recorderRef&&recorderRef.mimeType)||type||'audio/webm'});
      audioChunks=[];
      if(!blob.size)throw new Error('No audio was captured. Please try again.');
      var text=await transcribe(blob,w);
      var area=w&&w.querySelector('.hd-voice-transcript');
      if(area){
        area.value=[finalTranscript,text].filter(Boolean).join(finalTranscript&&text?'\n':'').trim();
      }
      if(w){review(w);status(w,'Review the transcript and detected fields.','idle');}
    }catch(err){
      console.error('Structured voice transcription failed',err);
      if(w)status(w,err&&err.message?err.message:'Voice transcription failed.','err');
    }finally{
      transcribing=false;recorder=null;finalizing=false;
      if(w)buttons(w);
    }
  }

  function stop(){
    var w=document.querySelector('.hd-voice-overlay');
    if(!recorder||finalizing)return;
    var rr=recorder;
    clearTimeout(stopTimer);stopTimer=null;
    listening=false;
    if(w){status(w,'Stopping recording…','idle');buttons(w);}
    try{
      if(rr.state==='recording'||rr.state==='paused'){
        try{rr.requestData();}catch(_){}
        rr.stop();
        stopWatchdog=setTimeout(function(){
          if(!finalizing&&recorder===rr){
            finishRecording(w,rr.mimeType||'',rr);
          }
        },1200);
      }else{
        finishRecording(w,rr.mimeType||'',rr);
      }
    }catch(err){
      console.warn('MediaRecorder stop failed; using captured audio fallback',err);
      finishRecording(w,rr.mimeType||'',rr);
    }
  }
  function close(){
    cancelled=true;
    clearTimeout(stopWatchdog);stopWatchdog=null;
    if(recorder){
      try{
        if(recorder.state==='recording'||recorder.state==='paused')recorder.stop();
      }catch(e){}
    }
    cleanupMedia();recorder=null;listening=false;transcribing=false;finalizing=false;audioChunks=[];
    document.querySelector('.hd-voice-overlay')?.remove();
  }
  function status(w,msg,kind){var l=w.querySelector('.hd-voice-status span:last-child'),d=w.querySelector('.hd-voice-dot');if(l)l.textContent=msg;if(d){d.classList.toggle('listen',kind==='listen');d.classList.toggle('err',kind==='err');}}
  function buttons(w){
    var a=w.querySelector('.hd-start'),b=w.querySelector('.hd-stop'),p=w.querySelector('.hd-apply');
    if(a)a.disabled=listening||transcribing;
    if(b)b.disabled=!listening||transcribing;
    if(p)p.disabled=transcribing;
  }

  function review(w){
    var a=w.querySelector('.hd-voice-transcript'),box=w.querySelector('.hd-review');if(!a||!box)return;
    var p=parse(a.value),html='<div class="hd-review-head"><b>Detected observations</b><span>'+p.fields.length+' field'+(p.fields.length===1?'':'s')+'</span></div>';
    if(p.fields.length){
      html+='<div class="hd-fields">'+p.fields.map(function(x,i){return '<label class="hd-field"><input type="checkbox" data-det="'+i+'" checked><span>'+E(x.label)+'</span><b>'+E(x.value)+'</b></label>';}).join('')+'</div>';
    }else html+='<div class="hd-empty">No structured Inspection fields detected yet. The transcript can still be added to Notes.</div>';
    if(p.formalMention)html+='<div class="hd-formal">Varroa or treatment wording was detected. It stays in Notes only. Formal Varroa Test and Treatment records are not changed here.</div>';
    box.innerHTML=html;
  }

  async function start(w){
    if(listening||transcribing||finalizing)return;
    cancelled=false;finalizing=false;
    clearTimeout(stopWatchdog);stopWatchdog=null;
    transcribing=true;buttons(w);
    try{await loadWhisper(w);}catch(e){transcribing=false;buttons(w);status(w,e&&e.message?e.message:'Local Whisper model could not be loaded.','err');return;}
    if(cancelled||!document.body.contains(w)){transcribing=false;buttons(w);return;}
    transcribing=false;buttons(w);
    if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      status(w,'Microphone recording is not supported in this browser.','err');
      if(typeof toast==='function')toast('Microphone recording is not supported in this browser');
      return;
    }
    var area=w.querySelector('.hd-voice-transcript');
    finalTranscript=T(area&&area.value);
    cancelled=false;audioChunks=[];
    try{
      mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      var type=mimeType(),opts={audioBitsPerSecond:64000};if(type)opts.mimeType=type;
      recorder=new MediaRecorder(mediaStream,opts);
      recorder.ondataavailable=function(e){if(e.data&&e.data.size)audioChunks.push(e.data);};
      recorder.onstart=function(){
        listening=true;transcribing=false;status(w,'Recording… describe what you see.','listen');buttons(w);
        stopTimer=setTimeout(function(){if(listening){status(w,'Maximum recording length reached. Transcribing…','idle');stop();}},180000);
      };
      recorder.onerror=function(){listening=false;transcribing=false;cleanupMedia();buttons(w);status(w,'Microphone recording failed. Try again.','err');};
      recorder.onstop=function(){
        finishRecording(w,type,this);
      };
      recorder.start();
    }catch(e){
      cleanupMedia();recorder=null;listening=false;transcribing=false;buttons(w);
      var denied=e&&(/NotAllowed|Permission/i.test(String(e.name||'')+' '+String(e.message||'')));
      status(w,denied?'Microphone permission was denied.':'Microphone could not be started.','err');
    }
  }

  function openVoice(){
    var d=D();if(!d){if(typeof toast==='function')toast('Inspection draft is unavailable');return;}
    var notes=document.getElementById('inotes');if(notes)d.notes=notes.value;
    close();
    var w=document.createElement('div');w.className='hd-voice-overlay';
    w.innerHTML='<section class="hd-voice-sheet" role="dialog" aria-modal="true"><div class="hd-voice-head"><b>Speak Inspection</b><button class="hd-voice-close" type="button">×</button></div><div class="hd-voice-status"><span class="hd-voice-dot"></span><span>Tap Start and describe what you see.</span></div><textarea class="hd-voice-transcript" placeholder="Your speech will appear here. You can edit it before applying."></textarea><div class="hd-voice-controls"><button class="hd-start" type="button">● Start</button><button class="hd-stop" type="button" disabled>■ Stop</button></div><div class="hd-review"></div><div class="hd-voice-actions"><button class="hd-cancel" type="button">Cancel</button><button class="hd-apply" type="button">Apply to Inspection</button></div><div class="hd-note">Nothing is saved automatically. Review the detected observations, then use the existing Save Inspection button.</div></section>';
    document.body.appendChild(w);review(w);
    var area=w.querySelector('.hd-voice-transcript');if(area)area.addEventListener('input',function(){review(w);});
    w.querySelector('.hd-voice-close').onclick=close;w.querySelector('.hd-cancel').onclick=close;w.querySelector('.hd-start').onclick=function(){start(w);};w.querySelector('.hd-stop').onclick=stop;
    w.addEventListener('click',function(e){if(e.target===w)close();});
    w.querySelector('.hd-apply').onclick=function(){
      stop();
      var tr=T(area&&area.value);if(!tr){if(typeof toast==='function')toast('Record or enter an inspection note first');return;}
      var p=parse(tr),selected=new Set(Array.from(w.querySelectorAll('[data-det]:checked')).map(function(x){return Number(x.dataset.det);}));
      var applied=p.fields.filter(function(x,i){return selected.has(i);}),draft=D();if(!draft){close();return;}
      applied.forEach(function(x){draft[x.field]=x.value;});confirmFlags(draft,applied);
      var old=T(draft.notes);draft.notes=old?old.replace(/\s+$/,'')+'\n'+tr:tr;
      var hid=draft.hiveId;close();
      try{inspectionPage(document.getElementById('view'),hid);if(typeof chrome==='function')chrome('inspection');}catch(e){console.error('Structured voice refresh failed',e);}
      if(typeof toast==='function')toast(applied.length?'Voice applied to '+applied.length+' Inspection field'+(applied.length===1?'':'s'):'Voice added to Notes');
    };
  }

  function decorate(root){
    if(!root)return;
    var notes=root.querySelector('.v211-notes')||root.querySelector('.notes');if(!notes||notes.dataset.hdVoice==='1')return;
    notes.dataset.hdVoice='1';
    var old=Array.from(notes.children).find(function(x){return x.tagName==='SPAN';});
    var head=document.createElement('div');head.className='hd-notes-head';head.innerHTML='<span>Notes</span><button type="button" class="hd-notes-mic" aria-label="Speak inspection">🎙 <span>Speak</span></button>';
    if(old)old.replaceWith(head);else notes.insertBefore(head,notes.firstChild);
    head.querySelector('button').onclick=function(e){e.preventDefault();e.stopPropagation();openVoice();};
    var legacy=root.querySelector('.voice-row');if(legacy){legacy.hidden=true;legacy.setAttribute('aria-hidden','true');legacy.style.setProperty('display','none','important');}
  }

  styles();
  var prev=window.inspectionPage||((typeof inspectionPage==='function')?inspectionPage:null);
  if(typeof prev==='function'){
    window.inspectionPage=function(r,id){var ret=prev.apply(this,arguments);decorate(r);return ret;};
    try{inspectionPage=window.inspectionPage;}catch(e){}
  }

  // Direct hash navigation can render Inspection before this enhancement script
  // loads, so decorate the current view immediately and watch for later re-renders.
  try{decorate(document.getElementById('view'));}catch(e){}
  try{
    var voiceView=document.getElementById('view');
    if(voiceView&&typeof MutationObserver==='function'){
      new MutationObserver(function(){try{decorate(voiceView);}catch(e){}}).observe(voiceView,{childList:true,subtree:true});
    }
  }catch(e){}

  window.openStructuredVoiceInspection=openVoice;
  window.__HD_STRUCTURED_VOICE_VERSION__='3.0.1-whisper-initial-decorate';
})();