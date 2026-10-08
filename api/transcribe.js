const SUPABASE_URL = "https://ydrawqnkwdvfhauansdf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6VC3g90SrIM5s7bI-CIwZQ_tbmk_h4B";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function extFor(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("mp4") || t.includes("m4a")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "webm";
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += b.length;
    if (size > MAX_AUDIO_BYTES) {
      const err = new Error("Audio is too large.");
      err.code = "AUDIO_TOO_LARGE";
      throw err;
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

async function verifySupabaseUser(token) {
  if (!token) return false;
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      "Authorization": "Bearer " + token,
      "apikey": SUPABASE_PUBLISHABLE_KEY
    }
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  try {
    if (!(await verifySupabaseUser(token))) {
      return json(res, 401, { error: "Authentication required" });
    }
  } catch (e) {
    console.error("Supabase auth validation failed", e);
    return json(res, 503, { error: "Authentication service unavailable" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: "SERVER_STT_NOT_CONFIGURED" });
  }

  const contentType = String(req.headers["content-type"] || "audio/webm").split(";")[0].trim() || "audio/webm";

  let audio;
  try {
    audio = await readBody(req);
  } catch (e) {
    if (e && e.code === "AUDIO_TOO_LARGE") return json(res, 413, { error: "Audio is too large" });
    console.error("Audio body read failed", e);
    return json(res, 400, { error: "Invalid audio upload" });
  }
  if (!audio.length) return json(res, 400, { error: "No audio received" });

  const form = new FormData();
  form.append("file", new Blob([audio], { type: contentType }), "inspection." + extFor(contentType));
  form.append("model", "gpt-transcribe");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("languages[]", "en");
  form.append(
    "prompt",
    "A beekeeper is describing direct observations during a hive inspection. Preserve exactly what was spoken."
  );
  [
    "queen", "queen seen", "queen cells", "eggs", "larvae",
    "brood pattern", "colony strength", "honey stores", "pollen stores",
    "swarm signs", "pests", "disease", "super", "Varroa"
  ].forEach((k) => form.append("keywords[]", k));

  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey },
      body: form,
      signal: AbortSignal.timeout(25000)
    });
  } catch (e) {
    console.error("STT upstream request failed", e);
    return json(res, 504, { error: "Transcription service timed out" });
  }

  let data = null;
  try { data = await upstream.json(); } catch (_) {}

  if (!upstream.ok) {
    const upstreamError = data && data.error ? data.error : {};
    console.error("STT upstream error", upstream.status, upstreamError.message || data);
    return json(res, 502, {
      error: "Transcription service failed",
      upstream_status: upstream.status,
      upstream_code: upstreamError.code || "",
      upstream_type: upstreamError.type || ""
    });
  }

  const text = String(data && data.text || "").trim();
  if (!text) return json(res, 502, { error: "Transcription returned no text" });

  return json(res, 200, {
    text,
    provider: "openai",
    model: "gpt-transcribe",
    server_ms: Date.now() - started
  });
}
