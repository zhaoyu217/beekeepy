import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

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
      throw new Error("WebGPU is not available in this browser.");
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
        post("status", { message: `Loading local Whisper model (${attempt.label})…` });
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
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        transcriber = null;
        post("status", { message: `Whisper ${attempt.label} load failed; trying alternate precision…` });
      }
    }

    if (!transcriber) throw lastError || new Error("Whisper model could not be loaded.");
    post("ready", { dtype: selectedDtype, model: MODEL_ID });
    return transcriber;
  })().catch((error) => {
    loadingPromise = null;
    transcriber = null;
    throw error;
  });

  return loadingPromise;
}

async function transcribe(id, audio) {
  const pipe = await ensureLoaded();
  post("status", { message: "Transcribing locally with Whisper…" });

  const generateOptions = {
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
    no_repeat_ngram_size: 3,
  };

  // English-only Whisper models (.en) already have the language/task baked in.
  // Passing language/task to them causes Transformers.js to reject generation.
  if (!MODEL_ID.endsWith(".en")) {
    generateOptions.language = "english";
    generateOptions.task = "transcribe";
  }

  const output = await pipe(audio, generateOptions);

  post("result", {
    id,
    text: String(output?.text || "").trim(),
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
      const audio = data.audio instanceof Float32Array
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
