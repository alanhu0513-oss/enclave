import UIKit
import Capacitor
import ActivityKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UserDefaults(suiteName: "group.app.enclave.vault")?.synchronize()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        checkForDeactivationRequest()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if url.scheme == "enclave" && url.host == "deactivate" {
            handleDeactivationRequest()
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func checkForDeactivationRequest() {
        if let shared = UserDefaults(suiteName: "group.app.enclave.vault") {
            if shared.bool(forKey: "enclave_deactivate_requested") {
                shared.set(false, forKey: "enclave_deactivate_requested")
                shared.synchronize()
                handleDeactivationRequest()
            }
        }
    }

    private func handleDeactivationRequest() {
        if #available(iOS 16.1, *) {
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

        DispatchQueue.main.async { [weak self] in
            guard let bridge = self?.window?.rootViewController as? CAPBridgeViewController else { return }
            bridge.webView?.evaluateJavaScript(
                "try{window.EnclaveNative&&window.EnclaveNative.shieldOverlay&&window.EnclaveNative.shieldOverlay.deactivateAll()}catch(e){}",
                completionHandler: nil
            )
        }
    }
}
