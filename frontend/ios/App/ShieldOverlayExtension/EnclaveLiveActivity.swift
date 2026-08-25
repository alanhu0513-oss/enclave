import SwiftUI
import WidgetKit
import ActivityKit

@available(iOS 16.1, *)
struct EnclaveLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EnclaveShieldAttributes.self) { context in
            EnclaveLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    expandedHeader(context: context)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    expandedDisable
                }
                DynamicIslandExpandedRegion(.center) {
                    expandedStatusGrid(context: context)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    expandedDivider
                }
            } compactLeading: {
                compactIcon
            } compactTrailing: {
                compactLabel
            } minimal: {
                minimalView
            }
        }
    }

    // ─── Compact (collapsed) ───
    private var compactIcon: some View {
        HStack(spacing: 2) {
            Circle()
                .fill(Color(red: 1, green: 0.2, blue: 0.4))
                .frame(width: 5, height: 5)
            Text("SECURE_MODE")
                .font(.system(size: 7, weight: .bold, design: .monospaced))
                .foregroundColor(Color(red: 1, green: 1, blue: 1))
        }
    }

    private var compactLabel: some View {
        Text("// ENCRYPT_ON")
            .font(.system(size: 6, weight: .semibold, design: .monospaced))
            .foregroundColor(Color(red: 0, green: 0.898, blue: 1))
    }

    // ─── Minimal (peek) ───
    private var minimalView: some View {
        Image(systemName: "lock.shield")
            .font(.caption2)
            .foregroundColor(Color(red: 1, green: 0.2, blue: 0.4))
    }

    // ─── Expanded ───
    private func expandedHeader(context: ActivityViewContext<EnclaveShieldAttributes>) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(red: 0, green: 0.898, blue: 1))
                .frame(width: 5, height: 5)
            Text("SYS_FIREWALL")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundColor(Color(red: 0, green: 0.898, blue: 1))
            Text("// ACTIVE")
                .font(.system(size: 7, weight: .semibold, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
        }
    }

    private var expandedDisable: some View {
        Button(intent: DeactivateShieldsIntent()) {
            Text("[DISABLE]")
                .font(.system(size: 7, weight: .heavy, design: .monospaced))
                .foregroundColor(Color(red: 1, green: 0.2, blue: 0.4))
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color(red: 1, green: 0.2, blue: 0.4).opacity(0.4), lineWidth: 0.8)
                )
        }
        .buttonStyle(.plain)
    }

    private func expandedStatusGrid(context: ActivityViewContext<EnclaveShieldAttributes>) -> some View {
        VStack(spacing: 3) {
            HStack(spacing: 10) {
                statusRow(label: "STREAM_IMG", value: "ENCRYPTED", status: "PASS",
                          active: context.state.cameraImmunizerOn)
                statusRow(label: "STREAM_AUD", value: "SCRAMBLED", status: "ACTIVE",
                          active: context.state.voiceShieldOn)
            }
        }
        .padding(.vertical, 2)
    }

    private func statusRow(label: String, value: String, status: String, active: Bool) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 6, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
            Text(value)
                .font(.system(size: 7, weight: .semibold, design: .monospaced))
                .foregroundColor(active ? Color(red: 0, green: 0.898, blue: 1) : .white.opacity(0.3))
            Text(status)
                .font(.system(size: 6, weight: .bold, design: .monospaced))
                .foregroundColor(active ? Color(red: 0, green: 0.898, blue: 1) : Color(red: 1, green: 0.2, blue: 0.4))
        }
    }

    private var expandedDivider: some View {
        Rectangle()
            .fill(Color(red: 0.086, green: 0.122, blue: 0.157))
            .frame(height: 0.5)
            .padding(.horizontal, 2)
    }
}

// ─── Lock Screen / Banner View ───
@available(iOS 16.1, *)
struct EnclaveLiveActivityView: View {
    let context: ActivityViewContext<EnclaveShieldAttributes>

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(red: 1, green: 0.2, blue: 0.4))
                    .frame(width: 6, height: 6)

                Text("SYS_FIREWALL // ACTIVE")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(Color(red: 0, green: 0.898, blue: 1))

                Spacer()

                Button(intent: DeactivateShieldsIntent()) {
                    Text("[DISABLE]")
                        .font(.system(size: 8, weight: .heavy, design: .monospaced))
                        .foregroundColor(Color(red: 1, green: 0.2, blue: 0.4))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color(red: 1, green: 0.2, blue: 0.4).opacity(0.4), lineWidth: 0.8)
                        )
                }
                .buttonStyle(.plain)
            }

            Rectangle()
                .fill(Color(red: 0.086, green: 0.122, blue: 0.157))
                .frame(height: 0.5)

            HStack(spacing: 16) {
                statusLine(label: "STREAM_IMG", status: "ENCRYPTED", verdict: "PASS",
                           active: context.state.cameraImmunizerOn)
                statusLine(label: "STREAM_AUD", status: "SCRAMBLED", verdict: "ACTIVE",
                           active: context.state.voiceShieldOn)
            }
        }
        .padding(12)
        .background(Color(red: 0.04, green: 0.05, blue: 0.07))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color(red: 0, green: 0.898, blue: 1).opacity(0.12), lineWidth: 0.5)
        )
        .activityBackgroundTint(Color(red: 0.04, green: 0.05, blue: 0.07))
    }

    private func statusLine(label: String, status: String, verdict: String, active: Bool) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 7, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.4))
            HStack(spacing: 4) {
                Text(status)
                    .font(.system(size: 8, weight: .semibold, design: .monospaced))
                    .foregroundColor(active ? Color(red: 0, green: 0.898, blue: 1) : .white.opacity(0.3))
                Text("//")
                    .font(.system(size: 7))
                    .foregroundColor(.white.opacity(0.15))
                Text(verdict)
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(active ? Color(red: 0, green: 0.898, blue: 1) : Color(red: 1, green: 0.2, blue: 0.4))
            }
        }
    }
}
