import { headers } from "next/headers";
import { RunWarRoomButton } from "./RunWarRoomButton";

export default async function WarRoomPage() {
  headers();
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>War Room</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        Hourly sync meeting. Next: Chair orchestrator + agent updates + Kanban moves + Telegram final answer.
      </p>

      <RunWarRoomButton />
    </div>
  );
}
