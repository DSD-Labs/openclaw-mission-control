import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Agent = {
  id: string;
  name: string;
  role: string;
  soul_md: string;
  enabled: boolean;
  openclaw_agent_id?: string | null;
  skills_allow: string[];
  execution_policy: { default?: string; by_skill?: Record<string, string> };
  work_state?: {
    task_id?: string | null;
    status: string;
    next_step: string;
    blockers: string;
    updated_at?: string | null;
  } | null;
};

type AgentCreate = {
  name: string;
  role: string;
  soul_md: string;
  openclaw_agent_id?: string | null;
  enabled: boolean;
  skills_allow: string[];
  execution_policy: { default: string; by_skill: Record<string, string> };
};

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentEditor({
  mode,
  initial,
  onSubmit,
  submitting,
}: {
  mode: "create" | "edit";
  initial: AgentCreate;
  onSubmit: (v: AgentCreate) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<AgentCreate>(initial);

  return (
    <div className="grid gap-3">
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
          <div className="grid gap-2">
            <label className="text-sm font-semibold">OpenClaw agentId (optional)</label>
            <Input
              value={form.openclaw_agent_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, openclaw_agent_id: e.target.value || null }))}
              placeholder="(an allowed agentId)"
            />
            <div className="text-xs text-muted-foreground">
              If set, War Room can spawn this employee agent via OpenClaw.
            </div>
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
          onClick={() => onSubmit(form)}
          disabled={submitting || !form.name || !form.role}
        >
          {submitting
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create"
              : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onSave,
  saving,
}: {
  agent: Agent;
  onSave: (patch: Partial<AgentCreate>) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);

  const initial: AgentCreate = {
    name: agent.name,
    role: agent.role,
    soul_md: agent.soul_md,
    openclaw_agent_id: agent.openclaw_agent_id ?? null,
    enabled: agent.enabled,
    skills_allow: agent.skills_allow ?? [],
    execution_policy: {
      default: agent.execution_policy?.default ?? "propose",
      by_skill: agent.execution_policy?.by_skill ?? {},
    },
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-baseline gap-3">
        <div className="font-extrabold">{agent.name}</div>
        <div className="text-sm text-muted-foreground">{agent.role}</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground">{agent.enabled ? "enabled" : "disabled"}</div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit agent</DialogTitle>
              </DialogHeader>
              <AgentEditor
                mode="edit"
                initial={initial}
                submitting={saving}
                onSubmit={(v) => {
                  onSave(v);
                  setOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">id: {agent.id}</div>
      <div className="text-xs text-muted-foreground">
        openclaw_agent_id: {agent.openclaw_agent_id ?? "—"}
      </div>
      <div className="text-xs text-muted-foreground">
        working on: {agent.work_state?.task_id ?? "—"} · status: {agent.work_state?.status ?? "idle"}
      </div>
      {agent.work_state?.next_step ? (
        <div className="text-xs text-muted-foreground">next: {agent.work_state.next_step}</div>
      ) : null}
      {agent.work_state?.blockers ? (
        <div className="text-xs text-destructive">blockers: {agent.work_state.blockers}</div>
      ) : null}
      <div className="text-xs text-muted-foreground">
        skills: {(agent.skills_allow ?? []).join(", ") || "—"}
      </div>
      <div className="text-xs text-muted-foreground">
        exec default: {agent.execution_policy?.default ?? "propose"}
      </div>
    </div>
  );
}

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

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AgentCreate> }) =>
      apiPatch<Agent>(`/api/agents/${id}`, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const defaultForm: AgentCreate = useMemo(
    () => ({
      name: "",
      role: "",
      soul_md: "",
      openclaw_agent_id: null,
      enabled: true,
      skills_allow: [],
      execution_policy: { default: "propose", by_skill: {} },
    }),
    [],
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Agents</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">v0</Badge>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setOpen(true)}>
                New agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create agent</DialogTitle>
              </DialogHeader>
              <AgentEditor
                mode="create"
                initial={defaultForm}
                submitting={create.isPending}
                onSubmit={(v) => create.mutate(v)}
              />
              {create.error && (
                <div className="text-sm text-destructive">{String(create.error)}</div>
              )}
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
            <AgentCard
              key={a.id}
              agent={a}
              onSave={(patch) => update.mutate({ id: a.id, patch })}
              saving={update.isPending}
            />
          ))}

          {(q.data?.length ?? 0) === 0 && !q.isLoading && (
            <div className="text-sm text-muted-foreground">No agents yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
