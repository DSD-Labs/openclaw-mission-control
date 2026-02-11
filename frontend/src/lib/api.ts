export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

import { getWorkspaceId } from "./workspace";

function buildHeaders(extra?: Record<string, string>) {
  const h: Record<string, string> = {
    accept: "application/json",
    ...extra,
  };
  const ws = getWorkspaceId();
  if (ws) h["X-MC-Workspace"] = ws;

  // v0 auth headers (optional)
  const apiKey = import.meta.env.VITE_MC_API_KEY as string | undefined;
  if (apiKey) h["X-MC-API-Key"] = apiKey;

  const role = (import.meta.env.VITE_MC_ROLE as string | undefined) ?? "admin";
  const user = (import.meta.env.VITE_MC_USER as string | undefined) ?? "didac";
  if (role) h["X-MC-Role"] = role;
  if (user) h["X-MC-User"] = user;

  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: buildHeaders({ "content-type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, patch: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: buildHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
