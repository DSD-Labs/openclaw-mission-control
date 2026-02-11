import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <header className="flex items-center justify-between gap-4 border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="font-black tracking-tight">OpenClaw Mission Control</div>
          </div>

          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link to="/" className="opacity-80 hover:opacity-100">
              Home
            </Link>
            <Link to="/agents" className="opacity-80 hover:opacity-100">
              Agents
            </Link>
            <Link to="/tasks" className="opacity-80 hover:opacity-100">
              Kanban
            </Link>
            <Link to="/war-room" className="opacity-80 hover:opacity-100">
              War Room
            </Link>
            <Link to="/audit" className="opacity-80 hover:opacity-100">
              Audit
            </Link>
          </nav>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Menu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/">Home</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/agents">Agents</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tasks">Kanban</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/war-room">War Room</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/audit">Audit</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="py-6">
          <Outlet />
        </main>
      </div>

      <TanStackRouterDevtools position="bottom-right" />
    </div>
  ),
});
