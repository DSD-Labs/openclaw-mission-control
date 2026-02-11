import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WarRoomRun = { ok: boolean; conversationId: string; warRoomRunId?: string };

type WarRoomRunRow = {
  id: string;
  created_at?: string | null;
  final_answer: string;
  conversation_id: string;
  telegram_error?: string | null;
};

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

  const runsQ = useQuery({
    queryKey: ["warRoomRuns"],
    queryFn: () => apiGet<WarRoomRunRow[]>("/api/war-room/runs?limit=50"),
    refetchInterval: 10000,
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run history</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {runsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {runsQ.error && <div className="text-sm text-destructive">{String(runsQ.error)}</div>}

          <div className="grid gap-2">
            {(runsQ.data ?? []).map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">{r.created_at ?? ""}</div>
                  <div className="text-xs font-mono">{r.id}</div>
                </div>
                <div className="mt-1 text-sm font-semibold">{r.final_answer}</div>
                {r.telegram_error ? (
                  <div className="mt-1 text-xs text-destructive">telegram: {r.telegram_error}</div>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  conversation: <span className="font-mono">{r.conversation_id}</span>
                </div>
              </div>
            ))}
            {(runsQ.data?.length ?? 0) === 0 && !runsQ.isLoading && (
              <div className="text-sm text-muted-foreground">No runs yet.</div>
            )}
          </div>
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
