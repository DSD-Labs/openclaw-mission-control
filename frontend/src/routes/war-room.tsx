import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WarRoomRun = { ok: boolean; conversationId: string };

export const Route = createFileRoute("/war-room")({
  component: WarRoomPage,
});

function WarRoomPage() {
  const run = useMutation({
    mutationFn: () => apiPost<WarRoomRun>("/api/war-room/run"),
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">War Room</h1>
        <Badge variant="secondary">stub</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hourly sync meeting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            v0 stub: creates a WAR_ROOM conversation and a system turn.
          </div>

          <div>
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? "Running…" : "Run War Room"}
            </Button>
          </div>

          {run.data && (
            <pre className="overflow-x-auto rounded-lg border bg-muted p-3 text-xs">
              {JSON.stringify(run.data, null, 2)}
            </pre>
          )}

          {run.error && <div className="text-sm text-destructive">{String(run.error)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
