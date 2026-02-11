import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Agent = {
  id: string;
  name: string;
  role: string;
  soul_md: string;
  enabled: boolean;
  skills_allow: string[];
  execution_policy: { default?: string; by_skill?: Record<string, string> };
};

type AgentCreate = {
  name: string;
  role: string;
  soul_md: string;
  enabled: boolean;
  skills_allow: string[];
  execution_policy: { default: string; by_skill: Record<string, string> };
};

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiGet<Agent[]>("/api/agents"),
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: (body: AgentCreate) => apiPost<Agent>("/api/agents", body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agents"] });
      setOpen(false);
    },
  });

  const defaultForm: AgentCreate = useMemo(
    () => ({
      name: "",
      role: "",
      soul_md: "",
      enabled: true,
      skills_allow: [],
      execution_policy: { default: "propose", by_skill: {} },
    }),
    [],
  );

  const [form, setForm] = useState<AgentCreate>(defaultForm);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Agents</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">v0</Badge>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New agent</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create agent</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="soul">Soul</TabsTrigger>
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="grid gap-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Name</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ops Agent"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Role</label>
                    <Input
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      placeholder="Operations"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    />
                    <span className="text-sm">Enabled</span>
                  </div>
                </TabsContent>

                <TabsContent value="soul" className="grid gap-2">
                  <label className="text-sm font-semibold">Soul (markdown)</label>
                  <Textarea
                    value={form.soul_md}
                    onChange={(e) => setForm((f) => ({ ...f, soul_md: e.target.value }))}
                    rows={10}
                    placeholder="# Ops Agent\n\nYou are the operations specialist..."
                  />
                </TabsContent>

                <TabsContent value="skills" className="grid gap-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Skill allowlist (comma separated)</label>
                    <Input
                      value={form.skills_allow.join(",")}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          skills_allow: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="github,healthcheck,services-registry"
                    />
                    <div className="text-xs text-muted-foreground">
                      Deny-by-default. Anything not listed is blocked.
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Execution default</label>
                    <Input
                      value={form.execution_policy.default}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          execution_policy: { ...f.execution_policy, default: e.target.value },
                        }))
                      }
                      placeholder="propose"
                    />
                    <div className="text-xs text-muted-foreground">
                      Use <code>execute</code> or <code>propose</code>.
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm(defaultForm);
                    setOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => create.mutate(form)}
                  disabled={create.isPending || !form.name || !form.role}
                >
                  {create.isPending ? "Creating…" : "Create"}
                </Button>
              </div>

              {create.error && <div className="text-sm text-destructive">{String(create.error)}</div>}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{q.data?.length ?? 0} agent(s)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {q.error && <div className="text-sm text-destructive">{String(q.error)}</div>}

          {(q.data ?? []).map((a) => (
            <div key={a.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-baseline gap-3">
                <div className="font-extrabold">{a.name}</div>
                <div className="text-sm text-muted-foreground">{a.role}</div>
                <div className="ml-auto text-xs text-muted-foreground">
                  {a.enabled ? "enabled" : "disabled"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">id: {a.id}</div>
              <div className="text-xs text-muted-foreground">
                skills: {(a.skills_allow ?? []).join(", ") || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                exec default: {a.execution_policy?.default ?? "propose"}
              </div>
            </div>
          ))}

          {(q.data?.length ?? 0) === 0 && !q.isLoading && (
            <div className="text-sm text-muted-foreground">No agents yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
