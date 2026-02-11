import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WarRoomRun = { ok: boolean; conversationId: string };

type Turn = {
  id: string;
  speaker_type: string;
  speaker_id?: string | null;
  content: string;
  created_at?: string | null;
};

type Conversation = {
  id: string;
  type: string;
  task_id?: string | null;
  turns: Turn[];
};

export const Route = createFileRoute("/war-room")({
  component: WarRoomPage,
});

function WarRoomPage() {
  const run = useMutation({
    mutationFn: () => apiPost<WarRoomRun>("/api/war-room/run"),
  });

  const convoQ = useQuery({
    queryKey: ["conversation", run.data?.conversationId],
    queryFn: () => apiGet<Conversation>(`/api/conversations/${run.data!.conversationId}`),
    enabled: !!run.data?.conversationId,
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">War Room</h1>
        <Badge variant="secondary">v0</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hourly sync meeting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            Runs the Chair orchestrator and logs a multi-turn transcript.
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

      {convoQ.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {convoQ.data.turns.map((t) => (
              <div key={t.id} className="rounded-lg border p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {t.speaker_type}
                  {t.speaker_id ? `:${t.speaker_id}` : ""}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-sm leading-snug">
                  {t.content}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
