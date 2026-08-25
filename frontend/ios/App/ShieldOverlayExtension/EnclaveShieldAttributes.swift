import Foundation
import ActivityKit

struct EnclaveShieldAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var shieldsActive: Bool
        var cameraImmunizerOn: Bool
        var voiceShieldOn: Bool
        var widgetEnabled: Bool
    }
}
