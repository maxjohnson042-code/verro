"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Epic: Client dashboard - "As a Client I want to see a list of my
// brokers". Only brokers with a GRANTED AccessGrant for this organization
// appear here (Section 1.1), via GET /organizations/me/brokers.
interface VisibleBroker {
  brokerId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: string;
  relationship: { status: string } | null;
  openFlagCount: number;
  accessGrantedAt: string | null;
}

function statusVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (["DECLINED", "REVOKED", "SUSPENDED", "FLAGGED"].includes(status)) return "destructive";
  return "secondary";
}

export default function ClientBrokerListPage() {
  const [loggedOut, setLoggedOut] = useState(false);
  const [brokers, setBrokers] = useState<VisibleBroker[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || (auth.user.role !== "CLIENT_STAFF" && auth.user.role !== "CLIENT_ADMIN")) {
      setLoggedOut(true);
      return;
    }
    apiFetch<VisibleBroker[]>("/organizations/me/brokers")
      .then(setBrokers)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Brokers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in.{" "}
          <a href="/portal/login" className="text-primary hover:underline">
            Log in
          </a>
          .
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">Could not load brokers: {error}</p>;
  }

  if (!brokers) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Brokers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brokers who&apos;ve granted your organization access to their information.
      </p>

      <Card className="mt-6">
        <CardContent className="p-0">
          {brokers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No brokers have granted your organization access yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Broker</th>
                    <th className="px-4 py-2 font-medium">Verification</th>
                    <th className="px-4 py-2 font-medium">Relationship with us</th>
                    <th className="px-4 py-2 font-medium">Flags</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {brokers.map((b) => (
                    <tr key={b.brokerId}>
                      <td className="px-4 py-3">
                        {b.firstName} {b.lastName} <span className="text-xs text-muted-foreground">({b.email})</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(b.overallStatus)}>{b.overallStatus.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {b.relationship ? (
                          <Badge variant={statusVariant(b.relationship.status)}>
                            {b.relationship.status.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">no direct relationship</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {b.openFlagCount > 0 ? (
                          <Badge variant="destructive">{b.openFlagCount} open</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/portal/brokers/${b.brokerId}`} className="text-primary hover:underline">
                          View →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
