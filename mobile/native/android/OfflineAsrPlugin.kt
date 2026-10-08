package app.hivefield.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizer
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@CapacitorPlugin(
    name = "OfflineAsr",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        )
    ]
)
class OfflineAsrPlugin : Plugin() {
    private var engine: SherpaInspectionEngine? = null

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ok = SherpaInspectionEngine.assetsPresent(context)
        val out = JSObject()
        out.put("available", ok)
        if (!ok) out.put("reason", "offline-model-missing")
        call.resolve(out)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission")
            return
        }
        startWithPermission(call)
    }

    @PermissionCallback
    private fun microphonePermission(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startWithPermission(call)
        } else {
            call.reject("Microphone permission is required", "MIC_PERMISSION_DENIED")
        }
    }

    private fun startWithPermission(call: PluginCall) {
        if (!SherpaInspectionEngine.assetsPresent(context)) {
            call.reject("Offline ASR model is not bundled", "MODEL_MISSING")
            return
        }
        if (engine == null) {
            engine = SherpaInspectionEngine(context) { event, data ->
                activity.runOnUiThread { notifyListeners(event, data, true) }
            }
        }
        val hotwords = call.getString("hotwords") ?: ""
        try {
            engine!!.start(hotwords)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "Offline ASR could not start", "ASR_START_FAILED", e)
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        engine?.stop(false)
        call.resolve()
    }

    @PluginMethod
    fun abort(call: PluginCall) {
        engine?.stop(true)
        call.resolve()
    }

    override fun handleOnDestroy() {
        engine?.release()
        engine = null
        super.handleOnDestroy()
    }
}

private class SherpaInspectionEngine(
    private val context: Context,
    private val emit: (String, JSObject) -> Unit,
) {
    companion object {
        private const val SAMPLE_RATE = 16000
        private const val MODEL_DIR = "sherpa-onnx-streaming-zipformer-en-2023-06-26"

        fun assetsPresent(context: Context): Boolean {
            return try {
                context.assets.open("$MODEL_DIR/tokens.txt").close()
                context.assets.open("$MODEL_DIR/encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx").close()
                context.assets.open("$MODEL_DIR/decoder-epoch-99-avg-1-chunk-16-left-128.onnx").close()
                context.assets.open("$MODEL_DIR/joiner-epoch-99-avg-1-chunk-16-left-128.onnx").close()
                context.assets.open("$MODEL_DIR/bpe.vocab").close()
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    private val recognizer: OnlineRecognizer
    private var stream: OnlineStream? = null
    private var recorder: AudioRecord? = null
    private var worker: Thread? = null
    private val running = AtomicBoolean(false)
    @Volatile private var aborting = false
    @Volatile private var lastPartial = ""

    init {
        val model = OnlineModelConfig(
            transducer = OnlineTransducerModelConfig(
                encoder = "$MODEL_DIR/encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
                decoder = "$MODEL_DIR/decoder-epoch-99-avg-1-chunk-16-left-128.onnx",
                joiner = "$MODEL_DIR/joiner-epoch-99-avg-1-chunk-16-left-128.onnx",
            ),
            tokens = "$MODEL_DIR/tokens.txt",
            numThreads = 2,
            provider = "cpu",
            modelType = "zipformer2",
            modelingUnit = "bpe",
            bpeVocab = "$MODEL_DIR/bpe.vocab",
        )
        val config = OnlineRecognizerConfig(
            featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
            modelConfig = model,
            enableEndpoint = true,
            decodingMethod = "modified_beam_search",
            maxActivePaths = 4,
            hotwordsScore = 2.0f,
        )
        recognizer = OnlineRecognizer(assetManager = context.assets, config = config)
    }

    fun start(hotwords: String) {
        if (running.get()) return
        check(
            ActivityCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        ) { "Microphone permission is not granted" }

        val min = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        check(min > 0) { "AudioRecord buffer could not be created" }

        stream?.release()
        stream = recognizer.createStream(hotwords)
        recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            min * 2,
        )
        check(recorder?.state == AudioRecord.STATE_INITIALIZED) { "Microphone could not initialize" }

        aborting = false
        lastPartial = ""
        running.set(true)
        recorder!!.startRecording()
        emit("asrState", JSObject().put("state", "recording"))

        worker = thread(start = true, name = "HiveOfflineAsr") {
            decodeLoop(min)
        }
    }

    private fun decodeLoop(minBufferBytes: Int) {
        val samples16 = ShortArray(maxOf(1600, minBufferBytes / 2))
        val s = stream ?: return
        try {
            while (running.get()) {
                val n = recorder?.read(samples16, 0, samples16.size) ?: break
                if (n <= 0) continue
                val samples = FloatArray(n) { samples16[it] / 32768.0f }
                s.acceptWaveform(samples, SAMPLE_RATE)
                while (recognizer.isReady(s)) recognizer.decode(s)

                val text = recognizer.getResult(s).text.trim()
                if (text.isNotEmpty() && text != lastPartial) {
                    lastPartial = text
                    emit("asrPartial", JSObject().put("text", text))
                }

                if (recognizer.isEndpoint(s)) {
                    if (!aborting && text.isNotEmpty()) {
                        emit("asrFinal", JSObject().put("text", text))
                    }
                    recognizer.reset(s)
                    lastPartial = ""
                }
            }

            if (!aborting) {
                s.inputFinished()
                while (recognizer.isReady(s)) recognizer.decode(s)
                val tail = recognizer.getResult(s).text.trim()
                if (tail.isNotEmpty()) emit("asrFinal", JSObject().put("text", tail))
            }
        } catch (e: Exception) {
            if (!aborting) {
                emit(
                    "asrError",
                    JSObject().put("code", "native-asr-runtime").put("message", e.message ?: "ASR runtime error")
                )
            }
        } finally {
            try { recorder?.stop() } catch (_: Exception) {}
            recorder?.release()
            recorder = null
            s.release()
            if (stream === s) stream = null
            running.set(false)
            emit("asrState", JSObject().put("state", "ended"))
        }
    }

    fun stop(abort: Boolean) {
        aborting = abort
        running.set(false)
        try { recorder?.stop() } catch (_: Exception) {}
    }

    fun release() {
        stop(true)
        try { worker?.join(800) } catch (_: Exception) {}
        worker = null
        stream?.release()
        stream = null
        recognizer.release()
    }
}
