import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'

type Task = {
  id: string
  title: string
  status: 'BACKLOG' | 'READY' | 'DOING' | 'BLOCKED' | 'REVIEW' | 'DONE'
  priority: number
}

const columns: Task['status'][] = ['BACKLOG', 'READY', 'DOING', 'BLOCKED', 'REVIEW', 'DONE']

export const Route = createFileRoute('/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const q = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiGet<Task[]>('/api/tasks'),
    refetchInterval: 5000,
  })

  const tasks = q.data ?? []

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Kanban</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        v0 read-only. Next: drag/drop + create/edit tasks.
      </p>

      {q.isLoading && <div>Loading…</div>}
      {q.error && <div style={{ color: 'crimson' }}>{String(q.error)}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col)
          return (
            <div key={col} style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10 }}>
              <div
                style={{
                  padding: 10,
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.4,
                  borderBottom: '1px solid rgba(0,0,0,0.12)',
                }}
              >
                {col} ({colTasks.length})
              </div>
              <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.10)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{t.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>prio: {t.priority}</div>
                    <div style={{ fontSize: 11, opacity: 0.55 }}>id: {t.id}</div>
                  </div>
                ))}
                {colTasks.length === 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
