import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

env.allowLocalModels = false;

const MODEL_ID = "onnx-community/whisper-large-v3-turbo";
let transcriber = null;
let loadingPromise = null;
let selectedDtype = null;

function post(type, extra = {}) {
  self.postMessage({ type, ...extra });
}

function progress(p) {
  post("progress", { progress: p || {} });
}

async function ensureLoaded() {
  if (transcriber) return transcriber;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!self.navigator?.gpu) {
      throw new Error("This browser does not expose WebGPU to the worker.");
    }

    const attempts = [
      { label: "q4f16", dtype: "q4f16" },
      {
        label: "fp16/q4",
        dtype: {
          encoder_model: "fp16",
          decoder_model_merged: "q4",
        },
      },
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        post("status", {
          message: `Loading Whisper large-v3-turbo on WebGPU (${attempt.label})…`,
        });

        transcriber = await pipeline(
          "automatic-speech-recognition",
          MODEL_ID,
          {
            device: "webgpu",
            dtype: attempt.dtype,
            progress_callback: progress,
          },
        );

        selectedDtype = attempt.label;
        post("ready", { dtype: selectedDtype, model: MODEL_ID });
        return transcriber;
      } catch (error) {
        lastError = error;
        transcriber = null;
        post("status", {
          message: `WebGPU load with ${attempt.label} failed; trying the alternate precision…`,
        });
      }
    }

    throw lastError || new Error("Whisper model could not be loaded.");
  })().catch((error) => {
    loadingPromise = null;
    transcriber = null;
    throw error;
  });

  return loadingPromise;
}

async function transcribe(id, audio) {
  const pipe = await ensureLoaded();

  const common = {
    language: "english",
    task: "transcribe",
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
    no_repeat_ngram_size: 3,
  };

  post("status", { message: "Running standard Whisper transcription…" });
  const t0 = performance.now();
  const greedy = await pipe(audio, common);
  const greedyMs = Math.round(performance.now() - t0);
  const greedyText = String(greedy?.text || "").trim();

  post("status", { message: "Running 5-beam precision transcription…" });
  const t1 = performance.now();
  const beam = await pipe(audio, {
    ...common,
    num_beams: 5,
    do_sample: false,
    temperature: 0,
  });
  const beamMs = Math.round(performance.now() - t1);
  const beamText = String(beam?.text || "").trim();

  post("result", {
    id,
    text: beamText,
    greedyText,
    beamText,
    elapsedMs: beamMs,
    greedyMs,
    beamMs,
    dtype: selectedDtype,
  });
}

self.addEventListener("message", async (event) => {
  const data = event.data || {};
  try {
    if (data.type === "load") {
      await ensureLoaded();
      return;
    }

    if (data.type === "transcribe") {
      const audio =
        data.audio instanceof Float32Array
          ? data.audio
          : new Float32Array(data.audio || []);
      await transcribe(data.id, audio);
    }
  } catch (error) {
    post("error", {
      id: data.id,
      message: String(error?.message || error || "Unknown Whisper error"),
    });
  }
});
