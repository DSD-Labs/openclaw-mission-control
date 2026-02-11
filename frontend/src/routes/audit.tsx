import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditEvent = {
  id: string;
  actor: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

export const Route = createFileRoute("/audit")({
  component: AuditPage,
});

function AuditPage() {
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGet<AuditEvent[]>("/api/audit"),
    refetchInterval: 5000,
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Audit log</h1>
        <Badge variant="secondary">v0</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {q.error && <div className="text-sm text-destructive">{String(q.error)}</div>}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {e.created_at ?? ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-semibold">{e.actor}</div>
                      <div className="text-xs text-muted-foreground">{e.role}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{e.action}</TableCell>
                    <TableCell className="min-w-[360px]">
                      <div className="text-sm font-semibold">
                        {e.entity_type}{e.entity_id ? `:${e.entity_id}` : ""}
                      </div>
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(e.payload ?? {}, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {(q.data?.length ?? 0) === 0 && !q.isLoading && (
            <div className="text-sm text-muted-foreground">No events yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
