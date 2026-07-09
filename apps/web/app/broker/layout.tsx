import type { ReactNode } from "react";

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
        <strong>Verro — Broker</strong>
        <nav style={{ display: "inline-flex", gap: 12, marginLeft: 24 }}>
          <a href="/broker">Dashboard</a>
          <a href="/broker/onboarding">Onboarding</a>
          <a href="/broker/profile">Profile</a>
        </nav>
      </header>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
