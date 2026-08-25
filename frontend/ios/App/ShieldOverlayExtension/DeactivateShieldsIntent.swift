import Foundation
import AppIntents
import ActivityKit

@available(iOS 16.1, *)
struct DeactivateShieldsIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Deactivate Enclave Shields"
    static var description = IntentDescription("Taps the DISABLE button to shut down all background shield services.")

    func perform() async throws -> some IntentResult {
        // Broadcast via UserDefaults suite to signal main app
        if let shared = UserDefaults(suiteName: "group.app.enclave.vault") {
            shared.set(true, forKey: "enclave_deactivate_requested")
            shared.synchronize()
        }

        // Attempt to open the main app with deactivation payload
        if let url = URL(string: "enclave://deactivate") {
            _ = await UIApplication.shared.open(url, options: [:])
        }

        // End all live activities
        for activity in Activity<EnclaveShieldAttributes>.activities {
            let finalState = EnclaveShieldAttributes.ContentState(
                shieldsActive: false,
                cameraImmunizerOn: false,
                voiceShieldOn: false
            )
            await activity.end(using: finalState, dismissalPolicy: .immediate)
        }

        return .result()
    }
}
