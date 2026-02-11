import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '../lib/api'

export const Route = createFileRoute('/war-room')({
  component: WarRoomPage,
})

function WarRoomPage() {
  const run = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; conversationId: string }>('/api/war-room/run'),
  })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>War Room</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Hourly sync meeting. v0 stub: creates a WAR_ROOM conversation.
      </p>

      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.16)',
          background: run.isPending ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)',
          cursor: run.isPending ? 'not-allowed' : 'pointer',
          width: 'fit-content',
          fontWeight: 800,
        }}
      >
        {run.isPending ? 'Running…' : 'Run War Room (stub)'}
      </button>

      {run.data && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
            background: 'rgba(0,0,0,0.03)',
            overflowX: 'auto',
            fontSize: 12,
          }}
        >
          {JSON.stringify(run.data, null, 2)}
        </pre>
      )}

      {run.error && <div style={{ color: 'crimson' }}>{String(run.error)}</div>}
    </div>
  )
}
