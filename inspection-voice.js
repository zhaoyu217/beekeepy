/* HiveDash Structured Voice Inspection v1 */
(function(){
  if(window.__HD_STRUCTURED_VOICE_V1__) return;
  window.__HD_STRUCTURED_VOICE_V1__=true;

  var recorder=null, mediaStream=null, listening=false, transcribing=false, cancelled=false, finalTranscript='', structuredTranscript='', audioChunks=[], stopTimer=null, structuredGeneration=0;

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
    var text=' '+T(raw).toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ')+' ';
    var out=[];
    function put(field,value){
      if(value===undefined||value===null||value==='')return;
      var meta=META[field];if(!meta)return;
      var row={field:field,label:meta[0],group:meta[1],value:value},old=out.find(function(x){return x.field===field;});
      if(old)Object.assign(old,row);else out.push(row);
    }

    put('queenStatus',lastChoice(text,[
      [/\\b(?:did(?:n't| not) see|could(?:n't| not) find|never saw|no)\\s+(?:the\\s+)?queen\\b(?!\\s+cells?\\b)/i,'Not Seen'],
      [/\\bqueen\\s+(?:not seen|not found|absent)\\b/i,'Not Seen'],
      [/\\b(?:saw|seen|found|spotted)\\s+(?:the\\s+)?queen\\b/i,'Seen'],
      [/\\bqueen\\s+(?:seen|present|spotted|looked good|looks good)\\b/i,'Seen']
    ]));
    put('queenMarked',lastChoice(text,[
      [/\\bqueen\\s+(?:is\\s+)?(?:not marked|unmarked)\\b/i,'No'],
      [/\\b(?:marked queen|queen\\s+(?:is\\s+)?marked)\\b/i,'Yes']
    ]));
    var n=numMatch(text,['\\bqueen\\s+(?:is\\s+)?{N}\\s+(?:year|years)\\s+old\\b','\\bqueen\\s+age\\s+(?:is\\s+)?{N}\\b'],0,5);if(n!==undefined)put('queenAge',n);

    put('eggs',lastChoice(text,[
      [/\\b(?:no|did(?:n't| not) see|without)\\s+(?:any\\s+)?eggs\\b/i,'Not Seen'],
      [/\\beggs?\\s+(?:not seen|absent|missing)\\b/i,'Not Seen'],
      [/\\b(?:saw|found|plenty of|fresh)\\s+eggs\\b/i,'Seen'],
      [/\\beggs?\\s+(?:present|seen|visible)\\b/i,'Seen']
    ]));
    put('larvae',lastChoice(text,[
      [/\\b(?:no|did(?:n't| not) see|without)\\s+(?:any\\s+)?larvae\\b/i,'Not Seen'],
      [/\\blarvae\\s+(?:not seen|absent|missing)\\b/i,'Not Seen'],
      [/\\b(?:saw|found|plenty of)\\s+larvae\\b/i,'Seen'],
      [/\\blarvae\\s+(?:present|seen|visible)\\b/i,'Seen']
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
      [/\\bhoney(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:high|plenty|full)\\b/i,'High'],
      [/\\bhoney(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:medium|moderate|okay|ok|average)\\b/i,'Medium'],
      [/\\bhoney(?: stores?)?\\s+(?:is\\s+|are\\s+|looks?\\s+)?(?:low|light|a little low|very low)\\b/i,'Low']
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
    if(mediaStream){try{mediaStream.getTracks().forEach(function(t){t.stop();});}catch(e){}}
    mediaStream=null;
  }
  function sherpaAsset(path){return 'https://modelscope.cn/studio/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/master/'+path;}
  var SHERPA_TOKENS='https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-21/resolve/main/tokens.txt?download=true';
  var sherpaPromise=null,sherpaRecognizer=null,sherpaHotwords='',sherpaBpeVocab='';
  var BEE_HOTWORDS=[
    'QUEEN SEEN :6.0','QUEEN NOT SEEN :6.0',
    'QUEEN CELLS :4.0','NO QUEEN CELLS :5.0','QUEEN CELLS PRESENT :5.0',
    'EGGS PRESENT :4.0','EGGS NOT SEEN :5.0',
    'LARVAE PRESENT :4.0','LARVAE NOT SEEN :5.0',
    'BROOD PATTERN :4.0','BROOD STRENGTH :4.0',
    'COLONY STRENGTH :4.0','HONEY STORES :4.0','POLLEN STORES :4.0',
    'SWARM SIGNS :4.0','NO SWARM SIGNS :5.0','SWARM SIGNS PRESENT :5.0',
    'MITE COUNT :4.0','OXALIC ACID :4.0','FORMIC ACID :4.0',
    'SMALL HIVE BEETLE :4.0','WAX MOTH :4.0'
  ];

  function loadScript(src,label){
    return new Promise(function(resolve,reject){
      var old=document.querySelector('script[data-hd-sherpa="'+src+'"]');
      if(old&&old.dataset.loaded==='1'){resolve();return;}
      var s=old||document.createElement('script');

      function attach(){
        s.addEventListener('load',function(){s.dataset.loaded='1';resolve();},{once:true});
        s.addEventListener('error',function(){reject(new Error((label||'Sherpa script')+' could not execute in this browser.'));},{once:true});
      }

      if(old){attach();return;}

      fetch(src,{mode:'cors',cache:'no-cache'}).then(function(r){
        if(!r.ok)throw new Error((label||'Sherpa script')+' returned HTTP '+r.status+'.');
        return r.text();
      }).then(function(code){
        var blobUrl=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
        s.src=blobUrl;s.async=true;s.dataset.hdSherpa=src;
        s.addEventListener('load',function(){try{URL.revokeObjectURL(blobUrl);}catch(e){}},{once:true});
        s.addEventListener('error',function(){try{URL.revokeObjectURL(blobUrl);}catch(e){}},{once:true});
        attach();
        document.head.appendChild(s);
      }).catch(function(e){
        var msg=(e&&e.message)||'Failed to fetch';
        reject(new Error((label||'Sherpa script')+' could not be fetched from ModelScope. '+msg));
      });
    });
  }

  async function fetchSherpaBinaryWithRetry(path){
    var lastErr=null;
    for(var attempt=1;attempt<=3;attempt++){
      try{
        var url=sherpaAsset(path)+(attempt>1?('?retry='+Date.now()+'-'+attempt):'');
        var r=await fetch(url,{mode:'cors',cache:attempt===1?'default':'no-store'});
        if(!r.ok)throw new Error(path+' returned HTTP '+r.status+'.');
        var buf=await r.arrayBuffer();
        if(!buf||buf.byteLength<1024)throw new Error(path+' returned an invalid binary.');
        return new Uint8Array(buf);
      }catch(e){
        lastErr=e;
        if(attempt<3)await new Promise(function(resolve){setTimeout(resolve,700*attempt);});
      }
    }
    throw new Error('Sherpa WebAssembly download failed after 3 attempts. '+((lastErr&&lastErr.message)||''));
  }

  function modelStatusText(raw){
    var m=String(raw||'').match(/Downloading data\.\.\. \((\d+)\/(\d+)\)/);
    if(m){
      var a=Number(m[1]),b=Number(m[2]);
      if(b>0)return 'Downloading local voice model… '+Math.max(0,Math.min(100,Math.round(a*100/b)))+'%';
    }
    if(raw==='Running...')return 'Initializing local voice model…';
    return raw?'Preparing local voice model…':'Preparing local voice model…';
  }

  async function prepareHotwordResources(){
    var r=await fetch(SHERPA_TOKENS,{mode:'cors',cache:'force-cache'});
    if(!r.ok)throw new Error('Sherpa token vocabulary returned HTTP '+r.status+'.');
    var raw=await r.text();
    var rows=[];
    String(raw||'').split(/\r?\n/).forEach(function(line){
      var t=line.trim();if(!t)return;
      var p=t.split(/\s+/);if(p[0])rows.push(p[0]+'\t-1.0');
    });
    if(!rows.length)throw new Error('Sherpa token vocabulary is empty.');
    sherpaBpeVocab=rows.join('\n')+'\n';
    sherpaHotwords=BEE_HOTWORDS.join('\n');
  }

  function installRuntimeTextFile(Module,name,text){
    var bytes=new TextEncoder().encode(String(text||''));
    if(typeof Module.FS_createDataFile==='function'){
      try{Module.FS_createDataFile('/',name,bytes,true,true,true);return;}
      catch(e){
        if(!(e&&/exist/i.test(String(e.message||e))))throw e;
        return;
      }
    }
    if(Module.FS&&typeof Module.FS.writeFile==='function'){
      Module.FS.writeFile('/'+name,bytes);return;
    }
    throw new Error('Sherpa virtual filesystem file creation is unavailable.');
  }

  function sherpaConfig(){
    var hotwordBytes=new TextEncoder().encode(sherpaHotwords).length;
    return {
      featConfig:{sampleRate:16000,featureDim:80},
      modelConfig:{
        transducer:{encoder:'./encoder.onnx',decoder:'./decoder.onnx',joiner:'./joiner.onnx'},
        paraformer:{encoder:'',decoder:''},
        zipformer2Ctc:{model:''},
        nemoCtc:{model:''},
        toneCtc:{model:''},
        tokens:'./tokens.txt',numThreads:1,provider:'cpu',debug:0,modelType:'',
        modelingUnit:'bpe',bpeVocab:'/bpe.vocab'
      },
      decodingMethod:'modified_beam_search',maxActivePaths:4,enableEndpoint:0,
      rule1MinTrailingSilence:2.4,rule2MinTrailingSilence:1.2,rule3MinUtteranceLength:20,
      hotwordsFile:'',hotwordsScore:2.5,hotwordsBuf:sherpaHotwords,hotwordsBufSize:hotwordBytes,
      ctcFstDecoderConfig:{graph:'',maxActive:3000},ruleFsts:'',ruleFars:'',blankPenalty:0
    };
  }

  async function loadSherpa(w){
    if(sherpaRecognizer){
      status(w,'Local beekeeping voice model ready.','idle');
      return sherpaRecognizer;
    }
    if(sherpaPromise){
      status(w,'Waiting for local voice model…','idle');
      return sherpaPromise.then(function(r){
        if(document.body.contains(w))status(w,'Local beekeeping voice model ready.','idle');
        return r;
      });
    }
    sherpaPromise=(async function(){
      status(w,'Loading Sherpa-ONNX JavaScript…','idle');
      await loadScript(sherpaAsset('sherpa-onnx-asr.js'),'Sherpa-ONNX JavaScript');
      if(typeof createOnlineRecognizer!=='function')throw new Error('Sherpa-ONNX JavaScript loaded, but createOnlineRecognizer is missing.');

      status(w,'Preparing beekeeping hotwords…','idle');
      await prepareHotwordResources();

      status(w,'Loading Sherpa-ONNX WebAssembly and model…','idle');
      var wasmBinary=await fetchSherpaBinaryWithRetry('sherpa-onnx-wasm-main-asr.wasm');
      await new Promise(function(resolve,reject){
        var done=false,settled=false;
        function fail(err){
          if(settled)return;
          settled=true;clearTimeout(timer);
          reject(err instanceof Error?err:new Error(String(err||'Sherpa-ONNX initialization failed.')));
        }
        var timer=setTimeout(function(){
          if(!done)fail(new Error('Sherpa-ONNX WebAssembly/model initialization timed out.'));
        },180000);
        window.Module={
          wasmBinary:wasmBinary,
          locateFile:function(path){return sherpaAsset(path);},
          setStatus:function(raw){if(document.body.contains(w))status(w,modelStatusText(raw),'idle');},
          onAbort:function(why){fail(new Error('Sherpa-ONNX WebAssembly aborted: '+String(why||'unknown error')));},
          printErr:function(msg){console.error('Sherpa-ONNX WASM:',msg);},
          onRuntimeInitialized:function(){
            try{
              if(typeof createOnlineRecognizer!=='function')throw new Error('Speech recognizer wrapper did not initialize.');
              installRuntimeTextFile(window.Module,'bpe.vocab',sherpaBpeVocab);
              sherpaRecognizer=createOnlineRecognizer(window.Module,sherpaConfig());
              if(!sherpaRecognizer||!sherpaRecognizer.handle)throw new Error('Sherpa hotword recognizer could not be created.');
              done=true;settled=true;clearTimeout(timer);resolve();
            }catch(e){fail(e);}
          }
        };
        loadScript(sherpaAsset('sherpa-onnx-wasm-main-asr.js'),'Sherpa-ONNX WebAssembly loader').catch(fail);
      });
      status(w,'Local beekeeping voice model ready.','idle');
      return sherpaRecognizer;
    })().catch(function(err){
      sherpaPromise=null;sherpaRecognizer=null;
      throw err;
    });
    return sherpaPromise;
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

  function beeEditDistance(a,b){
    a=String(a||'');b=String(b||'');
    var prev=[],cur=[],i,j;
    for(j=0;j<=b.length;j++)prev[j]=j;
    for(i=1;i<=a.length;i++){
      cur=[i];
      for(j=1;j<=b.length;j++){
        cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      }
      prev=cur;
    }
    return prev[b.length];
  }

  function beeNear(word,target,max){
    word=String(word||'').toUpperCase();target=String(target||'').toUpperCase();
    return !!word&&beeEditDistance(word,target)<=max;
  }

  function repairInspectionSequence(raw){
    var t=String(raw||'').trim().split(/\s+/).filter(Boolean);
    if(!t.length)return '';

    function findSeq(seq,from,to){
      from=Math.max(0,from||0);to=to==null?t.length:Math.min(t.length,to);
      outer:for(var i=from;i<=to-seq.length;i++){
        for(var j=0;j<seq.length;j++)if(t[i+j]!==seq[j])continue outer;
        return i;
      }
      return -1;
    }
    function quality(v){return ['GOOD','FAIR','POOR','EXCELLENT'].indexOf(v)>=0;}
    function broodLike(v){return ['BROOD','BRUTE','BREW','BREED'].indexOf(v)>=0||beeNear(v,'BROOD',2);}
    function storeValue(v){return ['HIGH','MEDIUM','LOW'].indexOf(v)>=0;}
    function blockedHoneySpan(a){
      var bad=['POLLEN','FOOD','TEMPERAMENT','CALM','NORMAL','DEFENSIVE','AGGRESSIVE','FEEDING','PESTS','DISEASE'];
      return a.some(function(x){return bad.indexOf(x)>=0;});
    }

    // Order-independent recovery: these local anchors do not depend on the
    // standard Inspection sentence order.

    // 1) Bare QUEEN between field boundaries: Sherpa sometimes drops "seen"
    // completely. Do not infer Seen when a negation or Queen Cells is present.
    for(var uq=0;uq<t.length;uq++){
      if(t[uq]!=='QUEEN')continue;
      var qprev=t[uq-1]||'',qnext=t[uq+1]||'';
      if(qnext==='CELL'||qnext==='CELLS')continue;
      if(['NO','NOT','NEVER','WITHOUT'].indexOf(qprev)>=0||['NOT','ABSENT'].indexOf(qnext)>=0)continue;
      if(qnext==='SEEN'||qnext==='PRESENT'||qnext==='SPOTTED')continue;
      if(qnext==='NO'||qnext==='COLONY'||qnext==='EGGS'||qnext==='LARVAE'||
         qnext==='BROOD'||qnext==='BRUTE'||qnext==='HONEY'||qnext==='POLLEN'||
         qnext==='SWARM'||qnext==='SWARMING'||qnext===''){
        t.splice(uq+1,0,'SEEN');
        break;
      }
    }

    // 2) Eggs/Larvae PRESENT slots: if one is already known and there is one
    // other unknown "... PRESENT" observation, recover the missing counterpart
    // regardless of where it appears in the sentence.
    var hasEggs=findSeq(['EGGS','PRESENT'],0)>=0;
    var hasLarvae=findSeq(['LARVAE','PRESENT'],0)>=0;
    var unknownPresent=[];
    var reservedPresent=['QUEEN','CELLS','SWARM','SWARMING','PESTS','DISEASE','TREATMENT'];
    for(var up=1;up<t.length;up++){
      if(t[up]!=='PRESENT')continue;
      var before=t[up-1];
      if(before==='EGGS'||before==='LARVAE'||reservedPresent.indexOf(before)>=0)continue;
      unknownPresent.push(up);
    }
    if(hasEggs&&!hasLarvae&&unknownPresent.length===1)t[unknownPresent[0]-1]='LARVAE';
    if(hasLarvae&&!hasEggs&&unknownPresent.length===1)t[unknownPresent[0]-1]='EGGS';

    // 3) Brood pattern quality: use BROOD-like acoustic anchor + a nearby
    // quality word. The middle ASR tokens may vary freely.
    for(var bq=0;bq<t.length;bq++){
      if(!quality(t[bq]))continue;
      var bs=-1;
      for(var bk=bq-1;bk>=Math.max(0,bq-4);bk--){
        if(['COLONY','HONEY','POLLEN','QUEEN','EGGS','LARVAE','NO'].indexOf(t[bk])>=0)break;
        if(broodLike(t[bk])){bs=bk;break;}
      }
      if(bs>=0){
        t.splice(bs,bq-bs+1,'BROOD','PATTERN',t[bq]);
        break;
      }
    }

    // 4) Honey stores value: "HONEY" itself may become AND HE / CONNIE, and
    // STORES may become S DOORS. A stores-like acoustic anchor plus a valid
    // value is sufficient unless the local context explicitly says POLLEN/FOOD.
    for(var sv=0;sv<t.length;sv++){
      if(!storeValue(t[sv]))continue;
      var ss=-1,se=-1;
      if(sv>=1&&(t[sv-1]==='STORE'||t[sv-1]==='STORES'||beeNear(t[sv-1],'STORES',3))){
        ss=sv-1;se=sv-1;
      }else if(sv>=2&&t[sv-2]==='S'&&(t[sv-1]==='DOOR'||t[sv-1]==='DOORS'||beeNear(t[sv-1],'STORES',3))){
        ss=sv-2;se=sv-1;
      }
      if(ss<0)continue;
      var local=t.slice(Math.max(0,ss-3),ss);
      if(blockedHoneySpan(local))continue;
      var honey=-1;
      for(var hk=ss-1;hk>=Math.max(0,ss-3);hk--)if(t[hk]==='HONEY'){honey=hk;break;}
      if(honey>=0){
        t.splice(honey,sv-honey,'HONEY','STORES');
      }else{
        t.splice(ss,se-ss+1,'HONEY','STORES');
      }
      break;
    }

    // When Queen is immediately followed by a confirmed Eggs observation,
    // a dropped/mangled "seen" token can be recovered without treating
    // unrelated queen mentions as Queen Seen.
    var eggs=findSeq(['EGGS','PRESENT'],0);
    if(eggs>0){
      for(var q=eggs-1;q>=Math.max(0,eggs-3);q--){
        if(t[q]==='QUEEN'&&t[q+1]!=='CELLS'){
          if(q+1===eggs)t.splice(q+1,0,'SEEN');
          else if(t[q+1]!=='SEEN')t.splice(q+1,eggs-q-1,'SEEN');
          break;
        }
      }
    }

    // In the standard Queen -> Eggs -> Larvae -> Brood -> Colony sequence,
    // use the two PRESENT observations as semantic slots. Unlike the old
    // regex patches, this does not care whether Sherpa says EX/MOTHER/LOVELY/
    // MARVET/etc. The surrounding Inspection structure is the evidence.
    var qs=findSeq(['QUEEN','SEEN'],0);
    var colony=findSeq(['COLONY','STRENGTH'],0);
    if(colony>0){
      var presents=[];
      for(var p=0;p<colony;p++)if(t[p]==='PRESENT')presents.push(p);

      // If Sherpa mangled "Queen seen" but there are two observation slots
      // before Colony strength, recover the whole leading slot only when a
      // queen-like anchor is actually present.
      if(qs<0&&presents.length>=2){
        var qa=-1;
        for(var qx=0;qx<presents[0];qx++){
          if(t[qx]==='QUEEN'||/^QUEEN/.test(t[qx])||beeNear(t[qx],'QUEEN',2)){qa=qx;break;}
        }
        if(qa>=0&&t[Math.max(0,qa-1)]!=='NO'){
          t.splice(qa,presents[0]-qa+1,'QUEEN','SEEN','EGGS','PRESENT');
        }
      }

      qs=findSeq(['QUEEN','SEEN'],0);
      colony=findSeq(['COLONY','STRENGTH'],Math.max(0,qs+2));
      presents=[];
      for(var p2=Math.max(0,qs+2);p2<colony;p2++)if(t[p2]==='PRESENT')presents.push(p2);

      var e=findSeq(['EGGS','PRESENT'],Math.max(0,qs+2),colony);
      if(e<0&&presents.length>=2&&presents[0]>0)t[presents[0]-1]='EGGS';

      colony=findSeq(['COLONY','STRENGTH'],Math.max(0,qs+2));
      presents=[];
      for(var p3=Math.max(0,qs+2);p3<colony;p3++)if(t[p3]==='PRESENT')presents.push(p3);
      var l=findSeq(['LARVAE','PRESENT'],Math.max(0,qs+2),colony);
      if(l<0&&presents.length>=2&&presents[1]>0)t[presents[1]-1]='LARVAE';
    }

    // Recover Brood pattern + quality from its stable position immediately
    // before Colony strength. It accepts variable near-speech length instead
    // of hard-coding "parting", "pot and", "putting", etc.
    var larvae=findSeq(['LARVAE','PRESENT'],0);
    colony=findSeq(['COLONY','STRENGTH'],Math.max(0,larvae+2));
    if(larvae>=0&&colony>larvae+2&&findSeq(['BROOD','PATTERN'],larvae+2,colony)<0){
      var start=-1,end=-1,qv='';
      for(var bi=larvae+2;bi<colony;bi++){
        if(start<0&&broodLike(t[bi]))start=bi;
        if(start>=0&&quality(t[bi])&&bi-start<=4){end=bi;qv=t[bi];break;}
      }
      if(start<0){
        for(var qi=colony-1;qi>=Math.max(larvae+2,colony-4);qi--){
          if(quality(t[qi])){start=larvae+2;end=qi;qv=t[qi];break;}
        }
      }
      if(start>=0&&end>=start&&qv){
        t.splice(start,end-start+1,'BROOD','PATTERN',qv);
      }
    }

    // Recover Honey stores from the bounded slot after Colony strength and
    // before No queen cells. Pollen/temperament/etc. explicitly block this
    // inference to avoid cross-field hallucination.
    colony=findSeq(['COLONY','STRENGTH'],0);
    var qcells=findSeq(['NO','QUEEN','CELLS'],Math.max(0,colony+2));
    if(colony>=0&&qcells>colony){
      var hs=findSeq(['HONEY','STORES'],colony+2,qcells);
      if(hs<0){
        var hstart=colony+2;
        if(hstart<qcells&&numberOf(t[hstart])!==null)hstart++;
        var hseg=t.slice(hstart,qcells);
        if(hseg.length>=1&&hseg.length<=5&&!blockedHoneySpan(hseg)){
          var hv='';
          for(var hi=hseg.length-1;hi>=0;hi--)if(storeValue(hseg[hi])){hv=hseg[hi];break;}
          if(hv)t.splice(hstart,qcells-hstart,'HONEY','STORES',hv);
        }
      }
    }

    return t.join(' ');
  }

  function normalizeBeeSpeech(raw){
    var s=T(raw).toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
    if(!s)return '';
    var t=s.split(' '),i,w,n;

    function oneOf(v,list){return list.indexOf(v)>=0;}

    for(i=0;i<t.length;i++){
      w=t[i];n=t[i+1]||'';

      if(w==='NOT'&&n&&
         (oneOf(n,['SEN','SIN','SCENE'])||beeNear(n,'SEEN',1))){
        t[i+1]='SEEN';n='SEEN';
      }

      if(w==='QUEEN'&&n&&n!=='CELL'&&n!=='CELLS'){
        if(oneOf(n,['SEN','SIN','SCENE','SAVE','SAME','SAY'])||beeNear(n,'SEEN',1))t[i+1]='SEEN';
      }

      if(n==='PRESENT'){
        if(oneOf(w,['EX','X','EG','EGG','EGGS','AX'])||beeNear(w,'EGGS',1))t[i]='EGGS';
        else if(oneOf(w,['MARVAIS','MARVET','MARVEY','LARVEY','LARVA','LARVAE','LOVELY','LOVLY'])||beeNear(w,'LARVAE',2))t[i]='LARVAE';
      }

      if(n==='NOT'&&t[i+2]==='SEEN'){
        if(oneOf(w,['EX','X','EG','EGG','EGGS','AX'])||beeNear(w,'EGGS',1))t[i]='EGGS';
        else if(oneOf(w,['MARVAIS','MARVET','MARVEY','LARVEY','LARVA','LARVAE','LOVELY','LOVLY','MOTHER'])||beeNear(w,'LARVAE',2))t[i]='LARVAE';
      }

      if((w==='BROOD'||oneOf(w,['BRUTE','BREW','BREED'])||beeNear(w,'BROOD',1))&&n){
        if(oneOf(n,['PUTTING','PUNTING','PATTON','PATERN','PATTERN'])||beeNear(n,'PATTERN',2)){
          t[i]='BROOD';t[i+1]='PATTERN';
        }
      }

      if(w==='COLONY'&&(t[i+1]==='STRENGTH'||beeNear(t[i+1],'STRENGTH',2))){
        t[i+1]='STRENGTH';
        if(oneOf(t[i+2],['EGG','ATE','AID','EIGHT']))t[i+2]='EIGHT';
      }

      if(w==='HONEY'&&(t[i+1]==='STORE'||t[i+1]==='STORES'||beeNear(t[i+1],'STORES',1))){
        t[i+1]='STORES';
        if(oneOf(t[i+2],['MEDIA','MEDIUM'])||beeNear(t[i+2],'MEDIUM',2))t[i+2]='MEDIUM';
      }

      if(w==='HONEY'&&t[i+1]==='S'&&
         (oneOf(t[i+2],['DOOR','DOORS'])||beeNear(t[i+2],'STORES',2))){
        t.splice(i+1,2,'STORES');
        if(oneOf(t[i+2],['MEDIA','MEDIUM'])||beeNear(t[i+2],'MEDIUM',2))t[i+2]='MEDIUM';
      }

      if(w==='NO'&&t[i+1]==='QUEEN'&&t[i+2]){
        if(oneOf(t[i+2],['CELL','CELLS','SELL','SELLS','SALES'])||beeNear(t[i+2],'CELLS',2))t[i+2]='CELLS';
      }

      if(w==='NO'&&t[i+1]&&t[i+2]){
        if(oneOf(t[i+1],['SWARM','SWARMING'])&&
           (oneOf(t[i+2],['SIGN','SIGNS','SINES'])||beeNear(t[i+2],'SIGNS',2))){
          t[i+1]='SWARM';t[i+2]='SIGNS';
        }
      }
    }

    s=t.join(' ');
    s=s.replace(/\b(?:MINE|WINE|LINE|FINE|QUEENS?)\s+(?:SAVE|SAME|SAY|SEEN|SCENE|SEN)\b/g,'QUEEN SEEN');
    s=s.replace(/\bQUEEN\s+(?:IT\s+S|ITS|IS)\s+NOT\s+SEEN\b/g,'QUEEN NOT SEEN');
    return repairInspectionSequence(s).trim();
  }

  var voskPromise=null,voskModel=null;
  var VOSK_SCRIPT='https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js';
  var VOSK_MODEL='https://cdn.jsdelivr.net/gh/ccoreilly/vosk-browser@gh-pages/models/vosk-model-small-en-us-0.15.tar.gz';
  var VOSK_GRAMMAR=(function(){
    var g=[
      'queen seen','queen not seen',
      'eggs present','eggs not seen',
      'larvae present','larvae not seen',
      'brood pattern excellent','brood pattern good','brood pattern fair','brood pattern poor',
      'honey stores high','honey stores medium','honey stores low',
      'no queen cells','queen cells present',
      'no swarm signs','swarm signs present'
    ];
    ['zero','one','two','three','four','five','six','seven','eight','nine','ten'].forEach(function(n){
      g.push('colony strength '+n);
    });
    g.push('[unk]');
    return JSON.stringify(g);
  })();

  function loadExternalScript(src,label){
    return new Promise(function(resolve,reject){
      var old=document.querySelector('script[data-hd-external="'+src+'"]');
      if(old&&old.dataset.loaded==='1'){resolve();return;}
      var s=old||document.createElement('script');
      function ok(){s.dataset.loaded='1';resolve();}
      function bad(){reject(new Error((label||'External script')+' could not be loaded.'));}
      s.addEventListener('load',ok,{once:true});
      s.addEventListener('error',bad,{once:true});
      if(!old){
        s.src=src;s.async=true;s.crossOrigin='anonymous';s.dataset.hdExternal=src;
        document.head.appendChild(s);
      }
    });
  }

  function waitFor(promise,ms,label){
    return new Promise(function(resolve,reject){
      var done=false;
      var timer=setTimeout(function(){
        if(done)return;done=true;reject(new Error((label||'Operation')+' timed out.'));
      },ms);
      Promise.resolve(promise).then(function(v){
        if(done)return;done=true;clearTimeout(timer);resolve(v);
      },function(e){
        if(done)return;done=true;clearTimeout(timer);reject(e);
      });
    });
  }

  async function loadVoskModel(){
    if(voskModel)return voskModel;
    if(voskPromise)return voskPromise;
    voskPromise=(async function(){
      await loadExternalScript(VOSK_SCRIPT,'Vosk local grammar engine');
      if(!window.Vosk||typeof window.Vosk.createModel!=='function')throw new Error('Vosk browser engine is unavailable.');
      var model=await window.Vosk.createModel(VOSK_MODEL);
      if(!model||!model.ready)throw new Error('Vosk grammar model did not initialize.');
      voskModel=model;
      return model;
    })().catch(function(e){
      voskPromise=null;voskModel=null;throw e;
    });
    return voskPromise;
  }

  async function voskStructuredPass(audio){
    var model=await waitFor(loadVoskModel(),90000,'Vosk grammar model');
    return await new Promise(function(resolve,reject){
      var rec=null,parts=[],finished=false,quietTimer=null,hardTimer=null,finalRequested=false;
      function clean(){
        clearTimeout(quietTimer);clearTimeout(hardTimer);
        try{if(rec)rec.remove();}catch(e){}
      }
      function finish(){
        if(finished)return;finished=true;clean();
        resolve(parts.join(' ').replace(/\s+/g,' ').trim());
      }
      function fail(e){
        if(finished)return;finished=true;clean();reject(e instanceof Error?e:new Error(String(e||'Vosk grammar failed.')));
      }
      function schedule(){
        clearTimeout(quietTimer);
        quietTimer=setTimeout(finish,500);
      }
      try{
        rec=new model.KaldiRecognizer(16000,VOSK_GRAMMAR);
        rec.on('result',function(msg){
          var t=T(msg&&msg.result&&msg.result.text);
          if(t)parts.push(t);
          if(finalRequested)schedule();
        });
        rec.on('error',function(msg){fail(new Error((msg&&msg.error)||'Vosk grammar recognition failed.'));});
        var chunk=3200;
        for(var i=0;i<audio.length;i+=chunk){
          rec.acceptWaveformFloat(audio.subarray(i,Math.min(audio.length,i+chunk)),16000);
        }
        rec.acceptWaveformFloat(new Float32Array(16000),16000);
        finalRequested=true;
        rec.retrieveFinalResult();
        hardTimer=setTimeout(finish,20000);
      }catch(e){fail(e);}
    });
  }

  async function transcribe(blob,w){
    var rec=await loadSherpa(w),audio=await audioTo16k(blob),text='';
    status(w,'Recognizing beekeeping terms on this device…','idle');
    var stream=rec.createStream(),chunk=3200;
    try{
      for(var i=0;i<audio.length;i+=chunk){
        stream.acceptWaveform(16000,audio.subarray(i,Math.min(audio.length,i+chunk)));
        while(rec.isReady(stream))rec.decode(stream);
        if(i%(chunk*8)===0)await new Promise(function(r){setTimeout(r,0);});
      }
      if(stream.inputFinished)stream.inputFinished();
      var guard=0;
      while(rec.isReady(stream)&&guard++<10000)rec.decode(stream);
      var result=rec.getResult(stream);text=T(result&&result.text);
      if(!text)throw new Error('No speech was detected. Please try again.');
    }finally{try{if(stream&&stream.free)stream.free();}catch(e){}}

    text=normalizeBeeSpeech(text);
    structuredTranscript='';
    var generation=++structuredGeneration;

    // Vosk is deliberately non-blocking. Sherpa text returns immediately;
    // grammar fields are merged later only if this is still the same recording.
    (async function(){
      await new Promise(function(r){setTimeout(r,0);});
      try{
        var structured=normalizeBeeSpeech(await voskStructuredPass(audio));
        if(generation!==structuredGeneration||cancelled||!document.body.contains(w))return;
        structuredTranscript=structured;
        review(w);
      }catch(e){
        if(generation===structuredGeneration)console.warn('Vosk structured pass skipped:',e);
      }
    })();

    return text;
  }

  function stop(){
    if(recorder&&listening){
      try{recorder.stop();}catch(e){}
    }
  }
  function close(){
    cancelled=true;
    if(recorder&&listening){try{recorder.stop();}catch(e){}}
    structuredGeneration++;cleanupMedia();recorder=null;listening=false;transcribing=false;structuredTranscript='';audioChunks=[];
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
    var source=[T(a.value),T(structuredTranscript)].filter(Boolean).join(' ');
    var p=parse(source),html='<div class="hd-review-head"><b>Detected observations</b><span>'+p.fields.length+' field'+(p.fields.length===1?'':'s')+'</span></div>';
    if(p.fields.length){
      html+='<div class="hd-fields">'+p.fields.map(function(x,i){return '<label class="hd-field"><input type="checkbox" data-det="'+i+'" checked><span>'+E(x.label)+'</span><b>'+E(x.value)+'</b></label>';}).join('')+'</div>';
    }else html+='<div class="hd-empty">No structured Inspection fields detected yet. The transcript can still be added to Notes.</div>';
    if(p.formalMention)html+='<div class="hd-formal">Varroa or treatment wording was detected. It stays in Notes only. Formal Varroa Test and Treatment records are not changed here.</div>';
    box.innerHTML=html;
  }

  async function start(w){
    if(listening||transcribing)return;
    cancelled=false;
    transcribing=true;buttons(w);
    try{await loadSherpa(w);}catch(e){transcribing=false;buttons(w);status(w,e&&e.message?e.message:'Local voice model could not be loaded.','err');return;}
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
      recorder.onstop=async function(){
        listening=false;cleanupMedia();
        if(cancelled){audioChunks=[];return;}
        transcribing=true;buttons(w);status(w,'Transcribing…','idle');
        try{
          var blob=new Blob(audioChunks,{type:(recorder&&recorder.mimeType)||type||'audio/webm'});
          audioChunks=[];
          var text=await transcribe(blob,w);
          if(area){
            area.value=[finalTranscript,text].filter(Boolean).join(finalTranscript&&text?'\n':'').trim();
          }
          review(w);status(w,'Review the transcript and detected fields.','idle');
        }catch(err){
          console.error('Structured voice transcription failed',err);
          status(w,err&&err.message?err.message:'Voice transcription failed.','err');
        }finally{
          transcribing=false;recorder=null;buttons(w);
        }
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
    loadVoskModel().catch(function(e){console.warn('Vosk background preload skipped:',e);});
    var area=w.querySelector('.hd-voice-transcript');if(area)area.addEventListener('input',function(){structuredGeneration++;structuredTranscript='';review(w);});
    w.querySelector('.hd-voice-close').onclick=close;w.querySelector('.hd-cancel').onclick=close;w.querySelector('.hd-start').onclick=function(){start(w);};w.querySelector('.hd-stop').onclick=stop;
    w.addEventListener('click',function(e){if(e.target===w)close();});
    w.querySelector('.hd-apply').onclick=function(){
      stop();
      var tr=T(area&&area.value);if(!tr){if(typeof toast==='function')toast('Record or enter an inspection note first');return;}
      var p=parse([tr,T(structuredTranscript)].filter(Boolean).join(' ')),selected=new Set(Array.from(w.querySelectorAll('[data-det]:checked')).map(function(x){return Number(x.dataset.det);}));
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
  window.openStructuredVoiceInspection=openVoice;
  window.__HD_STRUCTURED_VOICE_VERSION__='2.12.1-vosk-nonblocking';
})();