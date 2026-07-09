import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
        <strong>Verro — Internal Admin</strong>
        <nav style={{ display: "inline-flex", gap: 12, marginLeft: 24 }}>
          <a href="/admin">Dashboard</a>
          <a href="/admin/review">Review queue</a>
        </nav>
      </header>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
