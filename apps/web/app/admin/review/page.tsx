"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Section 2 (reworked): Admin now works two distinct queues instead of
// one. Verification (IDV/screening/doc-review/approval) happens once per
// BROKER - one row per broker, driven by POST /brokers/:id/transition.
// Once a broker is ACTIVE, any organization they connect with just needs
// one lightweight accept - a much smaller queue, driven by
// POST /relationships/:id/transition. Flagged/suspended can happen at
// either level: a broker can be globally suspended, or a single
// organization can flag/suspend just their own relationship.
interface VerificationBroker {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: string;
}
interface TrainingRecord {
  id: string;
  trainingName: string;
  completed: boolean;
}
interface BrokerContextRelationship {
  status: string;
  organization: { legalName: string; orgType: string };
}
interface RelationshipRow {
  id: string;
  status: string;
  creditRepNumber?: string | null;
  broker: {
    id: string;
    firstName: string;
    lastName: string;
    relationships?: BrokerContextRelationship[];
  };
  organization: { legalName: string; orgType: string };
  trainingRecords?: TrainingRecord[];
}

const VERIFICATION_NEXT: Record<string, string[]> = {
  SUBMITTED: ["IDV_PENDING"],
  IDV_PENDING: ["SCREENING_PENDING", "SUSPENDED"],
  SCREENING_PENDING: ["DOC_REVIEW_PENDING", "SUSPENDED"],
  DOC_REVIEW_PENDING: ["PENDING_ADMIN_APPROVAL", "SUSPENDED"],
  PENDING_ADMIN_APPROVAL: ["ACTIVE", "DECLINED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
};

const RELATIONSHIP_NEXT: Record<string, string[]> = {
  PENDING_ACCEPTANCE: ["ACTIVE", "DECLINED"],
  CREDIT_REP_PENDING: ["ACTIVE", "DECLINED"],
  ACCREDITATION_PENDING: ["ACTIVE", "DECLINED"],
  FLAGGED: ["ACTIVE", "SUSPENDED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
};

function statusVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (["DECLINED", "REVOKED", "SUSPENDED", "FLAGGED"].includes(status)) return "destructive";
  return "secondary";
}

// Broker context shown alongside a pending connection - "association and
// aggregator are both happy" is the whole point of the chain of trust, so a
// reviewer shouldn't have to look the broker up separately to see it.
function BrokerContext({ relationships }: { relationships: BrokerContextRelationship[] }) {
  const association = relationships.find((r) => r.organization.orgType === "ASSOCIATION" && r.status === "ACTIVE");
  const aggregator = relationships.find((r) => r.organization.orgType === "AGGREGATOR" && r.status === "ACTIVE");
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Association: {association ? association.organization.legalName : "none"} · Aggregator:{" "}
      {aggregator ? aggregator.organization.legalName : "none"}
    </p>
  );
}

function actionVariant(toStatus: string): "default" | "destructive" | "outline" {
  if (["DECLINED", "FLAGGED", "SUSPENDED", "REVOKED"].includes(toStatus)) return "destructive";
  if (toStatus === "ACTIVE") return "default";
  return "outline";
}

function needsReason(toStatus: string) {
  return ["DECLINED", "FLAGGED", "SUSPENDED", "REVOKED"].includes(toStatus);
}

export default function AdminReviewQueuePage() {
  const [verificationQueue, setVerificationQueue] = useState<VerificationBroker[] | null>(null);
  const [pendingAcceptances, setPendingAcceptances] = useState<RelationshipRow[] | null>(null);
  const [flagged, setFlagged] = useState<{ brokers: VerificationBroker[]; relationships: RelationshipRow[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [creditRepInputs, setCreditRepInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const auth = getAuth();
    if (!auth || (auth.user.role !== "INTERNAL_ADMIN" && auth.user.role !== "INTERNAL_REVIEWER")) {
      setUnauthorized(true);
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [v, p, f] = await Promise.all([
        apiFetch<VerificationBroker[]>("/admin/review-queue"),
        apiFetch<RelationshipRow[]>("/admin/pending-acceptances"),
        apiFetch<{ brokers: VerificationBroker[]; relationships: RelationshipRow[] }>("/admin/flagged"),
      ]);
      setVerificationQueue(v);
      setPendingAcceptances(p);
      setFlagged(f);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleBrokerTransition(brokerId: string, toStatus: string) {
    let reason: string | undefined;
    if (needsReason(toStatus)) {
      reason = window.prompt(`Reason for moving to ${toStatus}?`) ?? undefined;
    }
    setStatus(`Moving to ${toStatus}...`);
    try {
      await apiFetch(`/brokers/${brokerId}/transition`, {
        method: "POST",
        body: JSON.stringify({ toStatus, reason }),
      });
      setStatus(null);
      await loadAll();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  // Checklist rework - Section: Licensing structure. Records the credit
  // rep appointment and (per ComplianceService.recordCreditRep) auto-tries
  // to activate the relationship in the same step.
  async function handleRecordCreditRep(relationshipId: string) {
    const creditRepNumber = creditRepInputs[relationshipId]?.trim();
    if (!creditRepNumber) return;
    setStatus("Recording credit representative appointment...");
    try {
      await apiFetch(`/relationships/${relationshipId}/credit-rep`, {
        method: "POST",
        body: JSON.stringify({ creditRepNumber }),
      });
      setStatus(null);
      await loadAll();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  // Checklist rework - Section: Aggregator and lender activation.
  async function handleToggleTraining(trainingRecordId: string, completed: boolean) {
    setStatus(null);
    try {
      await apiFetch(`/relationships/training/${trainingRecordId}`, {
        method: "POST",
        body: JSON.stringify({ completed }),
      });
      await loadAll();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function handleRelationshipTransition(relationshipId: string, toStatus: string) {
    let reason: string | undefined;
    if (needsReason(toStatus)) {
      reason = window.prompt(`Reason for moving to ${toStatus}?`) ?? undefined;
    }
    setStatus(`Moving to ${toStatus}...`);
    try {
      await apiFetch(`/relationships/${relationshipId}/transition`, {
        method: "POST",
        body: JSON.stringify({ toStatus, reason }),
      });
      setStatus(null);
      await loadAll();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (unauthorized) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in as an admin to view this.{" "}
          <a href="/admin/login" className="text-primary hover:underline">
            Log in
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
      {error && (
        <p className="mt-2 text-sm text-destructive">
          Could not load review queue: {error} (is the API running?)
        </p>
      )}
      {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}

      {verificationQueue && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Broker verification</CardTitle>
            <CardDescription>One row per broker — verified once, shared with every organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {verificationQueue.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
            {verificationQueue.length > 0 && (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Broker</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {verificationQueue.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3">
                          {b.firstName} {b.lastName}{" "}
                          <span className="text-xs text-muted-foreground">({b.email})</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(b.overallStatus)}>{b.overallStatus}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {(VERIFICATION_NEXT[b.overallStatus] ?? []).map((toStatus) => (
                              <Button
                                key={toStatus}
                                type="button"
                                size="sm"
                                variant={actionVariant(toStatus)}
                                onClick={() => handleBrokerTransition(b.id, toStatus)}
                              >
                                {toStatus}
                              </Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {pendingAcceptances && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending organization connections</CardTitle>
            <CardDescription>
              Broker is already verified. Association: one lightweight accept. Aggregator: also needs the credit
              representative appointment recorded. Lender: also needs required training/accreditation ticked off.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pendingAcceptances.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
            {pendingAcceptances.map((r) => {
              const orgType = r.organization.orgType;
              const outstandingTraining = (r.trainingRecords ?? []).filter((t) => !t.completed);
              const canActivate = orgType === "LENDER" ? outstandingTraining.length === 0 : true;
              return (
                <div key={r.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {r.broker.firstName} {r.broker.lastName} → {r.organization.legalName}{" "}
                        <span className="text-xs font-normal text-muted-foreground">({orgType})</span>
                      </p>
                      {r.broker.relationships && <BrokerContext relationships={r.broker.relationships} />}
                    </div>
                    <Badge variant={statusVariant(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
                  </div>

                  {orgType === "AGGREGATOR" && r.status !== "ACTIVE" && (
                    <div className="mt-3 flex items-end gap-2">
                      <div className="grid gap-1">
                        <label className="text-xs text-muted-foreground" htmlFor={`crn-${r.id}`}>
                          Credit representative number
                        </label>
                        <Input
                          id={`crn-${r.id}`}
                          className="h-8 w-48"
                          value={creditRepInputs[r.id] ?? ""}
                          onChange={(e) => setCreditRepInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!creditRepInputs[r.id]?.trim()}
                        onClick={() => handleRecordCreditRep(r.id)}
                      >
                        Record &amp; activate
                      </Button>
                    </div>
                  )}

                  {orgType === "LENDER" && (r.trainingRecords?.length ?? 0) > 0 && (
                    <div className="mt-3 grid gap-1.5">
                      {r.trainingRecords!.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={t.completed}
                            onChange={(e) => handleToggleTraining(t.id, e.target.checked)}
                          />
                          {t.trainingName}
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    {(RELATIONSHIP_NEXT[r.status] ?? [])
                      .filter((toStatus) => toStatus !== "ACTIVE" || orgType !== "AGGREGATOR")
                      .map((toStatus) => (
                        <Button
                          key={toStatus}
                          type="button"
                          size="sm"
                          variant={actionVariant(toStatus)}
                          disabled={toStatus === "ACTIVE" && !canActivate}
                          onClick={() => handleRelationshipTransition(r.id, toStatus)}
                        >
                          {toStatus === "ACTIVE" ? "Accept" : toStatus}
                        </Button>
                      ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {flagged && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Flagged &amp; suspended</CardTitle>
            <CardDescription>Broker-level suspensions and organization-specific flags.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div>
              <h3 className="mb-2 text-sm font-medium">Brokers</h3>
              {flagged.brokers.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              {flagged.brokers.length > 0 && (
                <div className="grid gap-2">
                  {flagged.brokers.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <span>
                        {b.firstName} {b.lastName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(b.overallStatus)}>{b.overallStatus}</Badge>
                        {(VERIFICATION_NEXT[b.overallStatus] ?? []).map((toStatus) => (
                          <Button
                            key={toStatus}
                            type="button"
                            size="sm"
                            variant={actionVariant(toStatus)}
                            onClick={() => handleBrokerTransition(b.id, toStatus)}
                          >
                            {toStatus}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Relationships</h3>
              {flagged.relationships.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
              {flagged.relationships.length > 0 && (
                <div className="grid gap-2">
                  {flagged.relationships.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <span>
                        {r.broker.firstName} {r.broker.lastName} — {r.organization.legalName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        {(RELATIONSHIP_NEXT[r.status] ?? []).map((toStatus) => (
                          <Button
                            key={toStatus}
                            type="button"
                            size="sm"
                            variant={actionVariant(toStatus)}
                            onClick={() => handleRelationshipTransition(r.id, toStatus)}
                          >
                            {toStatus}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
