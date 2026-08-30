import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Key,
  Plus,
  Loader2,
  Copy,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

const ROLE_BADGES: Record<string, string> = {
  owner: "bg-purple/15 text-purple",
  admin: "bg-amber/15 text-amber",
  member: "bg-cyan/15 text-cyan",
  viewer: "bg-white/10 text-ink-muted",
};

export function EnterpriseView() {
  const { toast } = useApp();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "audit" | "sso">("members");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  async function loadOrgs() {
    try {
      const data = await api.getOrganizations();
      setOrgs(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function loadOrgDetail(id: string) {
    try {
      const data = await api.getOrganization(id);
      setSelected(data);
    } catch (e: any) {
      toast({ title: "Failed to load", body: e.message, variant: "error" });
    }
  }

  async function loadAuditLogs() {
    if (!selected?.id) return;
    try {
      const data = await api.getAuditLogs(selected.id, 50);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (selected?.id && activeTab === "audit") loadAuditLogs();
  }, [selected?.id, activeTab]);

  async function createOrg() {
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      await api.createOrganization(orgName.trim());
      toast({ title: "Organization created", variant: "success" });
      setOrgName("");
      setShowCreate(false);
      await loadOrgs();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function invite() {
    if (!inviteEmail.trim() || !selected?.id) return;
    try {
      const result = await api.inviteOrgMember(selected.id, inviteEmail.trim(), inviteRole);
      setInviteCode((result as any)?.inviteCode || "");
      toast({ title: "Invitation created", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    }
  }

  function copyCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelected(null); setAuditLogs([]); }} className="rounded-lg bg-white/[0.04] p-1.5 text-ink-muted hover:text-ink">
            <LogOut className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{selected.name}</h2>
            <p className="text-sm text-ink-muted">{selected.members?.length || 0} members · {selected.plan} plan</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["members", "audit", "sso"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab ? "bg-cyan/15 text-cyan" : "bg-white/[0.04] text-ink-muted hover:text-ink"
              )}
            >
              {tab === "members" ? "Members" : tab === "audit" ? "Audit Log" : "SSO"}
            </button>
          ))}
        </div>

        {/* Members */}
        {activeTab === "members" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>Manage organization members and roles</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
                  <Plus className="h-4 w-4" /> Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showInvite && (
                <div className="space-y-2 rounded-xl bg-white/[0.03] p-3">
                  <div className="flex gap-2">
                    <Input placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <Button onClick={invite}>Send</Button>
                  </div>
                  {inviteCode && (
                    <div className="flex items-center gap-2 rounded-lg bg-green/10 p-2">
                      <code className="flex-1 text-sm text-green">{inviteCode}</code>
                      <button onClick={copyCode} className="text-ink-muted hover:text-ink">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <StaggerContainer className="space-y-2">
                {selected.members?.map((m: any) => (
                  <StaggerItem key={m.userId}>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-ink">
                          {(m.name || m.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{m.name || m.email}</p>
                          <p className="text-xs text-ink-muted">{m.email}</p>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px]", ROLE_BADGES[m.role] || "")}>{m.role}</Badge>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        )}

        {/* Audit Log */}
        {activeTab === "audit" && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Track all organizational actions for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">No audit logs yet</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-4 py-2.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">{log.action.replace(/_/g, " ")}</p>
                        {log.details && (
                          <p className="text-[11px] text-ink-muted truncate">{log.details}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-ink-faint">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SSO */}
        {activeTab === "sso" && (
          <Card>
            <CardHeader>
              <CardTitle>Single Sign-On (SSO)</CardTitle>
              <CardDescription>Configure SAML or OIDC for your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.ssoEnabled ? (
                <div className="rounded-xl bg-green/10 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green" />
                    <p className="text-sm font-medium text-green">SSO enabled via {selected.sso_provider}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Domain: {selected.sso_domain}</p>
                </div>
              ) : (
                <SsoSetup orgId={selected.id} onConfigured={() => loadOrgDetail(selected.id)} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Org list
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Organizations</h2>
            <p className="text-sm text-ink-muted">Manage team accounts and enterprise features</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" /> New Org
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex gap-2 p-4">
            <Input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Button onClick={createOrg} disabled={creating || !orgName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
            <p className="text-sm text-ink-muted">No organizations yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <StaggerItem key={org.id}>
              <Card
                className="cursor-pointer transition-all hover:border-purple/40"
                onClick={() => loadOrgDetail(org.id)}
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 text-purple">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <Badge className={cn("text-[10px]", ROLE_BADGES[org.role] || "")}>{org.role}</Badge>
                  </div>
                  <p className="font-display text-sm font-bold text-ink">{org.name}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {org.memberCount}</span>
                    <span className="capitalize">{org.plan}</span>
                    {org.ssoEnabled && <Badge className="text-[10px] bg-green/15 text-green">SSO</Badge>}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}

function SsoSetup({ orgId, onConfigured }: { orgId: string; onConfigured: () => void }) {
  const { toast } = useApp();
  const [provider, setProvider] = useState("google");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!domain.trim()) return;
    setSaving(true);
    try {
      await api.configureSso(orgId, { provider, domain: domain.trim() });
      toast({ title: "SSO configured", variant: "success" });
      onConfigured();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink">Provider</p>
        <div className="flex gap-2">
          {["google", "okta", "azure", "onelogin", "custom"].map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                provider === p ? "bg-purple/15 text-purple" : "bg-white/[0.04] text-ink-muted hover:text-ink"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Input placeholder="Company domain (e.g. company.com)" value={domain} onChange={(e) => setDomain(e.target.value)} />
      <Button onClick={save} disabled={saving || !domain.trim()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
        Enable SSO
      </Button>
    </div>
  );
}
