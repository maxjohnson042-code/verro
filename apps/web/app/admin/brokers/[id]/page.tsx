"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiOpenFile } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrokerAvatar } from "@/components/broker-avatar";

// Epic: Verro 'admin' review - unified broker profile, via
// GET /admin/brokers/:id. Unlike the Client/FI portal's org-scoped broker
// detail page, this shows EVERYTHING: every organization relationship
// (not just the requesting org's own), every document, and every flag -
// see the comment on AdminService.getBrokerFullProfile for why that
// cross-org visibility stays admin-only.
interface Organization {
  id: string;
  legalName: string;
  orgType: string;
}
interface TrainingRecord {
  id: string;
  trainingName: string;
  completed: boolean;
}
interface StatusEvent {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}
interface Relationship {
  id: string;
  status: string;
  creditRepNumber: string | null;
  organization: Organization;
  trainingRecords: TrainingRecord[];
  statusEvents: StatusEvent[];
}
interface BusinessMembership {
  id: string;
  role: string;
  isPrimary: boolean;
  brokerBusiness: { id: string; legalName: string; entityType: string; abnAcn: string | null };
}
interface DocumentRow {
  id: string;
  docType: string;
  originalFilename: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  uploadedAt: string;
}
interface AccessGrant {
  id: string;
  organization: Organization;
  origin: string;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
}
interface BrokerFull {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: string;
  personalCrn: string | null;
  associationName: string | null;
  associationMembershipNumber: string | null;
  attestedAt: string | null;
  certIvCompletedAt: string | null;
  diplomaCompletedAt: string | null;
  cpdHoursCurrentYear: number | null;
  piInsurancePolicyNumber: string | null;
  piInsuranceExpiryAt: string | null;
  relationships: Relationship[];
  businessMemberships: BusinessMembership[];
  documents: DocumentRow[];
  accessGrants: AccessGrant[];
  statusEvents: StatusEvent[];
}
interface ComplianceNote {
  id: string;
  body: string;
  visibility: string;
  organization?: { legalName: string };
  createdAt: string;
}
interface ComplianceFlag {
  id: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  raisedByOrganization?: { legalName: string };
  createdAt: string;
}
interface VerificationCheck {
  id: string;
  checkType: string;
  vendor: string | null;
  result: string;
  rawResponse: { error?: string; EntityName?: string; AbnStatus?: string } | null;
  runAt: string;
  expiresAt: string;
}
interface FullProfileResponse {
  broker: BrokerFull;
  notes: ComplianceNote[];
  flags: ComplianceFlag[];
  checks: VerificationCheck[];
}

function statusVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "ACTIVE" || status === "GRANTED") return "success";
  if (["DECLINED", "REVOKED", "SUSPENDED", "FLAGGED", "DENIED", "OPEN"].includes(status)) return "destructive";
  return "secondary";
}

function docReviewVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

function checkResultVariant(result: string): "default" | "success" | "destructive" | "secondary" {
  if (result === "PASS") return "success";
  if (result === "FAIL") return "destructive";
  if (result === "REVIEW_REQUIRED") return "secondary";
  return "secondary";
}

export default function AdminBrokerProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [unauthorized, setUnauthorized] = useState(false);
  const [data, setData] = useState<FullProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || (auth.user.role !== "INTERNAL_ADMIN" && auth.user.role !== "INTERNAL_REVIEWER")) {
      setUnauthorized(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const result = await apiFetch<FullProfileResponse>(`/admin/brokers/${id}`);
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDocumentReview(documentId: string, reviewStatus: "APPROVED" | "REJECTED") {
    let reviewNotes: string | undefined;
    if (reviewStatus === "REJECTED") {
      reviewNotes = window.prompt("Reason for rejecting this document?") ?? undefined;
    }
    setStatus(null);
    try {
      await apiFetch(`/documents/${documentId}/review-status`, {
        method: "PATCH",
        body: JSON.stringify({ reviewStatus, reviewNotes }),
      });
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function handleResolveFlag(flagId: string) {
    const resolutionNotes = window.prompt("Resolution notes (optional)?") ?? undefined;
    setStatus(null);
    try {
      await apiFetch(`/compliance-flags/${flagId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolutionNotes }),
      });
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (unauthorized) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Broker profile</h1>
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

  if (error) {
    return <p className="text-sm text-destructive">Could not load broker: {error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const { broker, notes, flags, checks } = data;

  // Outstanding actions - the full cross-org picture, unlike the org-scoped
  // version on the Client/FI portal's broker detail page.
  const outstanding: string[] = [];
  if (!broker.businessMemberships[0]) outstanding.push("Business details not provided");
  if (!broker.certIvCompletedAt) outstanding.push("Qualifications not recorded");
  if (!broker.piInsurancePolicyNumber) outstanding.push("PI insurance not recorded");
  if (!broker.associationName) outstanding.push("Association membership not declared");
  for (const r of broker.relationships) {
    if (r.status === "PENDING_ACCEPTANCE") {
      outstanding.push(`${r.organization.legalName}: waiting on their acceptance`);
    }
    if (r.status === "CREDIT_REP_PENDING") {
      outstanding.push(`${r.organization.legalName}: credit representative number not yet recorded`);
    }
    if (r.status === "ACCREDITATION_PENDING") {
      const remaining = r.trainingRecords.filter((t) => !t.completed).length;
      outstanding.push(`${r.organization.legalName}: ${remaining} of ${r.trainingRecords.length} accreditation modules outstanding`);
    }
  }
  const pendingDocs = broker.documents.filter((d) => d.reviewStatus === "PENDING").length;
  if (pendingDocs > 0) outstanding.push(`${pendingDocs} document${pendingDocs === 1 ? "" : "s"} awaiting review`);
  const openFlags = flags.filter((f) => f.status === "OPEN").length;
  if (openFlags > 0) outstanding.push(`${openFlags} open compliance flag${openFlags === 1 ? "" : "s"}`);

  return (
    <div className="mx-auto max-w-2xl">
      <a href="/admin/review" className="text-sm text-primary hover:underline">
        ← Back to review queue
      </a>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrokerAvatar brokerId={broker.id} firstName={broker.firstName} lastName={broker.lastName} />
          <h1 className="text-xl font-semibold tracking-tight">
            {broker.firstName} {broker.lastName}
          </h1>
        </div>
        <Badge variant={statusVariant(broker.overallStatus)}>{broker.overallStatus.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{broker.email}</p>

      {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}

      {outstanding.length > 0 ? (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Outstanding</CardTitle>
            <CardDescription>Everything not yet done, across every organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {outstanding.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Nothing outstanding.
        </p>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Business: </span>
            {broker.businessMemberships[0]?.brokerBusiness.legalName ?? "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">Association: </span>
            {broker.associationName
              ? `${broker.associationName} #${broker.associationMembershipNumber ?? "—"}`
              : "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">Cert IV completed: </span>
            {broker.certIvCompletedAt ? broker.certIvCompletedAt.slice(0, 10) : "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">Diploma completed: </span>
            {broker.diplomaCompletedAt ? broker.diplomaCompletedAt.slice(0, 10) : "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">CPD hours (current year): </span>
            {broker.cpdHoursCurrentYear ?? "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">PI insurance: </span>
            {broker.piInsurancePolicyNumber ?? "Not provided"}
            {broker.piInsuranceExpiryAt ? ` (expires ${broker.piInsuranceExpiryAt.slice(0, 10)})` : ""}
          </div>
          <div>
            <span className="text-muted-foreground">Personal CRN: </span>
            {broker.personalCrn ?? "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">Attested: </span>
            {broker.attestedAt ? new Date(broker.attestedAt).toLocaleString() : "Not yet"}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Organization relationships</CardTitle>
          <CardDescription>Every organization this broker has connected with - not just one.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {broker.relationships.length === 0 && (
            <p className="text-sm text-muted-foreground">No organizations linked yet.</p>
          )}
          {broker.relationships.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.organization.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.organization.orgType}
                    {r.creditRepNumber ? ` · CR# ${r.creditRepNumber}` : ""}
                  </p>
                </div>
                <Badge variant={statusVariant(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
              </div>
              {r.trainingRecords.length > 0 && (
                <ul className="mt-2 grid gap-1 text-xs">
                  {r.trainingRecords.map((t) => (
                    <li key={t.id} className="flex items-center gap-1.5">
                      <span className={t.completed ? "text-success" : "text-muted-foreground"}>
                        {t.completed ? "✓" : "○"}
                      </span>
                      {t.trainingName}
                    </li>
                  ))}
                </ul>
              )}
              {r.statusEvents.length > 0 && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">History</summary>
                  <ul className="mt-1 grid gap-1 pl-3">
                    {r.statusEvents.map((e) => (
                      <li key={e.id}>
                        {e.fromStatus ?? "—"} → {e.toStatus} ({e.createdAt.slice(0, 10)})
                        {e.reason ? ` — ${e.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Verification history</CardTitle>
          <CardDescription>The broker&apos;s own one-time verification pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          {broker.statusEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ul className="grid gap-1 text-sm text-muted-foreground">
              {broker.statusEvents.map((e) => (
                <li key={e.id}>
                  {e.fromStatus ?? "—"} → {e.toStatus} ({e.createdAt.slice(0, 10)})
                  {e.reason ? ` — ${e.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>External checks</CardTitle>
          <CardDescription>ABN lookups (ABR) and identity checks run against this broker&apos;s file.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {checks.length === 0 && <p className="text-sm text-muted-foreground">No checks run yet.</p>}
          {checks.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {c.checkType} {c.vendor ? `— ${c.vendor}` : ""}
                </span>
                <Badge variant={checkResultVariant(c.result)}>{c.result.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Run {new Date(c.runAt).toLocaleString()}
                {c.rawResponse?.EntityName ? ` — ${c.rawResponse.EntityName}` : ""}
                {c.rawResponse?.AbnStatus ? ` (${c.rawResponse.AbnStatus})` : ""}
                {c.rawResponse?.error ? ` — ${c.rawResponse.error}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {broker.documents.length === 0 && <p className="text-sm text-muted-foreground">None uploaded yet.</p>}
          {broker.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div className="grid">
                <button
                  type="button"
                  className="text-left text-primary hover:underline"
                  onClick={() => apiOpenFile(`/documents/${d.id}/file`, d.originalFilename ?? "document")}
                >
                  {d.docType} — {d.originalFilename ?? "file"}
                </button>
                <span className="text-xs text-muted-foreground">
                  {new Date(d.uploadedAt).toLocaleDateString()}
                  {d.reviewNotes ? ` — ${d.reviewNotes}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={docReviewVariant(d.reviewStatus)}>{d.reviewStatus}</Badge>
                {d.reviewStatus === "PENDING" && (
                  <>
                    <Button type="button" size="sm" onClick={() => handleDocumentReview(d.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => handleDocumentReview(d.id, "REJECTED")}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Compliance flags</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {flags.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
          {flags.map((f) => (
            <div key={f.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {f.category} — {f.severity}
                </span>
                <Badge variant={statusVariant(f.status)}>{f.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{f.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.raisedByOrganization?.legalName ?? "Unknown organization"} — {f.createdAt.slice(0, 10)}
              </p>
              {f.status === "OPEN" && (
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => handleResolveFlag(f.id)}>
                  Resolve
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Only network-visible notes are shown to Admin - each org&apos;s private notes stay private.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">None visible.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border p-3 text-sm">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.organization?.legalName ?? "Unknown organization"} — {n.createdAt.slice(0, 10)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Access granted (Data sharing &amp; consent)</CardTitle>
        </CardHeader>
        <CardContent>
          {broker.accessGrants.length === 0 && <p className="text-sm text-muted-foreground">No access grants yet.</p>}
          <ul className="grid gap-2 text-sm">
            {broker.accessGrants.map((g) => (
              <li key={g.id} className="flex items-center justify-between">
                <span>
                  {g.organization.legalName} <span className="text-muted-foreground">— {g.origin}</span>
                </span>
                <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
