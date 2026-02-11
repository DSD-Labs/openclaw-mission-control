import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Mission Control</h1>
        <Badge variant="secondary">v0 scaffold</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this is</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <div>
            Company control plane for OpenClaw agents: employee profiles (Soul + skill allowlists),
            Kanban-driven work, hourly War Room orchestration, and full transcripts.
          </div>
          <ul className="list-disc pl-5">
            <li>Agents: profiles + permissions</li>
            <li>Kanban: tasks + statuses</li>
            <li>War Room: orchestrated meeting (stub right now)</li>
            <li>Transcripts: every turn stored + viewable</li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Next: wire OpenClaw gateway adapter + Telegram final-answer posting to this topic.
      </div>
    </div>
  ),
});
