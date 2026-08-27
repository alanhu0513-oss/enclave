import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

const SHIELDS = [
  { key: "crawler", name: "Proactive Crawler", desc: "Continuously searches the web for unauthorized copies of your identity.", color: "text-cyan accent-cyan" },
  { key: "monitor", name: "Deep Web Monitor", desc: "Monitors dark web & forums for leaked credentials or impersonation.", color: "text-purple accent-purple" },
  { key: "biometric", name: "Biometric Enrollment", desc: "Stores encrypted face/voice/signature profiles for matching.", color: "text-green accent-green" },
  { key: "takedown", name: "Auto Takedown", desc: "Files DMCA / takedown requests against flagged content automatically.", color: "text-amber accent-amber" },
  { key: "rights", name: "Rights Shield", desc: "Watermarks & legal documentation to assert ownership fast.", color: "text-cyan accent-cyan" },
] as const;

const SHIELDS_STORAGE_KEY = "enclave_shields_state";

export function getShieldStates(): Record<string, boolean> {
  if (typeof window === "undefined") return {
    crawler: true,
    monitor: true,
    biometric: false,
    takedown: false,
    rights: true,
  };
  const stored = localStorage.getItem(SHIELDS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return {
    crawler: true,
    monitor: true,
    biometric: false,
    takedown: false,
    rights: true,
  };
}

export function ShieldsView() {
  const { toast } = useApp();
  const [toggles, setToggles] = useState<Record<string, boolean>>(getShieldStates());

  useEffect(() => {
    localStorage.setItem(SHIELDS_STORAGE_KEY, JSON.stringify(toggles));
  }, [toggles]);

  const activeCount = Object.values(toggles).filter(Boolean).length;

  function toggle(key: string, val: boolean) {
    setToggles((t) => ({ ...t, [key]: val }));
    toast({
      title: val ? "Shield activated" : "Shield deactivated",
      body: key,
      variant: val ? "success" : "info",
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Active Shields</h2>
          <p className="text-sm text-ink-muted">
            {activeCount} of {SHIELDS.length} defense layers protecting you
          </p>
        </div>
        <Badge variant="cyan">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
          {activeCount}/{SHIELDS.length} Online
        </Badge>
      </div>

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHIELDS.map((shield) => {
          const on = toggles[shield.key];
          return (
            <StaggerItem key={shield.key}>
              <Card
                className={cn(
                  "relative h-full overflow-hidden transition-all duration-300",
                  on ? "border-white/[0.12]" : "opacity-60"
                )}
              >
                {on && (
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-green/[0.06] blur-2xl" />
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]",
                        on ? shield.color.split(" ")[0] : "text-ink-faint"
                      )}
                    >
                      {on ? (
                        <ShieldCheck className="h-5 w-5 text-green" />
                      ) : (
                        <Shield className="h-5 w-5" />
                      )}
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => toggle(shield.key, v)}
                    />
                  </div>
                  <CardTitle>{shield.name}</CardTitle>
                  <CardDescription>{shield.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={on ? "green" : "muted"}>
                    {on ? "Operational" : "Standby"}
                  </Badge>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}

        {/* Shield status footer card */}
        <StaggerItem className="sm:col-span-2 lg:col-span-3">
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber" />
                  <div>
                    <p className="text-sm font-medium text-ink">Pending action required</p>
                    <p className="text-xs text-ink-muted">
                      Review flagged detections to keep your score high
                    </p>
                  </div>
                </div>
                <a
                  href="#alerts"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = "alerts";
                  }}
                  className="text-sm font-medium text-cyan hover:text-green"
                >
                  Review →
                </a>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
