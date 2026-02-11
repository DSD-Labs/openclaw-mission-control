import { headers } from "next/headers";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function getAgents() {
  const res = await fetch(`${API}/api/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load agents: ${res.status}`);
  return res.json() as Promise<
    Array<{ id: string; name: string; role: string; enabled: boolean; updatedAt: string }>
  >;
}

export default async function AgentsPage() {
  // touch headers() so Next treats this as dynamic (avoids accidental caching)
  headers();

  const agents = await getAgents();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Agents</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        Employee agents are configured server-side (v0). UI editing comes next.
      </p>

      <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10 }}>
        <div style={{ padding: 12, fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          {agents.length} agent(s)
        </div>
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {agents.map((a) => (
            <div key={a.id} style={{ display: "grid", gap: 2 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>{a.role}</div>
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                  {a.enabled ? "enabled" : "disabled"}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>id: {a.id}</div>
            </div>
          ))}
          {agents.length === 0 && <div style={{ opacity: 0.7 }}>No agents yet.</div>}
        </div>
      </div>
    </div>
  );
}
