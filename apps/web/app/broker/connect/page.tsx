"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Section 2 (further reworked) - chain of trust: association and
// aggregator are independent - a broker can connect to either first, in
// any order (accepted by MFAA/FBAA / an aggregator, exclusive - connecting
// to a new aggregator auto-revokes the old, which cascades to revoke
// lender relationships). Lenders always require an ACTIVE aggregator, and
// are restricted to whichever lenders are on that aggregator's panel. Each
// connection is one lightweight accept from the organization, since the
// broker's own verification is already ACTIVE by the time they reach this
// page - see OnboardingService.addRelationship / getConnectOptions.
interface Organization {
  id: string;
  orgType: string;
  legalName: string;
}
interface TrainingRecord {
  id: string;
  trainingName: string;
  completed: boolean;
}
interface RelationshipSummary {
  organizationId: string;
  status: string;
  organization: Organization;
  creditRepNumber?: string | null;
  trainingRecords?: TrainingRecord[];
}
interface BrokerProfile {
  id: string;
  overallStatus: string;
  relationships: RelationshipSummary[];
}
interface ConnectOptions {
  verificationActive: boolean;
  activeAssociation: Organization | null;
  activeAggregator: Organization | null;
  associations: Organization[];
  aggregators: Organization[];
  lenders: Organization[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "destructive" | "outline"> = {
  PENDING_ACCEPTANCE: "secondary",
  CREDIT_REP_PENDING: "secondary",
  ACCREDITATION_PENDING: "secondary",
  ACTIVE: "success",
  DECLINED: "destructive",
  FLAGGED: "destructive",
  SUSPENDED: "destructive",
  REVOKED: "outline",
  INVITED: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPTANCE: "PENDING ACCEPTANCE",
  CREDIT_REP_PENDING: "CREDIT REP PENDING",
  ACCREDITATION_PENDING: "ACCREDITATION PENDING",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{STATUS_LABEL[status] ?? status.replace("_", " ")}</Badge>;
}

function TrainingChecklist({ records }: { records: TrainingRecord[] }) {
  const completedCount = records.filter((r) => r.completed).length;
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">
        Accreditation modules: {completedCount}/{records.length} complete
      </summary>
      <ul className="mt-1.5 grid gap-1 pl-3">
        {records.map((r) => (
          <li key={r.id} className="flex items-center gap-1.5">
            <span className={r.completed ? "text-success" : "text-muted-foreground"}>{r.completed ? "✓" : "○"}</span>
            {r.trainingName}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function BrokerConnectPage() {
  const [loggedOut, setLoggedOut] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [options, setOptions] = useState<ConnectOptions | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState<Organization | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.user.role !== "BROKER" || !auth.user.brokerId) {
      setLoggedOut(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const data = await apiFetch<BrokerProfile>("/brokers/me/profile");
      setProfile(data);
      if (data.overallStatus === "ACTIVE") {
        const opts = await apiFetch<ConnectOptions>(`/brokers/${data.id}/connect-options`);
        setOptions(opts);
      }
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  function relationshipFor(orgId: string) {
    return profile?.relationships.find((r) => r.organizationId === orgId);
  }

  async function connect(org: Organization) {
    if (!profile) return;
    setBusyOrgId(org.id);
    setStatus(null);
    try {
      await apiFetch(`/brokers/${profile.id}/relationships`, {
        method: "POST",
        body: JSON.stringify({ organizationId: org.id }),
      });
      setStatus(`Connected with ${org.legalName}. They have one lightweight step to accept you.`);
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusyOrgId(null);
      setConfirmSwitch(null);
    }
  }

  function handleAggregatorClick(org: Organization) {
    if (options?.activeAggregator && options.activeAggregator.id !== org.id) {
      // Switching aggregators auto-revokes the current one, which cascades
      // to revoke every lender relationship connected through it - make
      // sure the broker understands that before it happens.
      setConfirmSwitch(org);
      return;
    }
    connect(org);
  }

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Connect with organizations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in.{" "}
          <a href="/broker/login" className="text-primary hover:underline">
            Log in
          </a>
          .
        </p>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (profile.overallStatus !== "ACTIVE" || !options) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Connect with organizations</h1>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Verification in progress</CardTitle>
            <CardDescription>
              You can connect with an association, aggregator, and lenders once your verification is complete.
              Current status: <span className="font-medium text-foreground">{profile.overallStatus}</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasActiveAggregator = !!options.activeAggregator;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Connect with organizations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Association and aggregator can be connected in either order. Lenders always require an aggregator first.
        Each just needs one lightweight step to accept you, since your verification is already done.
      </p>

      {/* Association - independent of aggregator, either order */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Association</CardTitle>
          <CardDescription>
            Most lenders expect this, but it isn&apos;t required before connecting with an aggregator or lender.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {options.associations.map((org) => {
            const rel = relationshipFor(org.id);
            return (
              <div key={org.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm">{org.legalName}</span>
                {rel ? (
                  <StatusBadge status={rel.status} />
                ) : (
                  <Button size="sm" variant="outline" disabled={busyOrgId === org.id} onClick={() => connect(org)}>
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Aggregator - independent of association, either order */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Aggregator</CardTitle>
          <CardDescription>
            Exclusive — connecting to a new aggregator auto-revokes your current one and offboards its lenders.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {options.aggregators.map((org) => {
            const rel = relationshipFor(org.id);
            const isCurrent = options.activeAggregator?.id === org.id;
            return (
              <div key={org.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{org.legalName}</span>
                  {isCurrent ? (
                    <StatusBadge status={rel?.status ?? "ACTIVE"} />
                  ) : rel && rel.status !== "REVOKED" && rel.status !== "DECLINED" ? (
                    <StatusBadge status={rel.status} />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyOrgId === org.id}
                      onClick={() => handleAggregatorClick(org)}
                    >
                      {hasActiveAggregator ? "Switch to this aggregator" : "Connect"}
                    </Button>
                  )}
                </div>
                {isCurrent && rel?.status === "CREDIT_REP_PENDING" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Waiting on {org.legalName} to record your credit representative appointment.
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Lenders - always requires an ACTIVE aggregator */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Lenders</CardTitle>
          <CardDescription>
            {hasActiveAggregator
              ? "Only lenders on your aggregator's panel are shown."
              : "Unlocks once an aggregator has accepted you."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {!hasActiveAggregator && (
            <p className="text-sm text-muted-foreground sm:col-span-2">Waiting on aggregator acceptance.</p>
          )}
          {hasActiveAggregator && options.lenders.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Your aggregator has no lender panel agreements yet.
            </p>
          )}
          {hasActiveAggregator &&
            options.lenders.map((org) => {
              const rel = relationshipFor(org.id);
              const showChecklist =
                rel && rel.status !== "REVOKED" && rel.status !== "DECLINED" && (rel.trainingRecords?.length ?? 0) > 0;
              return (
                <div key={org.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{org.legalName}</span>
                    {rel && rel.status !== "REVOKED" && rel.status !== "DECLINED" ? (
                      <StatusBadge status={rel.status} />
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyOrgId === org.id} onClick={() => connect(org)}>
                        Connect
                      </Button>
                    )}
                  </div>
                  {showChecklist && <TrainingChecklist records={rel!.trainingRecords!} />}
                </div>
              );
            })}
        </CardContent>
      </Card>

      {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}

      {confirmSwitch && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Switch aggregator?</CardTitle>
              <CardDescription>
                Connecting to {confirmSwitch.legalName} will revoke your relationship with{" "}
                {options.activeAggregator?.legalName}, and every lender you connected through them will be
                offboarded too. You&apos;ll be able to reconnect to lenders once {confirmSwitch.legalName} accepts
                you — those lenders will see your history.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmSwitch(null)}>
                Cancel
              </Button>
              <Button onClick={() => connect(confirmSwitch)} disabled={busyOrgId === confirmSwitch.id}>
                Confirm switch
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
