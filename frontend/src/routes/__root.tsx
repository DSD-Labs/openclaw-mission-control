import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '12px 0',
          borderBottom: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ fontWeight: 800 }}>OpenClaw Mission Control</div>
        <nav style={{ display: 'flex', gap: 12, fontSize: 14 }}>
          <a href='/'>Home</a>
          <a href='/agents'>Agents</a>
          <a href='/tasks'>Kanban</a>
          <a href='/war-room'>War Room</a>
        </nav>
      </header>
      <main style={{ padding: '18px 0' }}>
        <Outlet />
      </main>
      <TanStackRouterDevtools position='bottom-right' />
    </div>
  ),
})
