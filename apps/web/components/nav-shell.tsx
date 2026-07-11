"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearAuth, getAuth, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
}

// Shared header/nav shell for all three portals (Broker, Client/FI, Admin).
// Each portal's layout.tsx passes its own brand label and nav items -
// keeps the three URL-segment portals visually consistent without a
// shared layout.tsx (Next.js App Router route groups aren't used here
// since the URL prefixes /broker, /portal, /admin need to stay real).
export function NavShell({
  brand,
  items,
  children,
}: {
  brand: string;
  items: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getAuth()?.user ?? null);
  }, [pathname]);

  function handleLogout() {
    clearAuth();
    setUser(null);
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-tight">{brand}</span>
            <nav className="flex items-center gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-muted-foreground">
                  {user.email} <span className="text-xs">({user.role})</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">Not logged in</span>
            )}
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
