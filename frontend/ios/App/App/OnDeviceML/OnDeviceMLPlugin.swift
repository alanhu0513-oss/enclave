import Foundation
import Capacitor
import Vision
import CoreML

@objc(OnDeviceMLPlugin)
public class OnDeviceMLPlugin: CAPPlugin {

    private var model: VNCoreMLModel?
    private var modelLoaded = false

    @objc func loadModel(_ call: CAPPluginCall) {
        let modelName = call.getString("modelName") ?? "xceptionnet"

        // Try to find the model in the app bundle
        guard let modelURL = Bundle.main.url(forResource: withExtension: "mlmodel", subdirectory: modelName) ??
                            Bundle.main.url(forResource: modelName, withExtension: "mlmodel") ??
                            Bundle.main.url(forResource: modelName, withExtension: "mlpackage") else {
            // Try Documents directory for downloaded models
            let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let modelPath = docsDir.appendingPathComponent("\(modelName).mlmodel")
            guard FileManager.default.fileExists(atPath: modelPath.path) else {
                call.reject("Model not found: \(modelName)")
                return
            }
            loadModelFromURL(modelPath, call: call)
            return
        }
        loadModelFromURL(modelURL, call: call)
    }

    private func loadModelFromURL(_ url: URL, call: CAPPluginCall) {
        do {
            let config = MLModelConfiguration()
            config.computeUnits = .all  // Use Neural Engine when available
            let mlModel = try MLModel(contentsOf: url, configuration: config)
            model = try VNCoreMLModel(for: mlModel)
            modelLoaded = true
            call.resolve([
                "loaded": true,
                "modelName": url.lastPathComponent,
                "computeUnits": "all"
            ])
        } catch {
            call.reject("Failed to load model: \(error.localizedDescription)")
        }
    }

    @objc func classify(_ call: CAPPluginCall) {
        guard let model = model, modelLoaded else {
            call.reject("Model not loaded. Call loadModel first.")
            return
        }

        guard let imageBase64 = call.getString("image") else {
            call.reject("Image base64 required")
            return
        }

        guard let imageData = Data(base64Encoded: imageBase64),
              let uiImage = UIImage(data: imageData),
              let cgImage = uiImage.cgImage else {
            call.reject("Invalid image data")
            return
        }

        let request = VNCoreMLRequest(model: model) { request, error in
            if let error = error {
                call.reject("Classification failed: \(error.localizedDescription)")
                return
            }

            guard let results = request.results as? [VNClassificationObservation],
                  let topResult = results.first else {
                call.reject("No results from model")
                return
            }

            let fakeProb = topResult.identifier == "fake" ? topResult.confidence : (1.0 - topResult.confidence)
            let verdict: String
            if fakeProb > 0.6 {
                verdict = "LIKELY_SYNTHETIC"
            } else if fakeProb > 0.35 {
                verdict = "SUSPICIOUS"
            } else {
                verdict = "LIKELY_NATURAL"
            }

            call.resolve([
                "confidence": Double(fakeProb * 100).rounded() / 100,
                "verdict": verdict,
                "label": topResult.identifier,
                "labelConfidence": topResult.confidence,
                "allResults": results.map { ["label": $0.identifier, "confidence": $0.confidence] },
                "source": "on_device_coreml"
            ])
        }

        request.imageCropAndScaleOption = .centerCrop

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
            try handler.perform([request])
        } catch {
            call.reject("Vision request failed: \(error.localizedDescription)")
        }
    }

    @objc func getCapabilities(_ call: CAPPluginCall) {
        var hasNeuralEngine = false
        if #available(iOS 15.0, *) {
            hasNeuralEngine = true // All iOS 15+ devices with Core ML have Neural Engine access
        }

        call.resolve([
            "available": true,
            "platform": "ios",
            "framework": "coreml",
            "hasNeuralEngine": hasNeuralEngine,
            "modelLoaded": modelLoaded,
            "computeUnits": "all"
        ])
    }

    @objc func classifyFromUrl(_ call: CAPPluginCall) {
        guard let model = model, modelLoaded else {
            call.reject("Model not loaded. Call loadModel first.")
            return
        }

        guard let urlString = call.getString("url") else {
            call.reject("URL required")
            return
        }

        guard let url = URL(string: urlString) else {
            call.reject("Invalid URL")
            return
        }

        // Download image
        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data, let uiImage = UIImage(data: data), let cgImage = uiImage.cgImage else {
                call.reject("Failed to load image from URL: \(error?.localizedDescription ?? "unknown")")
                return
            }

            let request = VNCoreMLRequest(model: model) { request, error in
                if let error = error {
                    call.reject("Classification failed: \(error.localizedDescription)")
                    return
                }

                guard let results = request.results as? [VNClassificationObservation],
                      let topResult = results.first else {
                    call.reject("No results")
                    return
                }

                let fakeProb = topResult.identifier == "fake" ? topResult.confidence : (1.0 - topResult.confidence)
                let verdict: String
                if fakeProb > 0.6 {
                    verdict = "LIKELY_SYNTHETIC"
                } else if fakeProb > 0.35 {
                    verdict = "SUSPICIOUS"
                } else {
                    verdict = "LIKELY_NATURAL"
                }

                call.resolve([
                    "confidence": Double(fakeProb * 100).rounded() / 100,
                    "verdict": verdict,
                    "label": topResult.identifier,
                    "labelConfidence": topResult.confidence,
                    "source": "on_device_coreml"
                ])
            }

            request.imageCropAndScaleOption = .centerCrop
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([request])
        }
        task.resume()
    }
}
