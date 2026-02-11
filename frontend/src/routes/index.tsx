import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Mission Control</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        FastAPI backend + TanStack frontend scaffold.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
        <li>Agents: employee profiles (Soul + skill allowlist)</li>
        <li>Kanban: tasks and status columns</li>
        <li>War Room: hourly meeting (stub)</li>
        <li>Transcripts: every turn stored and viewable</li>
      </ul>
    </div>
  ),
})
