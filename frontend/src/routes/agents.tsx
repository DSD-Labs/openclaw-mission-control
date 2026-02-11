import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'

type Agent = {
  id: string
  name: string
  role: string
  enabled: boolean
}

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

function AgentsPage() {
  const q = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<Agent[]>('/api/agents'),
    refetchInterval: 5000,
  })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Agents</h1>
      {q.isLoading && <div>Loading…</div>}
      {q.error && <div style={{ color: 'crimson' }}>{String(q.error)}</div>}

      <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10 }}>
        <div
          style={{
            padding: 12,
            fontWeight: 700,
            borderBottom: '1px solid rgba(0,0,0,0.12)',
          }}
        >
          {q.data?.length ?? 0} agent(s)
        </div>
        <div style={{ padding: 12, display: 'grid', gap: 10 }}>
          {(q.data ?? []).map((a) => (
            <div key={a.id} style={{ display: 'grid', gap: 2 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 800 }}>{a.name}</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>{a.role}</div>
                <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                  {a.enabled ? 'enabled' : 'disabled'}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>id: {a.id}</div>
            </div>
          ))}
          {(q.data?.length ?? 0) === 0 && <div style={{ opacity: 0.7 }}>No agents yet.</div>}
        </div>
      </div>
    </div>
  )
}
