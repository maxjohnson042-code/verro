"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Epic: Client dashboard - "As a Client I want to see a count of my
// brokers by status". Everything here is scoped by GRANTED AccessGrant
// (Section 1.1) via GET /organizations/me/dashboard - nothing about a
// broker is visible to this org without one, regardless of relationship
// status.
interface DashboardSummary {
  totalVisibleBrokers: number;
  byVerificationStatus: Record<string, number>;
  byRelationshipStatus: Record<string, number>;
  openFlagCount: number;
}

export default function ClientDashboardPage() {
  const [loggedOut, setLoggedOut] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || (auth.user.role !== "CLIENT_STAFF" && auth.user.role !== "CLIENT_ADMIN")) {
      setLoggedOut(true);
      return;
    }
    apiFetch<DashboardSummary>("/organizations/me/dashboard")
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, []);

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Client dashboard</h1>
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
    return <p className="text-sm text-destructive">Could not load dashboard: {error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Client dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brokers who&apos;ve granted your organization access to their information.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Visible brokers</CardDescription>
            <CardTitle className="text-3xl">{summary.totalVisibleBrokers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open compliance flags</CardDescription>
            <CardTitle className="text-3xl">{summary.openFlagCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active relationships</CardDescription>
            <CardTitle className="text-3xl">{summary.byRelationshipStatus.ACTIVE ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Brokers by verification status</CardTitle>
          <CardDescription>Across every broker visible to your organization.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(summary.byVerificationStatus).length === 0 && (
            <p className="text-sm text-muted-foreground">No visible brokers yet.</p>
          )}
          {Object.entries(summary.byVerificationStatus).map(([status, count]) => (
            <Badge key={status} variant="secondary">
              {status.replace(/_/g, " ")}: {count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Relationships with your organization</CardTitle>
          <CardDescription>By status, for whichever brokers have connected directly with you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(summary.byRelationshipStatus).length === 0 && (
            <p className="text-sm text-muted-foreground">No relationships yet.</p>
          )}
          {Object.entries(summary.byRelationshipStatus).map(([status, count]) => (
            <Badge key={status} variant="secondary">
              {status.replace(/_/g, " ")}: {count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        <a href="/portal/brokers" className="text-primary hover:underline">
          View broker list →
        </a>
      </p>
    </div>
  );
}
