import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ROLES = ["member", "monitor", "admin"];
const PROFILES = [
  { id: "full", label: "Full protection" },
  { id: "monitoring", label: "Monitoring only" },
  { id: "alerts", label: "Alerts only" },
];

export function FamilyPanel() {
  const { toast } = useApp();
  const [members, setMembers] = useState<any[]>([]);
  const [maxMembers, setMaxMembers] = useState(5);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [profile, setProfile] = useState("full");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res: any = await api.listFamilyMembers();
      setMembers(Array.isArray(res) ? res : res?.members || []);
      setMaxMembers(res?.maxMembers || 5);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember() {
    if (!email) {
      toast({ title: "Enter an email", variant: "info" });
      return;
    }
    setBusy(true);
    try {
      await api.addFamilyMember({ email, name, role, profile });
      toast({ title: "Family member added", variant: "success" });
      setName("");
      setEmail("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Add failed", body: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
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

  const full = members.length >= maxMembers;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Family Protection</CardTitle>
            <CardDescription>Extend monitoring to loved ones ({members.length}/{maxMembers})</CardDescription>
          </div>
          <Button variant="cyan" size="sm" disabled={full || busy} onClick={() => setOpen((o) => !o)}>
            {open ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="space-y-3 rounded-xl border border-cyan/20 bg-cyan/[0.03] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Email</label>
                <Input placeholder="family@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Name</label>
                <Input placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Role</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <Button key={r} size="sm" variant={role === r ? "cyan" : "glass"} onClick={() => setRole(r)}>
                    {r}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Protection profile</label>
              <div className="flex flex-wrap gap-2">
                {PROFILES.map((p) => (
                  <Button key={p.id} size="sm" variant={profile === p.id ? "cyan" : "glass"} onClick={() => setProfile(p.id)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button variant="cyan" className="w-full" disabled={busy} onClick={addMember}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Member
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-ink-muted">
            <Users className="h-5 w-5 text-ink-faint" />
            <p className="text-sm">No family members yet. Add up to {maxMembers}.</p>
          </div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green/15 text-green">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{m.name || m.email}</p>
                <p className="truncate text-xs text-ink-muted">{m.email}</p>
              </div>
              <Badge variant={m.status === "active" ? "green" : "muted"}>{m.status}</Badge>
              <Button variant="glass" size="sm" onClick={() => remove(m.id)} title="Remove member">
                <Trash2 className="h-4 w-4 text-red" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
