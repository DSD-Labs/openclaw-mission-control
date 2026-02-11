import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Task = {
  id: string;
  title: string;
  status: "BACKLOG" | "READY" | "DOING" | "BLOCKED" | "REVIEW" | "DONE";
  priority: number;
};

const columns: Task["status"][] = [
  "BACKLOG",
  "READY",
  "DOING",
  "BLOCKED",
  "REVIEW",
  "DONE",
];

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const q = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiGet<Task[]>("/api/tasks"),
    refetchInterval: 5000,
  });

  const tasks = q.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Kanban</h1>
        <Badge variant="secondary">read-only</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Board</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            v0 read-only. Next: create/edit + drag/drop + auto-assign agents.
          </div>

          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {q.error && <div className="text-sm text-destructive">{String(q.error)}</div>}

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
                        <div className="text-sm font-extrabold leading-tight">
                          {t.title}
                        </div>
                        <div className="text-xs text-muted-foreground">prio: {t.priority}</div>
                        <div className="truncate text-[11px] text-muted-foreground">id: {t.id}</div>
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
        </CardContent>
      </Card>
    </div>
  );
}
