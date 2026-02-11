import { headers } from "next/headers";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function getTasks() {
  const res = await fetch(`${API}/api/tasks`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
  return res.json() as Promise<
    Array<{ id: string; title: string; status: string; priority: number; ownerAgentId?: string | null }>
  >;
}

const columns = ["BACKLOG", "READY", "DOING", "BLOCKED", "REVIEW", "DONE"] as const;

export default async function TasksPage() {
  headers();
  const tasks = await getTasks();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Kanban</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        v0 read-only board. Next: drag/drop, create/edit tasks, auto-assign agents.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 10,
          alignItems: "start",
        }}
      >
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          return (
            <div
              key={col}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 10,
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 0.4,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {col} ({colTasks.length})
              </div>
              <div style={{ padding: 10, display: "grid", gap: 8 }}>
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>prio: {t.priority}</div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>id: {t.id}</div>
                  </div>
                ))}
                {colTasks.length === 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
