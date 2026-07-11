import type { ReactNode } from "react";
import { NavShell } from "@/components/nav-shell";

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <NavShell
      brand="Verro — Broker"
      items={[
        { href: "/broker", label: "Dashboard" },
        { href: "/broker/onboarding", label: "Create account" },
        { href: "/broker/connect", label: "Connect" },
        { href: "/broker/profile", label: "Profile" },
        { href: "/broker/login", label: "Login" },
      ]}
    >
      {children}
    </NavShell>
  );
}
