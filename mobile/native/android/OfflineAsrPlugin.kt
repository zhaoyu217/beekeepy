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

    // Debug-only fixture decoder used by Android CI to prove real Sherpa inference
    // and the same native event bridge used by live microphone recognition.
    @PluginMethod
    fun testDecodeBundledAudio(call: PluginCall) {
        if ((context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("ASR fixture decoding is available only in debug builds", "DEBUG_ONLY")
            return
        }
        val hotwords = call.getString("hotwords") ?: listOf(
            "QUEEN", "QUEEN SEEN", "EGGS", "LARVAE", "BROOD PATTERN",
            "COLONY STRENGTH", "HONEY STORES", "QUEEN CELLS", "SWARM SIGNS"
        ).joinToString("\n")
        thread(start = true, name = "HiveAsrFixtureDecode") {
            var fixtureEngine: SherpaInspectionEngine? = null
            try {
                fixtureEngine = SherpaInspectionEngine(context) { event, data ->
                    activity.runOnUiThread { notifyListeners(event, data, true) }
                }
                val result = fixtureEngine.transcribeBundledTestAudio(
                    "asr-test-inspection.wav",
                    hotwords,
                )
                activity.runOnUiThread {
                    call.resolve(result)
                    fixtureEngine?.release()
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject(
                        e.message ?: "Bundled offline ASR test audio could not be decoded",
                        "ASR_TEST_DECODE_FAILED",
                        e,
                    )
                    fixtureEngine?.release()
                }
            }
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

    fun transcribeBundledTestAudio(assetName: String, hotwords: String): JSObject {
        check(!running.get()) { "The live microphone recognizer is already running" }
        val bytes = context.assets.open(assetName).use { it.readBytes() }
        val buffer = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        check(bytes.size >= 44 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" &&
            String(bytes, 8, 4, Charsets.US_ASCII) == "WAVE") {
            "ASR fixture is not a valid RIFF/WAVE file"
        }

        var audioFormat = 0
        var channels = 0
        var sampleRate = 0
        var bitsPerSample = 0
        var dataOffset = -1
        var dataSize = -1
        var offset = 12
        while (offset + 8 <= bytes.size) {
            val chunkId = String(bytes, offset, 4, Charsets.US_ASCII)
            val chunkSize = buffer.getInt(offset + 4)
            val chunkStart = offset + 8
            check(chunkSize >= 0 && chunkStart.toLong() + chunkSize <= bytes.size.toLong()) {
                "ASR fixture contains an invalid WAV chunk"
            }
            when (chunkId) {
                "fmt " -> if (chunkSize >= 16) {
                    audioFormat = buffer.getShort(chunkStart).toInt() and 0xffff
                    channels = buffer.getShort(chunkStart + 2).toInt() and 0xffff
                    sampleRate = buffer.getInt(chunkStart + 4)
                    bitsPerSample = buffer.getShort(chunkStart + 14).toInt() and 0xffff
                }
                "data" -> {
                    dataOffset = chunkStart
                    dataSize = chunkSize
                }
            }
            offset = chunkStart + chunkSize + (chunkSize and 1)
        }
        check(audioFormat == 1 && channels == 1 && bitsPerSample == 16 &&
            sampleRate == SAMPLE_RATE && dataOffset >= 0 && dataSize > 0 && dataSize % 2 == 0) {
            "ASR fixture must be mono 16-bit PCM at 16000 Hz"
        }

        val samples = FloatArray(dataSize / 2) { index ->
            buffer.getShort(dataOffset + index * 2).toFloat() / 32768.0f
        }
        val testStream = recognizer.createStream(hotwords)
        val segments = mutableListOf<String>()
        var lastPartial = ""
        try {
            var cursor = 0
            while (cursor < samples.size) {
                val count = minOf(1600, samples.size - cursor)
                val chunk = FloatArray(count) { samples[cursor + it] }
                testStream.acceptWaveform(chunk, sampleRate)
                while (recognizer.isReady(testStream)) recognizer.decode(testStream)

                val partial = recognizer.getResult(testStream).text.trim()
                if (partial.isNotEmpty() && partial != lastPartial) {
                    lastPartial = partial
                    emit("asrPartial", JSObject().put("text", partial))
                }

                if (recognizer.isEndpoint(testStream)) {
                    val finalText = recognizer.getResult(testStream).text.trim()
                    if (finalText.isNotEmpty()) {
                        segments.add(finalText)
                        emit("asrFinal", JSObject().put("text", finalText))
                    }
                    recognizer.reset(testStream)
                    lastPartial = ""
                }
                cursor += count
            }

            testStream.inputFinished()
            while (recognizer.isReady(testStream)) recognizer.decode(testStream)
            val tail = recognizer.getResult(testStream).text.trim()
            if (tail.isNotEmpty()) {
                segments.add(tail)
                emit("asrFinal", JSObject().put("text", tail))
            }

            val transcript = segments.joinToString(" ").trim()
            check(transcript.isNotEmpty()) { "Sherpa-ONNX returned an empty transcript for the speech fixture" }
            return JSObject()
                .put("text", transcript)
                .put("sampleRate", sampleRate)
                .put("sampleCount", samples.size)
                .put("durationSeconds", samples.size.toDouble() / sampleRate)
        } finally {
            testStream.release()
        }
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
