import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type Gateway = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at?: string | null;
};

type Workspace = {
  id: string;
  name: string;
  gateway_id?: string | null;
  telegram_chat_id?: string | null;
  telegram_topic_id?: string | null;
  created_at?: string | null;
};

export default function SettingsPage() {
  const qc = useQueryClient();

  const gatewaysQ = useQuery({
    queryKey: ["gateways"],
    queryFn: () => apiGet<Gateway[]>("/api/gateways"),
    refetchInterval: 10000,
  });

  const workspacesQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiGet<Workspace[]>("/api/workspaces"),
    refetchInterval: 10000,
  });

  const [gwForm, setGwForm] = useState({ name: "", url: "", token: "", enabled: true });
  const [wsForm, setWsForm] = useState({ name: "", gateway_id: "", telegram_chat_id: "", telegram_topic_id: "" });

  const createGateway = useMutation({
    mutationFn: (body: typeof gwForm) => apiPost<Gateway>("/api/gateways", body),
    onSuccess: async () => {
      setGwForm({ name: "", url: "", token: "", enabled: true });
      await qc.invalidateQueries({ queryKey: ["gateways"] });
    },
  });

  const createWorkspace = useMutation({
    mutationFn: (body: {
      name: string;
      gateway_id?: string | null;
      telegram_chat_id?: string | null;
      telegram_topic_id?: string | null;
    }) => apiPost<Workspace>("/api/workspaces", body),
    onSuccess: async () => {
      setWsForm({ name: "", gateway_id: "", telegram_chat_id: "", telegram_topic_id: "" });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const gateways = gatewaysQ.data ?? [];

  const gatewayOptions = useMemo(() => gateways, [gateways]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">Settings</h1>
        <Badge variant="secondary">multi-gateway v0</Badge>
      </div>

      <Tabs defaultValue="gateways">
        <TabsList>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
        </TabsList>

        <TabsContent value="gateways" className="grid gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add gateway</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Name</label>
                  <Input value={gwForm.name} onChange={(e) => setGwForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <label className="text-sm font-semibold">URL</label>
                  <Input
                    value={gwForm.url}
                    onChange={(e) => setGwForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="http://gateway-host:18789"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold">Token</label>
                <Input
                  value={gwForm.token}
                  onChange={(e) => setGwForm((f) => ({ ...f, token: e.target.value }))}
                  placeholder="Bearer token"
                />
                <div className="text-xs text-muted-foreground">
                  v0 stores token plaintext in SQLite. We’ll encrypt later.
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  onClick={() => createGateway.mutate(gwForm)}
                  disabled={createGateway.isPending || !gwForm.name || !gwForm.url || !gwForm.token}
                >
                  {createGateway.isPending ? "Creating…" : "Create gateway"}
                </Button>
              </div>
              {createGateway.error && (
                <div className="text-sm text-destructive">{String(createGateway.error)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gateways ({gateways.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {gatewaysQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
              {gatewaysQ.error && <div className="text-sm text-destructive">{String(gatewaysQ.error)}</div>}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gateways.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-semibold">{g.name}</TableCell>
                        <TableCell className="font-mono text-xs">{g.url}</TableCell>
                        <TableCell>{g.enabled ? "yes" : "no"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces" className="grid gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add workspace</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Name</label>
                  <Input
                    value={wsForm.name}
                    onChange={(e) => setWsForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="DSD-Labs"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Gateway ID (optional)</label>
                  <Input
                    value={wsForm.gateway_id}
                    onChange={(e) => setWsForm((f) => ({ ...f, gateway_id: e.target.value }))}
                    placeholder={gatewayOptions[0]?.id ?? ""}
                  />
                  <div className="text-xs text-muted-foreground">
                    v0: paste the gateway id. Next: dropdown select.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Telegram chat id (optional)</label>
                  <Input
                    value={wsForm.telegram_chat_id}
                    onChange={(e) => setWsForm((f) => ({ ...f, telegram_chat_id: e.target.value }))}
                    placeholder="-100..."
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Telegram topic id (optional)</label>
                  <Input
                    value={wsForm.telegram_topic_id}
                    onChange={(e) => setWsForm((f) => ({ ...f, telegram_topic_id: e.target.value }))}
                    placeholder="2298"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  onClick={() =>
                    createWorkspace.mutate({
                      name: wsForm.name,
                      gateway_id: wsForm.gateway_id || null,
                      telegram_chat_id: wsForm.telegram_chat_id || null,
                      telegram_topic_id: wsForm.telegram_topic_id || null,
                    })
                  }
                  disabled={createWorkspace.isPending || !wsForm.name}
                >
                  {createWorkspace.isPending ? "Creating…" : "Create workspace"}
                </Button>
              </div>
              {createWorkspace.error && (
                <div className="text-sm text-destructive">{String(createWorkspace.error)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspaces ({workspacesQ.data?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {workspacesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
              {workspacesQ.error && <div className="text-sm text-destructive">{String(workspacesQ.error)}</div>}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Telegram</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(workspacesQ.data ?? []).map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-semibold">{w.name}</TableCell>
                        <TableCell className="font-mono text-xs">{w.gateway_id ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {(w.telegram_chat_id ?? "—") + (w.telegram_topic_id ? ` / ${w.telegram_topic_id}` : "")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        Next: thread workspace selection through Agents/Tasks/War Room, and use the workspace’s gateway.
      </div>
    </div>
  );
}
