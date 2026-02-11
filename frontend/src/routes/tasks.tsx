import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TaskStatus = "BACKLOG" | "READY" | "DOING" | "BLOCKED" | "REVIEW" | "DONE";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  owner_agent_id?: string | null;
};

type Agent = { id: string; name: string };

type TaskCreate = {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: number;
  owner_agent_id?: string | null;
};

const columns: TaskStatus[] = ["BACKLOG", "READY", "DOING", "BLOCKED", "REVIEW", "DONE"];

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const agentsQ = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiGet<Agent[]>("/api/agents"),
    refetchInterval: 10000,
  });

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiGet<Task[]>("/api/tasks"),
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: (body: TaskCreate) => apiPost<Task>("/api/tasks", body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
    },
  });

  const patch = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) =>
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8787"}/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(patch),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`PATCH /api/tasks/${id} failed: ${r.status}`);
        return (await r.json()) as Task;
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const defaultForm: TaskCreate = useMemo(
    () => ({ title: "", description: "", status: "BACKLOG", priority: 0, owner_agent_id: null }),
    [],
  );
  const [form, setForm] = useState<TaskCreate>(defaultForm);

  const tasks = tasksQ.data ?? [];
  const agents = agentsQ.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Kanban</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">v0</Badge>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New task</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create task</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Title</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Build War Room chair prompt"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Description</label>
                  <Textarea
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Status</label>
                    <Select
                      value={form.status}
                      onValueChange={(v: string) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Owner</label>
                    <Select
                      value={form.owner_agent_id ?? ""}
                      onValueChange={(v: string) => setForm((f) => ({ ...f, owner_agent_id: v || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold">Priority</label>
                    <Input
                      type="number"
                      value={String(form.priority)}
                      onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                    />
                  </div>
                </div>

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
                    disabled={create.isPending || !form.title}
                  >
                    {create.isPending ? "Creating…" : "Create"}
                  </Button>
                </div>

                {create.error && (
                  <div className="text-sm text-destructive">{String(create.error)}</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Board</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            v0: create tasks + move status/owner from the card dropdowns (drag/drop later).
          </div>

          {(tasksQ.isLoading || agentsQ.isLoading) && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {(tasksQ.error || agentsQ.error) && (
            <div className="text-sm text-destructive">
              {String(tasksQ.error ?? agentsQ.error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            {columns.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              return (
                <div key={col} className="rounded-lg border">
                  <div className="border-b px-3 py-2 text-xs font-extrabold tracking-wide">
                    {col} ({colTasks.length})
                  </div>
                  <div className="grid gap-2 p-2">
                    {colTasks.map((t) => (
                      <div key={t.id} className="rounded-lg border bg-card p-2">
                        <div className="text-sm font-extrabold leading-tight">{t.title}</div>
                        <div className="mt-2 grid gap-2">
                          <div className="grid gap-1">
                            <div className="text-[11px] text-muted-foreground">Status</div>
                            <Select
                              value={t.status}
                              onValueChange={(v: string) => patch.mutate({ id: t.id, patch: { status: v as TaskStatus } })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {columns.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-1">
                            <div className="text-[11px] text-muted-foreground">Owner</div>
                            <Select
                              value={t.owner_agent_id ?? ""}
                              onValueChange={(v: string) => patch.mutate({ id: t.id, patch: { owner_agent_id: v || null } })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Unassigned</SelectItem>
                                {agents.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="text-xs text-muted-foreground">prio: {t.priority}</div>
                          <div className="truncate text-[11px] text-muted-foreground">id: {t.id}</div>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="px-1 py-2 text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {patch.error && <div className="text-sm text-destructive">{String(patch.error)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
