import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: number;
  owner_agent_id?: string | null;
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

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();

  const taskQ = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => apiGet<Task>(`/api/tasks/${taskId}`),
  });

  const convoQ = useQuery({
    queryKey: ["taskConversation", taskId],
    queryFn: () => apiGet<Conversation>(`/api/tasks/${taskId}/conversation`),
    enabled: !!taskId,
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            <Link to="/tasks" className="underline">
              Kanban
            </Link>
            <span> / </span>
            <span className="font-mono">{taskId}</span>
          </div>
          <h1 className="text-xl font-black tracking-tight">
            {taskQ.data?.title ?? "Task"}
          </h1>
        </div>
        <Badge variant="secondary">details</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {taskQ.isLoading && <div className="text-muted-foreground">Loading…</div>}
          {taskQ.error && <div className="text-destructive">{String(taskQ.error)}</div>}

          {taskQ.data && (
            <>
              <div className="text-muted-foreground">
                status: <span className="font-mono">{taskQ.data.status}</span> · prio:{" "}
                <span className="font-mono">{taskQ.data.priority}</span>
              </div>
              {taskQ.data.owner_agent_id ? (
                <div className="text-muted-foreground">
                  owner_agent_id: <span className="font-mono">{taskQ.data.owner_agent_id}</span>
                </div>
              ) : null}
              <Separator />
              <div className="whitespace-pre-wrap">
                {taskQ.data.description || "(no description)"}
              </div>
            </>
          )}

          <div>
            <Button asChild variant="outline" size="sm">
              <a href={`#transcript`}>Jump to transcript</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="transcript">
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {convoQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {convoQ.error && <div className="text-sm text-destructive">{String(convoQ.error)}</div>}

          {(convoQ.data?.turns ?? []).map((t) => (
            <div key={t.id} className="rounded-lg border p-3">
              <div className="text-xs font-semibold text-muted-foreground">
                {t.speaker_type}
                {t.speaker_id ? `:${t.speaker_id}` : ""}
                {t.created_at ? ` · ${t.created_at}` : ""}
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-snug">{t.content}</pre>
            </div>
          ))}

          {(convoQ.data?.turns?.length ?? 0) === 0 && !convoQ.isLoading && (
            <div className="text-sm text-muted-foreground">No transcript turns yet.</div>
          )}

          {convoQ.data ? (
            <div className="text-xs text-muted-foreground">
              conversation id: <span className="font-mono">{convoQ.data.id}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
