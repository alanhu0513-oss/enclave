import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Loader2,
  UserPlus,
  Trash2,
  Activity,
  Clock,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn, Expandable, SPRING } from "@/components/ui/motion";

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  profile: string;
  lastActive?: string;
  alertCount?: number;
  scanCount?: number;
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 600;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span className={className}>{display}</span>;
}

export function FamilyDashboard() {
  const { toast } = useApp();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ totalAlerts: 0, activeMembers: 0, scansToday: 0 });

  async function load() {
    try {
      const res: any = await api.listFamilyMembers();
      const list = Array.isArray(res) ? res : res?.members || [];
      setMembers(list);
      setStats({
        totalAlerts: list.reduce((sum: number, m: FamilyMember) => sum + (m.alertCount || 0), 0),
        activeMembers: list.filter((m: FamilyMember) => m.status === "active").length,
        scansToday: list.reduce((sum: number, m: FamilyMember) => sum + (m.scanCount || 0), 0),
      });
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addMember() {
    if (!email) { toast({ title: "Enter an email", variant: "info" }); return; }
    setBusy(true);
    try {
      await api.addFamilyMember({ email, name, role: "member", profile: "full" });
      toast({ title: "Member added", variant: "success" });
      setEmail(""); setName(""); setShowAdd(false);
      load();
    } catch (e: any) {
      toast({ title: "Add failed", body: e.message, variant: "error" });
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await api.removeFamilyMember(id);
      toast({ title: "Member removed", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Remove failed", body: e.message, variant: "error" });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={SPRING}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green/15 text-green"
            >
              <Users className="h-6 w-6" />
            </motion.div>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">Family Dashboard</h1>
              <p className="text-sm text-ink-muted">Monitor and protect your household</p>
            </div>
          </div>
          <Kinetic>
            <Button variant="cyan" onClick={() => setShowAdd(!showAdd)}>
              <Sparkles className="h-4 w-4 mr-2" /> Add Member
            </Button>
          </Kinetic>
        </div>
      </FadeIn>

      <Expandable open={showAdd}>
        <Card className="border-cyan/20 bg-cyan/[0.03]">
          <CardContent className="flex gap-3 pt-6">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
            <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Kinetic>
              <Button variant="cyan" disabled={busy} onClick={addMember}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add
              </Button>
            </Kinetic>
          </CardContent>
        </Card>
      </Expandable>

      <StaggerContainer className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Kinetic>
            <Card className="transition-shadow hover:shadow-lg hover:shadow-green/10">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green/15 text-green">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <AnimatedNumber value={stats.activeMembers} className="text-2xl font-bold text-ink" />
                  <p className="text-sm text-ink-muted">Active Members</p>
                </div>
              </CardContent>
            </Card>
          </Kinetic>
        </StaggerItem>
        <StaggerItem>
          <Kinetic>
            <Card className="transition-shadow hover:shadow-lg hover:shadow-amber/10">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/15 text-amber">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <AnimatedNumber value={stats.totalAlerts} className="text-2xl font-bold text-ink" />
                  <p className="text-sm text-ink-muted">Family Alerts</p>
                </div>
              </CardContent>
            </Card>
          </Kinetic>
        </StaggerItem>
        <StaggerItem>
          <Kinetic>
            <Card className="transition-shadow hover:shadow-lg hover:shadow-cyan/10">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                  <Eye className="h-6 w-6" />
                </div>
                <div>
                  <AnimatedNumber value={stats.scansToday} className="text-2xl font-bold text-ink" />
                  <p className="text-sm text-ink-muted">Scans Today</p>
                </div>
              </CardContent>
            </Card>
          </Kinetic>
        </StaggerItem>
      </StaggerContainer>

      <Card>
        <CardHeader>
          <CardTitle>Family Members</CardTitle>
          <CardDescription>{members.length}/5 members protected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <FadeIn delay={0.2}>
              <div className="flex flex-col items-center gap-3 py-8 text-ink-muted">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Users className="h-10 w-10 text-ink-faint" />
                </motion.div>
                <p>No family members yet. Add up to 5 members to protect your household.</p>
              </div>
            </FadeIn>
          ) : (
            <StaggerContainer className="space-y-3">
              {members.map((m) => (
                <StaggerItem key={m.id}>
                  <Kinetic>
                    <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
                      <motion.div
                        whileHover={{ rotate: -10 }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-green/15 text-green"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{m.name || m.email}</p>
                          <Badge variant={m.status === "active" ? "green" : "muted"}>{m.status}</Badge>
                          <Badge variant="outline">{m.profile}</Badge>
                        </div>
                        <p className="truncate text-xs text-ink-muted">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-ink-muted">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber" />
                          <span>{m.alertCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-cyan" />
                          <span>{m.scanCount || 0}</span>
                        </div>
                        {m.lastActive && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{new Date(m.lastActive).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button variant="glass" size="sm" onClick={() => remove(m.id)}>
                          <Trash2 className="h-4 w-4 text-red" />
                        </Button>
                      </motion.div>
                    </div>
                  </Kinetic>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
