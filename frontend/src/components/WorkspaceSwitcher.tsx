import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiGet } from "@/lib/api";
import { getWorkspaceId, setWorkspaceId } from "@/lib/workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Workspace = { id: string; name: string; gateway_id?: string | null };

export function WorkspaceSwitcher() {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>(getWorkspaceId() ?? "");

  const wsQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiGet<Workspace[]>("/api/workspaces"),
    refetchInterval: 20000,
  });

  // When value changes, store and invalidate workspace-scoped queries.
  const setWs = useMutation({
    mutationFn: async (id: string) => {
      setWorkspaceId(id || null);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });

  useEffect(() => {
    // keep in sync if localStorage changed elsewhere
    setValue(getWorkspaceId() ?? "");
  }, [wsQ.data?.length]);

  return (
    <Select
      value={value}
      onValueChange={(v: string) => {
        const next = v === "__none__" ? "" : v;
        setValue(next);
        setWs.mutate(next);
      }}
    >
      <SelectTrigger className="h-8 w-[220px]">
        <SelectValue placeholder="Workspace" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">(All / none)</SelectItem>
        {(wsQ.data ?? []).map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
