import Foundation
import Capacitor
import ActivityKit

@available(iOS 16.1, *)
@objc(ShieldOverlayPlugin)
public class ShieldOverlayPlugin: CAPPlugin {

    private var currentActivity: Activity<EnclaveShieldAttributes>? = nil

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }

        // Check if widget is disabled via settings
        let widgetEnabled = call.getBool("widgetEnabled", true)
        if !widgetEnabled {
            endExistingActivity()
            call.resolve(["active": false, "widgetDisabled": true])
            return
        }

        // End any existing activity first
        endExistingActivity()

        let initialState = EnclaveShieldAttributes.ContentState(
            shieldsActive: true,
            cameraImmunizerOn: true,
            voiceShieldOn: true,
            widgetEnabled: true
        )
        let attributes = EnclaveShieldAttributes()

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: initialState, staleDate: nil),
                pushType: nil
            )
            currentActivity = activity
            call.resolve(["active": true])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }

        let finalState = EnclaveShieldAttributes.ContentState(
            shieldsActive: false,
            cameraImmunizerOn: false,
            voiceShieldOn: false,
            widgetEnabled: false
        )

        Task {
            if let activity = currentActivity {
                await activity.end(using: finalState, dismissalPolicy: .immediate)
                currentActivity = nil
            } else {
                // End all activities
                for activity in Activity<EnclaveShieldAttributes>.activities {
                    await activity.end(using: finalState, dismissalPolicy: .immediate)
                }
            }
            call.resolve(["active": false])
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve(["active": false, "available": false])
            return
        }

        let isActive = currentActivity != nil || !Activity<EnclaveShieldAttributes>.activities.isEmpty
        call.resolve([
            "active": isActive,
            "available": true
        ])
    }

    @objc func updateShields(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities require iOS 16.1+")
            return
        }

        let cameraOn = call.getBool("cameraImmunizer", false)
        let voiceOn = call.getBool("voiceShield", false)
        let widgetEnabled = call.getBool("widgetEnabled", true)

        let updatedState = EnclaveShieldAttributes.ContentState(
            shieldsActive: cameraOn || voiceOn,
            cameraImmunizerOn: cameraOn,
            voiceShieldOn: voiceOn,
            widgetEnabled: widgetEnabled
        )

        Task {
            if let activity = currentActivity {
                await activity.update(.init(state: updatedState, staleDate: nil))
            } else {
                for activity in Activity<EnclaveShieldAttributes>.activities {
                    await activity.update(.init(state: updatedState, staleDate: nil))
                }
            }
            call.resolve()
        }
    }

    // ─── Listen for deactivation from Live Activity button ───
    @objc func listenForDeactivation(_ call: CAPPluginCall) {
        // Observe UserDefaults suite for deactivation signal
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeactivation),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
        call.resolve()
    }

    @objc private func handleDeactivation() {
        if let shared = UserDefaults(suiteName: "group.app.enclave.vault"),
           shared.bool(forKey: "enclave_deactivate_requested") {
            shared.set(false, forKey: "enclave_deactivate_requested")
            shared.synchronize()

            // Bridge to JS
            DispatchQueue.main.async {
                self.notifyListeners("enclaveDeactivate", data: [:])
            }
        }
    }

    private func endExistingActivity() {
        guard #available(iOS 16.1, *) else { return }
        Task {
            for activity in Activity<EnclaveShieldAttributes>.activities {
                let finalState = EnclaveShieldAttributes.ContentState(
                    shieldsActive: false,
                    cameraImmunizerOn: false,
                    voiceShieldOn: false,
                    widgetEnabled: false
                )
                await activity.end(using: finalState, dismissalPolicy: .immediate)
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
