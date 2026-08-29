import { useEffect, useState } from "react";
import { Gift, Copy, Check, Loader2, Link2, Users } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function ReferralPanel() {
  const { toast } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [claiming, setClaiming] = useState(false);

  async function load() {
    try {
      const res: any = await api.getReferralStats();
      setStats(res || null);
    } catch {
      setStats({ referralCount: 0, rewardClaimed: 0, pendingRewards: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const code = stats?.code || "";
  const shareUrl = code
    ? window.location.origin + "/refer?code=" + code
    : "";

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ title: "Referral link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy", variant: "error" });
    }
  }

  async function apply() {
    if (!applyCode) {
      toast({ title: "Enter a referral code", variant: "info" });
      return;
    }
    try {
      await api.applyReferral(applyCode.trim());
      toast({ title: "Referral code applied", variant: "success" });
      setApplyCode("");
    } catch (e: any) {
      toast({ title: "Apply failed", body: e.message, variant: "error" });
    }
  }

  async function claim() {
    setClaiming(true);
    try {
      await api.claimReferralReward();
      toast({ title: "Reward claimed!", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Claim failed", body: e.message, variant: "error" });
    } finally {
      setClaiming(false);
    }
  }

  const pending = stats?.pendingRewards || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral Program</CardTitle>
        <CardDescription>Invite friends, earn free months</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {loading ? (
            <>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </>
          ) : (
            <>
              <MiniStat icon="users" label="Referrals" value={stats?.referralCount ?? 0} />
              <MiniStat icon="gift" label="Rewards claimed" value={stats?.rewardClaimed ?? 0} />
              <MiniStat icon="check" label="Pending rewards" value={pending} />
            </>
          )}
        </div>

        {/* Share */}
        {code && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan" />
              <p className="flex-1 truncate font-mono text-xs text-ink-muted">{shareUrl || code}</p>
              <Button variant="glass" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}

        {/* Claim */}
        {pending > 0 && (
          <Button variant="cyan" className="w-full" disabled={claiming} onClick={claim}>
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Claim {pending} reward{pending > 1 ? "s" : ""}
          </Button>
        )}

        {/* Apply */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter a referral code"
            value={applyCode}
            onChange={(e) => setApplyCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
          <Button variant="glass" onClick={apply}>
            Apply
          </Button>
        </div>

        <p className="text-xs text-ink-faint">Earn 1 reward for every 3 successful referrals.</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  const Icon = icon === "users" ? Users : icon === "gift" ? Gift : Check;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-purple" />
      <p className="font-display text-lg font-bold text-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}
