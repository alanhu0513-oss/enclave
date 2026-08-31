import { useState, useEffect } from "react";
import {
  Heart,
  Shield,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StaggerContainer, StaggerItem, Kinetic, FadeIn } from "@/components/ui/motion";
import { SectionHeader, EmptyState } from "@/components/ui/dashboard";

interface Estate {
  id: string;
  deceasedName: string;
  relationship: string;
  dateOfDeath: string | null;
  status: string;
  monitoringEnabled: boolean;
  takedownsAuthorized: boolean;
  createdAt: string;
}

export function EstateView() {
  const { toast } = useApp();
  const [estates, setEstates] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [form, setForm] = useState({
    deceasedName: "",
    relationship: "",
    dateOfDeath: "",
    email: "",
    notes: "",
  });

  async function load() {
    try {
      const data: any = await api.getEstateProfiles();
      setEstates(data?.estates || []);
    } catch {
      setEstates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEnroll() {
    if (!form.deceasedName || !form.relationship) {
      toast({ title: "Name and relationship required", variant: "info" });
      return;
    }
    setEnrolling(true);
    try {
      await api.enrollEstate(form);
      toast({ title: "Estate enrolled", variant: "success" });
      setShowEnroll(false);
      setForm({ deceasedName: "", relationship: "", dateOfDeath: "", email: "", notes: "" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    } finally {
      setEnrolling(false);
    }
  }

  async function removeEstate(id: string) {
    try {
      await api.removeEstate(id);
      toast({ title: "Estate removed", variant: "success" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", body: e.message, variant: "error" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <FadeIn>
        <SectionHeader
          icon={Heart}
          title="Digital Estate"
          description="Protect the digital legacy of your loved ones"
          action={
            <Button onClick={() => setShowEnroll(true)}>
              <Plus className="h-4 w-4" />
              Add Estate
            </Button>
          }
        />
      </FadeIn>

      {showEnroll && (
        <FadeIn>
          <Card className="border-white/[0.06]">
            <CardHeader>
              <CardTitle>Enroll Estate</CardTitle>
              <CardDescription>Set up monitoring and protection for a deceased loved one</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Full Name *</label>
                  <Input
                    value={form.deceasedName}
                    onChange={(e) => setForm({ ...form, deceasedName: e.target.value })}
                    placeholder="Deceased person's name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Relationship *</label>
                  <Input
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    placeholder="e.g., Parent, Spouse, Sibling"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Date of Death</label>
                  <Input
                    type="date"
                    value={form.dateOfDeath}
                    onChange={(e) => setForm({ ...form, dateOfDeath: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Contact Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-green/40"
                  rows={3}
                  placeholder="Any additional information..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEnroll} disabled={enrolling}>
                  {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Enroll
                </Button>
                <Button variant="ghost" onClick={() => setShowEnroll(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-cyan" />
        </div>
      ) : estates.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No estates enrolled"
          description="Enroll a deceased loved one's digital estate for monitoring and protection."
        />
      ) : (
        <StaggerContainer className="space-y-4">
          {estates.map((estate) => (
            <StaggerItem key={estate.id}>
              <Kinetic>
                <Card className="border-white/[0.06]">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                      <Heart className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{estate.deceasedName}</p>
                        <Badge variant="green" className="text-[10px]">Active</Badge>
                      </div>
                      <p className="text-sm text-ink-muted">
                        {estate.relationship} · Enrolled {new Date(estate.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="iconSm"
                        variant="ghost"
                        onClick={() => removeEstate(estate.id)}
                        className="text-red/70 hover:text-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Kinetic>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}
