"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export function RunWarRoomButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        onClick={async () => {
          setLoading(true);
          setResult(null);
          try {
            const res = await fetch(`${API}/api/war-room/run`, {
              method: "POST",
              headers: { "content-type": "application/json" },
            });
            const json = await res.json();
            setResult(JSON.stringify(json, null, 2));
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.16)",
          background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
          color: "inherit",
          cursor: loading ? "not-allowed" : "pointer",
          width: "fit-content",
          fontWeight: 700,
        }}
      >
        {loading ? "Running…" : "Run War Room (stub)"}
      </button>

      {result && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            overflowX: "auto",
            fontSize: 12,
          }}
        >
          {result}
        </pre>
      )}
    </div>
  );
}
