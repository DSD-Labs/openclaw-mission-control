export default async function Home() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Mission Control</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        v0 scaffold: Agents, Kanban tasks, War Room stub, and transcripts API.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        <li>Agents: create employee profiles (Soul + skill allowlist)</li>
        <li>Kanban: tasks and status columns</li>
        <li>War Room: orchestrated hourly meeting (stub for now)</li>
        <li>Transcripts: every turn stored and viewable</li>
      </ul>
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Next: wire OpenClaw gateway adapter + Telegram “final answer” posting.
      </div>
    </div>
  );
}
