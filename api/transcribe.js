/* Vercel Serverless Function: HiveDash voice transcription
   Audio is forwarded to OpenAI for transcription and is not persisted here.
*/
const RATE_WINDOW_MS=10*60*1000;
const RATE_MAX=12;
const rate=new Map();

function send(res,status,obj){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(obj));
}
function clientIp(req){
  return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
}
function rateOk(req){
  const now=Date.now(),ip=clientIp(req),row=rate.get(ip);
  if(!row||now-row.start>RATE_WINDOW_MS){rate.set(ip,{start:now,count:1});return true;}
  row.count+=1;return row.count<=RATE_MAX;
}
function previewAllowed(req){
  if(process.env.VERCEL_ENV!=='preview')return false;
  const host=String(req.headers.host||'').toLowerCase();
  return host.includes('voice-inspection-preview-local');
}
async function authenticated(req){
  if(previewAllowed(req))return true;
  const auth=String(req.headers.authorization||'');
  if(!/^Bearer\s+\S+$/i.test(auth))return false;
  const url=process.env.SUPABASE_URL||'https://ydrawqnkwdvfhauansdf.supabase.co';
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_6VC3g90SrIM5s7bI-CIwZQ_tbmk_h4B';
  try{
    const r=await fetch(url+'/auth/v1/user',{headers:{Authorization:auth,apikey:key}});
    return r.ok;
  }catch(_){return false;}
}
async function readBody(req,maxBytes){
  if(Buffer.isBuffer(req.body)){
    if(req.body.length>maxBytes)throw new Error('too_large');
    return req.body;
  }
  if(typeof req.body==='string'){
    const b=Buffer.from(req.body);
    if(b.length>maxBytes)throw new Error('too_large');
    return b;
  }
  return await new Promise((resolve,reject)=>{
    const chunks=[];let total=0;
    req.on('data',chunk=>{
      total+=chunk.length;
      if(total>maxBytes){reject(new Error('too_large'));try{req.destroy();}catch(_){}return;}
      chunks.push(chunk);
    });
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
function extFor(type){
  const t=String(type||'').toLowerCase();
  if(t.includes('mp4')||t.includes('m4a'))return 'm4a';
  if(t.includes('ogg'))return 'ogg';
  if(t.includes('wav'))return 'wav';
  if(t.includes('mpeg')||t.includes('mp3'))return 'mp3';
  return 'webm';
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
  if(!rateOk(req))return send(res,429,{error:'rate_limited'});
  if(!(await authenticated(req)))return send(res,401,{error:'unauthorized'});

  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  const allowed=['audio/webm','audio/mp4','audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/m4a'];
  if(!allowed.includes(type))return send(res,415,{error:'unsupported_audio_type'});

  let audio;
  try{audio=await readBody(req,8*1024*1024);}
  catch(e){return send(res,e&&e.message==='too_large'?413:400,{error:e&&e.message==='too_large'?'audio_too_large':'invalid_audio'});}
  if(!audio||audio.length<200)return send(res,400,{error:'empty_audio'});

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return send(res,503,{error:'transcription_not_configured'});

  try{
    const form=new FormData();
    const blob=new Blob([audio],{type:type});
    form.append('file',blob,'inspection.'+extFor(type));
    form.append('model',process.env.OPENAI_TRANSCRIBE_MODEL||'gpt-4o-transcribe');
    form.append('language','en');
    form.append('prompt','Beekeeping hive inspection. Likely terms include queen, queen cells, eggs, larvae, brood pattern, brood strength, colony strength, frames, temperament, honey stores, pollen stores, feeding, pests, small hive beetle, wax moth, disease, swarming, supers, Varroa, mite count, oxalic acid, formic acid, Apivar.');

    const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{
      method:'POST',
      headers:{Authorization:'Bearer '+apiKey},
      body:form
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      console.error('HiveDash transcription failed',r.status,data&&data.error&&data.error.message);
      return send(res,502,{error:'transcription_failed'});
    }
    const text=String(data&&data.text||'').trim();
    if(!text)return send(res,422,{error:'no_speech_detected'});
    return send(res,200,{text:text});
  }catch(err){
    console.error('HiveDash transcription exception',err);
    return send(res,502,{error:'transcription_failed'});
  }
};