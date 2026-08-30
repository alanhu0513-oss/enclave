import { useEffect, useState } from "react";
import {
  Camera,
  Mic,
  Shield,
  Smartphone,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    EnclaveNative?: {
      isNative: () => boolean;
      isCapacitor: () => boolean;
      cameraImmunizer: {
        start: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        isActive: () => boolean;
        getStatus: () => { active: boolean; cloakedCount: number; lastActive: string | null };
      };
      voiceShield: {
        start: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        isActive: () => boolean;
        enrollVoice: (duration?: number) => Promise<any>;
        verifyVoice: (threshold?: number) => Promise<any>;
        getStatus: () => { active: boolean; enrolled: boolean; hasVoiceprint: boolean; sessionsProtected: number };
      };
      shieldOverlay: {
        start: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        isActive: () => boolean;
        getStatus: () => { active: boolean; platformActive: boolean };
      };
      secureStorage: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
        remove: (key: string) => Promise<void>;
      };
    };
  }
}

function useNative() {
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(!!window.EnclaveNative?.isNative?.());
  }, []);
  return isNative;
}

interface ShieldState {
  active: boolean;
  status?: any;
}

function useShieldFeature(
  key: "cameraImmunizer" | "voiceShield" | "shieldOverlay"
): [ShieldState, () => Promise<void>, () => Promise<void>] {
  const [state, setState] = useState<ShieldState>({ active: false });

  useEffect(() => {
    const native = window.EnclaveNative;
    if (!native) return;
    const feature = native[key];
    if (!feature) return;
    setState({ active: feature.isActive(), status: feature.getStatus?.() });

    const eventName =
      key === "cameraImmunizer" ? "enclave-camera-status" : "enclave-voice-status";
    const handler = (e: CustomEvent) => setState({ active: true, status: e.detail });
    window.addEventListener(eventName, handler as EventListener);
    return () => window.removeEventListener(eventName, handler as EventListener);
  }, [key]);

  async function start() {
    const feature = window.EnclaveNative?.[key];
    if (!feature) return;
    const ok = await feature.start();
    if (ok) setState({ active: true, status: feature.getStatus?.() });
  }

  async function stop() {
    const feature = window.EnclaveNative?.[key];
    if (!feature) return;
    await feature.stop();
    setState({ active: false, status: feature.getStatus?.() });
  }

  return [state, start, stop];
}

export function NativeShieldPanel() {
  const isNative = useNative();
  const [cameraState, startCamera, stopCamera] = useShieldFeature("cameraImmunizer");
  const [voiceState, startVoice, stopVoice] = useShieldFeature("voiceShield");
  const [overlayState, startOverlay, stopOverlay] = useShieldFeature("shieldOverlay");

  if (!isNative) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-purple" />
          <CardTitle>Native Protection</CardTitle>
        </div>
        <CardDescription>Device-level shields active on this device</CardDescription>
      </CardHeader>
      <CardContent>
        <StaggerContainer className="space-y-3">
          {/* Shield Overlay */}
          <StaggerItem>
            <ShieldRow
              icon={Shield}
              label="Shield Overlay"
              desc="Floating protection bubble"
              active={overlayState.active}
              onToggle={overlayState.active ? stopOverlay : startOverlay}
            />
          </StaggerItem>

          {/* Camera Immunizer */}
          <StaggerItem>
            <ShieldRow
              icon={Camera}
              label="Camera Immunizer"
              desc="Injects protective noise into photos"
              active={cameraState.active}
              onToggle={cameraState.active ? stopCamera : startCamera}
              badge={
                cameraState.status?.cloakedCount
                  ? `${cameraState.status.cloakedCount} photos`
                  : undefined
              }
            />
          </StaggerItem>

          {/* Voice Shield */}
          <StaggerItem>
            <ShieldRow
              icon={Mic}
              label="Voice Shield"
              desc="Scrambles audio during calls"
              active={voiceState.active}
              onToggle={voiceState.active ? stopVoice : startVoice}
              badge={
                voiceState.status?.enrolled
                  ? "Enrolled"
                  : "Not enrolled"
              }
            />
          </StaggerItem>

          {/* Secure Storage */}
          <StaggerItem>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-3">
                <Lock className="h-4 w-4 text-green" />
                <div>
                  <p className="text-sm font-medium text-ink">Secure Storage</p>
                  <p className="text-xs text-ink-muted">Credentials stored in device keychain</p>
                </div>
              </div>
              <Badge variant="green">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </Badge>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </CardContent>
    </Card>
  );
}

function ShieldRow({
  icon: Icon,
  label,
  desc,
  active,
  onToggle,
  badge,
}: {
  icon: typeof Camera;
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", active ? "text-green" : "text-ink-faint")} />
        <div>
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <Badge variant={active ? "green" : "muted"} className="text-[10px]">
            {badge}
          </Badge>
        )}
        <button
          onClick={handleToggle}
          disabled={busy}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            active ? "bg-green" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
              active ? "left-[22px]" : "left-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}
