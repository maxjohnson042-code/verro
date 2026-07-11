"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Milestone 2: loads the logged-in broker's own profile via
// GET /brokers/me/profile, resolved from the JWT server-side - no more
// manual ID entry now that real auth exists (see lib/auth.ts).
interface Organization {
  id: string;
  legalName: string;
  orgType: string;
}
interface TrainingRecord {
  id: string;
  trainingName: string;
  completed: boolean;
  completedDate: string | null;
  expiryDate: string | null;
}
interface StatusEvent {
  id: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}
interface Relationship {
  id: string;
  status: string;
  organization: Organization;
  trainingRecords: TrainingRecord[];
  statusEvents: StatusEvent[];
}
interface BrokerBusiness {
  id: string;
  legalName: string;
  entityType: string;
}
interface BusinessMembership {
  id: string;
  role: string;
  isPrimary: boolean;
  brokerBusiness: BrokerBusiness;
}
interface DocumentRow {
  id: string;
  docType: string;
  storageKey: string;
  reviewStatus: string;
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
interface BrokerStatusEvent {
  id: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}
interface BrokerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  overallStatus: string;
  associationName: string | null;
  associationMembershipNumber: string | null;
  attestedAt: string | null;
  relationships: Relationship[];
  businessMemberships: BusinessMembership[];
  documents: DocumentRow[];
  accessGrants: AccessGrant[];
  statusEvents: BrokerStatusEvent[];
}

function statusVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "ACTIVE" || status === "GRANTED") return "success";
  if (["DECLINED", "REVOKED", "SUSPENDED", "FLAGGED", "DENIED"].includes(status)) return "destructive";
  if (["DRAFT", "PENDING", "PENDING_ACCEPTANCE", "CREDIT_REP_PENDING", "ACCREDITATION_PENDING"].includes(status))
    return "secondary";
  return "default";
}

export default function BrokerProfilePage() {
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.user.role !== "BROKER" || !auth.user.brokerId) {
      setLoggedOut(true);
      return;
    }
    setBrokerId(auth.user.brokerId);
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    setStatus("Loading...");
    try {
      const data = await apiFetch<BrokerProfile>("/brokers/me/profile");
      setProfile(data);
      setStatus(null);
    } catch (err) {
      setProfile(null);
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function handleRevoke(grantId: string) {
    if (!brokerId) return;
    setStatus("Revoking access...");
    try {
      await apiFetch(`/access-grants/${grantId}/revoke`, {
        method: "PATCH",
        body: JSON.stringify({ brokerId }),
      });
      await loadProfile();
      setStatus(null);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Broker profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in to view your profile.{" "}
          <a href="/broker/login" className="text-primary hover:underline">
            Log in
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Broker profile</h1>

      {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}

      {profile && (
        <div className="mt-6 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="text-base font-medium">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-muted-foreground">{profile.email}</p>
              <p>
                <span className="text-muted-foreground">Association: </span>
                {profile.associationName ?? "Not linked"}
                {profile.associationMembershipNumber ? ` (#${profile.associationMembershipNumber})` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Attested: </span>
                {profile.attestedAt ? new Date(profile.attestedAt).toLocaleString() : "Not yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification status</CardTitle>
              <CardDescription>
                One-time identity, screening, and document review — completed once, shared with every organization
                you connect with.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(profile.overallStatus)}>{profile.overallStatus}</Badge>
                {profile.overallStatus === "ACTIVE" && (
                  <a href="/broker/connect" className="text-sm text-primary hover:underline">
                    Connect with organizations →
                  </a>
                )}
              </div>
              {profile.statusEvents.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-primary">Verification history</summary>
                  <ul className="mt-1 grid gap-1 text-xs text-muted-foreground">
                    {profile.statusEvents.map((e) => (
                      <li key={e.id}>
                        {new Date(e.createdAt).toLocaleString()} — {e.toStatus}
                        {e.reason ? ` (${e.reason})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {profile.businessMemberships.length === 0 && (
                <p className="text-muted-foreground">No business linked yet.</p>
              )}
              {profile.businessMemberships.map((m) => (
                <p key={m.id}>
                  {m.brokerBusiness.legalName}{" "}
                  <span className="text-muted-foreground">
                    ({m.brokerBusiness.entityType}) — {m.role}
                    {m.isPrimary ? " — primary" : ""}
                  </span>
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization relationships</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {profile.relationships.length === 0 && (
                <p className="text-sm text-muted-foreground">No organizations linked yet.</p>
              )}
              {profile.relationships.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.organization.legalName}</p>
                      <p className="text-xs text-muted-foreground">{r.organization.orgType}</p>
                    </div>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </div>
                  {r.trainingRecords.length > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Training:{" "}
                      {r.trainingRecords
                        .map((t) => `${t.trainingName} (${t.completed ? "complete" : "pending"})`)
                        .join(", ")}
                    </p>
                  )}
                  {r.statusEvents.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-primary">Status history</summary>
                      <ul className="mt-1 grid gap-1 text-xs text-muted-foreground">
                        {r.statusEvents.map((e) => (
                          <li key={e.id}>
                            {new Date(e.createdAt).toLocaleString()} — {e.toStatus}
                            {e.reason ? ` (${e.reason})` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
              <ul className="grid gap-1 text-sm">
                {profile.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>
                      {d.docType} — {d.storageKey}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.reviewStatus} · {new Date(d.uploadedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access granted (Data sharing &amp; consent)</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.accessGrants.length === 0 && <p className="text-sm text-muted-foreground">No access grants yet.</p>}
              <ul className="grid gap-2 text-sm">
                {profile.accessGrants.map((g) => (
                  <li key={g.id} className="flex items-center justify-between">
                    <span>
                      {g.organization.legalName} <span className="text-muted-foreground">— {g.origin}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(g.status)}>{g.status}</Badge>
                      {g.status === "GRANTED" && (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleRevoke(g.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
