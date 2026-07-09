import type { ReactNode } from "react";

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
        <strong>Verro — Client Portal</strong>
        <nav style={{ display: "inline-flex", gap: 12, marginLeft: 24 }}>
          <a href="/portal">Dashboard</a>
          <a href="/portal/brokers">Brokers</a>
        </nav>
      </header>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
