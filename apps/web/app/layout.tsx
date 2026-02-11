import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "OpenClaw Mission Control",
  description: "Control plane for OpenClaw agents: RBAC, Kanban, War Room, transcripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              padding: "12px 0",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Link href="/" style={{ fontWeight: 700, letterSpacing: 0.2 }}>
              OpenClaw Mission Control
            </Link>
            <nav style={{ display: "flex", gap: 14, fontSize: 14 }}>
              <Link href="/agents">Agents</Link>
              <Link href="/tasks">Kanban</Link>
              <Link href="/war-room">War Room</Link>
            </nav>
          </header>
          <main style={{ padding: "18px 0" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
