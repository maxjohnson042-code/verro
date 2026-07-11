import type { ReactNode } from "react";
import { NavShell } from "@/components/nav-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <NavShell
      brand="Verro — Internal Admin"
      items={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/review", label: "Review queue" },
        { href: "/admin/login", label: "Login" },
      ]}
    >
      {children}
    </NavShell>
  );
}
