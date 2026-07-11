"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiOpenFile } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Epic: Client dashboard - broker detail view, via
// GET /organizations/me/brokers/:brokerId. The API re-checks the GRANTED
// AccessGrant on every call, so a broker revoking access takes effect
// immediately even mid-session (Section 1.1).
interface StatusEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}
interface TrainingRecord {
  id: string;
  trainingName: string;
  completed: boolean;
}
interface Relationship {
  id: string;
  status: string;
  creditRepNumber?: string | null;
  statusEvents: StatusEvent[];
  trainingRecords: TrainingRecord[];
}
interface BrokerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: string;
  personalCrn: string | null;
  certIvCompletedAt: string | null;
  diplomaCompletedAt: string | null;
  cpdHoursCurrentYear: number | null;
  piInsurancePolicyNumber: string | null;
  associationName: string | null;
  associationMembershipNumber: string | null;
  relationships: Relationship[];
  statusEvents: StatusEvent[];
  businessMemberships: { brokerBusiness: { legalName: string; entityType: string; abnAcn: string | null } }[];
}
interface ComplianceNote {
  id: string;
  body: string;
  visibility: string;
  organizationId: string;
  organization?: { legalName: string };
  createdAt: string;
}
interface ComplianceFlag {
  id: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  raisedByOrganizationId: string;
  raisedByOrganization?: { legalName: string };
  createdAt: string;
}
interface DetailResponse {
  broker: BrokerDetail;
  notes: ComplianceNote[];
  flags: ComplianceFlag[];
}
interface DocumentRow {
  id: string;
  docType: string;
  originalFilename: string | null;
  reviewStatus: string;
  uploadedAt: string;
}

function docReviewVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

function statusVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "ACTIVE") return "success";
  if (["DECLINED", "REVOKED", "SUSPENDED", "FLAGGED", "OPEN"].includes(status)) return "destructive";
  return "secondary";
}

export default function ClientBrokerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [loggedOut, setLoggedOut] = useState(false);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("PRIVATE_TO_ORG");

  const [flagCategory, setFlagCategory] = useState("CONDUCT");
  const [flagSeverity, setFlagSeverity] = useState("LOW");
  const [flagDescription, setFlagDescription] = useState("");
  const [showFlagForm, setShowFlagForm] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || (auth.user.role !== "CLIENT_STAFF" && auth.user.role !== "CLIENT_ADMIN")) {
      setLoggedOut(true);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const result = await apiFetch<DetailResponse>(`/organizations/me/brokers/${id}`);
      setData(result);
      // Same GRANTED-access check as the broker detail endpoint - the API
      // re-verifies it independently, this just also happens to succeed
      // whenever the line above did.
      const docs = await apiFetch<DocumentRow[]>(`/documents/broker/${id}`);
      setDocuments(docs);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setStatus("Saving note...");
    try {
      await apiFetch("/compliance-notes", {
        method: "POST",
        body: JSON.stringify({ brokerId: id, body: noteBody, visibility: noteVisibility }),
      });
      setNoteBody("");
      setStatus(null);
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function handleRaiseFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!flagDescription.trim()) return;
    setStatus("Raising flag...");
    try {
      await apiFetch("/compliance-flags", {
        method: "POST",
        body: JSON.stringify({
          brokerId: id,
          category: flagCategory,
          severity: flagSeverity,
          description: flagDescription,
        }),
      });
      setFlagDescription("");
      setShowFlagForm(false);
      setStatus(null);
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <p className="text-sm text-muted-foreground">
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
    return <p className="text-sm text-destructive">Could not load broker: {error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const { broker, notes, flags } = data;
  const ourRelationship = broker.relationships[0];
  const auth = getAuth();
  const ourOrgId = auth?.user.organizationId;

  return (
    <div className="mx-auto max-w-2xl">
      <a href="/portal/brokers" className="text-sm text-primary hover:underline">
        ← Back to brokers
      </a>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {broker.firstName} {broker.lastName}
        </h1>
        <Badge variant={statusVariant(broker.overallStatus)}>{broker.overallStatus.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{broker.email}</p>

      {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}

      <Card className="mt-6">
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
            <span className="text-muted-foreground">CPD hours (current year): </span>
            {broker.cpdHoursCurrentYear ?? "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">PI insurance: </span>
            {broker.piInsurancePolicyNumber ?? "Not provided"}
          </div>
          <div>
            <span className="text-muted-foreground">Personal CRN: </span>
            {broker.personalCrn ?? "Not provided"}
          </div>
        </CardContent>
      </Card>

      {ourRelationship && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Relationship with your organization</CardTitle>
            <CardDescription>
              <Badge variant={statusVariant(ourRelationship.status)}>
                {ourRelationship.status.replace(/_/g, " ")}
              </Badge>
              {ourRelationship.creditRepNumber && (
                <span className="ml-2 text-xs text-muted-foreground">CR# {ourRelationship.creditRepNumber}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {ourRelationship.trainingRecords.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Accreditation modules</p>
                <ul className="grid gap-1">
                  {ourRelationship.trainingRecords.map((t) => (
                    <li key={t.id} className="flex items-center gap-1.5">
                      <span className={t.completed ? "text-success" : "text-muted-foreground"}>
                        {t.completed ? "✓" : "○"}
                      </span>
                      {t.trainingName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ourRelationship.statusEvents.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">History</summary>
                <ul className="mt-1.5 grid gap-1 pl-3">
                  {ourRelationship.statusEvents.map((e) => (
                    <li key={e.id}>
                      {e.fromStatus ?? "—"} → {e.toStatus} ({e.createdAt.slice(0, 10)})
                      {e.reason ? ` — ${e.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Evidence the broker has uploaded — visible while your access remains granted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">None uploaded yet.</p>}
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <button
                type="button"
                className="text-left text-primary hover:underline"
                onClick={() => apiOpenFile(`/documents/${d.id}/file`, d.originalFilename ?? "document")}
              >
                {d.docType} — {d.originalFilename ?? "file"}
              </button>
              <div className="flex items-center gap-2">
                <Badge variant={docReviewVariant(d.reviewStatus)}>{d.reviewStatus}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(d.uploadedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Compliance flags</CardTitle>
          <CardDescription>Visible to every organization with access to this broker.</CardDescription>
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
                {f.raisedByOrganizationId === ourOrgId ? "Raised by your organization" : f.raisedByOrganization?.legalName ?? "Raised by another organization"}{" "}
                — {f.createdAt.slice(0, 10)}
              </p>
            </div>
          ))}

          {!showFlagForm ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowFlagForm(true)}>
              Raise a flag
            </Button>
          ) : (
            <form onSubmit={handleRaiseFlag} className="grid gap-2 rounded-md border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="flagCategory">Category</Label>
                  <Select id="flagCategory" value={flagCategory} onChange={(e) => setFlagCategory(e.target.value)}>
                    <option value="CONDUCT">Conduct</option>
                    <option value="FRAUD">Fraud</option>
                    <option value="DOCUMENTATION">Documentation</option>
                    <option value="LICENCE">Licence</option>
                    <option value="COMPLAINT">Complaint</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="flagSeverity">Severity</Label>
                  <Select id="flagSeverity" value={flagSeverity} onChange={(e) => setFlagSeverity(e.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="flagDescription">Description</Label>
                <Input
                  id="flagDescription"
                  value={flagDescription}
                  onChange={(e) => setFlagDescription(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Submit
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowFlagForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Private to your organization unless marked network-visible.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border p-3 text-sm">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.organizationId === ourOrgId ? "Your organization" : n.organization?.legalName ?? "Another organization"} —{" "}
                {n.visibility === "NETWORK_VISIBLE" ? "network-visible" : "private"} — {n.createdAt.slice(0, 10)}
              </p>
            </div>
          ))}

          <form onSubmit={handleAddNote} className="grid gap-2 rounded-md border border-border p-3">
            <div className="grid gap-1">
              <Label htmlFor="noteBody">Add a note</Label>
              <Input id="noteBody" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={noteVisibility}
                onChange={(e) => setNoteVisibility(e.target.value)}
                className="h-8 w-auto text-xs"
              >
                <option value="PRIVATE_TO_ORG">Private to my org</option>
                <option value="NETWORK_VISIBLE">Network-visible</option>
              </Select>
              <Button type="submit" size="sm">
                Add note
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
