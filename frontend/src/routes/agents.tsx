import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Agent = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
};

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const q = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiGet<Agent[]>("/api/agents"),
    refetchInterval: 5000,
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Agents</h1>
        <Badge variant="secondary">read-only</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{q.data?.length ?? 0} agent(s)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {q.error && (
            <div className="text-sm text-destructive">{String(q.error)}</div>
          )}

          {(q.data ?? []).map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <div className="flex items-baseline gap-3">
                <div className="font-extrabold">{a.name}</div>
                <div className="text-sm text-muted-foreground">{a.role}</div>
                <div className="ml-auto text-xs text-muted-foreground">
                  {a.enabled ? "enabled" : "disabled"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">id: {a.id}</div>
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
