import type { ReactNode } from "react";
import { NavShell } from "@/components/nav-shell";

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <NavShell
      brand="Verro — Client Portal"
      items={[
        { href: "/portal", label: "Dashboard" },
        { href: "/portal/brokers", label: "Brokers" },
        { href: "/portal/login", label: "Login" },
      ]}
    >
      {children}
    </NavShell>
  );
}
