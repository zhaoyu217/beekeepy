import Foundation
import AVFoundation
import Capacitor
#if canImport(SherpaOnnx)
import SherpaOnnx
#elseif canImport(SherpaOnnxShared)
import SherpaOnnxShared
#else
#error("SherpaOnnx module not found. Add the sherpa-onnx Swift package/framework before building.")
#endif

@objc(OfflineAsrPlugin)
public class OfflineAsrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OfflineAsrPlugin"
    public let jsName = "OfflineAsr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abort", returnType: CAPPluginReturnPromise),
    ]

    private var engine: SherpaInspectionEngine?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": SherpaInspectionEngine.assetsPresent()
        ])
    }

    @objc func start(_ call: CAPPluginCall) {
        let hotwords = call.getString("hotwords") ?? ""
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            guard let self = self else { return }
            DispatchQueue.main.async {
                guard granted else {
                    call.reject("Microphone permission is required", "MIC_PERMISSION_DENIED")
                    return
                }
                do {
                    if self.engine == nil {
                        self.engine = try SherpaInspectionEngine { event, payload in
                            DispatchQueue.main.async {
                                self.notifyListeners(event, data: payload)
                            }
                        }
                    }
                    try self.engine?.start(hotwords: hotwords)
                    call.resolve()
                } catch {
                    call.reject(error.localizedDescription, "ASR_START_FAILED", error)
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        engine?.stop(abort: false)
        call.resolve()
    }

    @objc func abort(_ call: CAPPluginCall) {
        engine?.stop(abort: true)
        call.resolve()
    }

    deinit {
        engine?.stop(abort: true)
    }
}

private final class SherpaInspectionEngine {
    private static let modelDir = "sherpa-onnx-streaming-zipformer-en-2023-06-26"

    static func resource(_ name: String, _ ext: String) -> String? {
        let nested = "\(modelDir)/\(name)"
        if let p = Bundle.main.path(forResource: nested, ofType: ext) { return p }
        return Bundle.main.path(forResource: name, ofType: ext, inDirectory: modelDir)
    }

    static func assetsPresent() -> Bool {
        return resource("tokens", "txt") != nil
            && resource("encoder-epoch-99-avg-1-chunk-16-left-128.int8", "onnx") != nil
            && resource("decoder-epoch-99-avg-1-chunk-16-left-128", "onnx") != nil
            && resource("joiner-epoch-99-avg-1-chunk-16-left-128", "onnx") != nil
    }

    private let emit: (String, [String: Any]) -> Void
    private var recognizer: SherpaOnnxRecognizer
    private var audioEngine: AVAudioEngine?
    private var converter: AVAudioConverter?
    private var currentHotwords = ""
    private var lastPartial = ""
    private var running = false
    private var aborting = false

    init(emit: @escaping (String, [String: Any]) -> Void) throws {
        guard
            let tokens = Self.resource("tokens", "txt"),
            let encoder = Self.resource("encoder-epoch-99-avg-1-chunk-16-left-128.int8", "onnx"),
            let decoder = Self.resource("decoder-epoch-99-avg-1-chunk-16-left-128", "onnx"),
            let joiner = Self.resource("joiner-epoch-99-avg-1-chunk-16-left-128", "onnx")
        else {
            throw NSError(domain: "OfflineAsr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Offline ASR model is not bundled"])
        }

        self.emit = emit

        let modelConfig = sherpaOnnxOnlineModelConfig(
            tokens: tokens,
            transducer: sherpaOnnxOnlineTransducerModelConfig(
                encoder: encoder,
                decoder: decoder,
                joiner: joiner
            ),
            numThreads: 2,
            modelType: "zipformer2"
        )

        let featConfig = sherpaOnnxFeatureConfig(sampleRate: 16000, featureDim: 80)

        var config = sherpaOnnxOnlineRecognizerConfig(
            featConfig: featConfig,
            modelConfig: modelConfig,
            enableEndpoint: true,
            rule1MinTrailingSilence: 2.4,
            rule2MinTrailingSilence: 1.0,
            rule3MinUtteranceLength: 30,
            decodingMethod: "modified_beam_search",
            maxActivePaths: 4,
            hotwordsScore: 2.0
        )
        self.recognizer = SherpaOnnxRecognizer(config: &config)
    }

    func start(hotwords: String) throws {
        if running { return }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [])
        try session.setActive(true, options: [])

        currentHotwords = hotwords
        recognizer.reset(hotwords: hotwords)
        lastPartial = ""
        aborting = false

        let engine = AVAudioEngine()
        let input = engine.inputNode
        let bus = 0
        let inputFormat = input.outputFormat(forBus: bus)
        guard let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        ) else {
            throw NSError(domain: "OfflineAsr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to create 16 kHz audio format"])
        }
        guard let conv = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            throw NSError(domain: "OfflineAsr", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unable to create audio converter"])
        }
        converter = conv

        input.installTap(onBus: bus, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
            self?.consume(buffer: buffer, outputFormat: outputFormat)
        }

        self.audioEngine = engine
        try engine.start()
        running = true
        emit("asrState", ["state": "recording"])
    }

    private func consume(buffer: AVAudioPCMBuffer, outputFormat: AVAudioFormat) {
        guard running, let conv = converter else { return }

        let frameCapacity = AVAudioFrameCount(
            Double(buffer.frameLength) * outputFormat.sampleRate / buffer.format.sampleRate
        ) + 32
        guard let converted = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else { return }

        var available = true
        let inputBlock: AVAudioConverterInputBlock = { _, status in
            if available {
                available = false
                status.pointee = .haveData
                return buffer
            }
            status.pointee = .noDataNow
            return nil
        }

        var err: NSError?
        _ = conv.convert(to: converted, error: &err, withInputFrom: inputBlock)
        if err != nil { return }

        guard let channel = converted.floatChannelData?[0] else { return }
        let count = Int(converted.frameLength)
        if count == 0 { return }
        let samples = Array(UnsafeBufferPointer(start: channel, count: count))

        recognizer.acceptWaveform(samples: samples, sampleRate: 16000)
        while recognizer.isReady() { recognizer.decode() }

        let text = recognizer.getResult().text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty && text != lastPartial {
            lastPartial = text
            emit("asrPartial", ["text": text])
        }

        if recognizer.isEndpoint() {
            if !aborting && !text.isEmpty {
                emit("asrFinal", ["text": text])
            }
            recognizer.reset(hotwords: currentHotwords)
            lastPartial = ""
        }
    }

    func stop(abort: Bool) {
        guard running || audioEngine != nil else { return }
        aborting = abort
        running = false

        let tail = recognizer.getResult().text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !abort && !tail.isEmpty {
            emit("asrFinal", ["text": tail])
        }

        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
        converter = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        emit("asrState", ["state": "ended"])
    }
}
