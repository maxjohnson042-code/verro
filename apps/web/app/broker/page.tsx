"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiOpenFile } from "@/lib/api-client";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrokerAvatar } from "@/components/broker-avatar";

// Broker portal home. Section 2 (reworked) split verification into "one
// global pipeline" + "per-org relationships"; this page is the single hub
// that ties both together into a to-do list, grouped so a broker always
// knows what's next regardless of what they had on hand at signup time.
// Nothing here is required at registration (see /broker/onboarding, which
// is now just account creation) - a broker can fill in business details,
// qualifications, insurance, and association membership whenever they
// have the information, in any order, and can revisit to edit any of it.
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
  id: string;
  organizationId: string;
  status: string;
  organization: Organization;
  trainingRecords?: TrainingRecord[];
}
interface BrokerProfile {
  id: string;
  firstName: string;
  lastName: string;
  overallStatus: string;
  attestedAt: string | null;
  associationName: string | null;
  associationMembershipNumber: string | null;
  certIvCompletedAt: string | null;
  diplomaCompletedAt: string | null;
  cpdHoursCurrentYear: number | null;
  piInsurancePolicyNumber: string | null;
  piInsuranceExpiryAt: string | null;
  businessMemberships: { brokerBusiness: { id: string; legalName: string } }[];
  relationships: RelationshipSummary[];
}
interface ConnectOptions {
  activeAssociation: Organization | null;
  activeAggregator: Organization | null;
  lenders: Organization[];
}
interface DocumentRow {
  id: string;
  docType: string;
  originalFilename: string | null;
  mimeType: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  uploadedAt: string;
}

// Mirrors apps/api/src/modules/documents/doc-types.ts - docType stays a
// free string on the Document model, so this is just the UI vocabulary.
const BROKER_DOC_TYPES = [
  { value: "PHOTO_ID", label: "Photo ID (driver's licence / passport)" },
  { value: "POLICE_CHECK", label: "National police check" },
  { value: "CERT_IV", label: "Certificate IV in Finance & Mortgage Broking" },
  { value: "DIPLOMA", label: "Diploma of Finance & Mortgage Broking Management" },
  { value: "PI_INSURANCE", label: "Professional indemnity insurance certificate" },
  { value: "ASSOCIATION_MEMBERSHIP", label: "Association membership certificate (MFAA/FBAA)" },
  { value: "ASIC_EXTRACT", label: "ASIC company extract" },
  { value: "ABN_REGISTRATION", label: "ABN registration" },
  { value: "OTHER", label: "Other supporting document" },
];
const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(BROKER_DOC_TYPES.map((d) => [d.value, d.label]));

function docReviewVariant(status: string): "default" | "success" | "destructive" | "secondary" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

const ORG_STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPTANCE: "waiting on their acceptance",
  CREDIT_REP_PENDING: "waiting on your credit representative appointment",
  ACCREDITATION_PENDING: "waiting on accreditation modules",
};

function TaskRow({
  title,
  done,
  children,
  isOpen,
  onToggle,
  doneLabel,
}: {
  title: string;
  done: boolean;
  children?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  doneLabel?: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={done ? "text-success" : "text-muted-foreground"}>{done ? "✓" : "○"}</span>
          <span className="text-sm font-medium">{title}</span>
          {done && doneLabel && <span className="text-xs text-muted-foreground">— {doneLabel}</span>}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onToggle}>
          {isOpen ? "Close" : done ? "Edit" : "Complete"}
        </Button>
      </div>
      {isOpen && <div className="mt-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

export default function BrokerDashboardPage() {
  const [loggedOut, setLoggedOut] = useState(false);
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [options, setOptions] = useState<ConnectOptions | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadDocType, setUploadDocType] = useState(BROKER_DOC_TYPES[0].value);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);

  // Form state for each inline task.
  const [legalName, setLegalName] = useState("");
  const [entityType, setEntityType] = useState("SOLE_TRADER");
  const [abnAcn, setAbnAcn] = useState("");
  const [aclHolderType, setAclHolderType] = useState("CREDIT_REPRESENTATIVE");
  const [aclNumber, setAclNumber] = useState("");
  const [creditRepresentativeNumber, setCreditRepresentativeNumber] = useState("");

  const [certIvCompletedAt, setCertIvCompletedAt] = useState("");
  const [diplomaCompletedAt, setDiplomaCompletedAt] = useState("");
  const [cpdHoursCurrentYear, setCpdHoursCurrentYear] = useState("");

  const [piInsurancePolicyNumber, setPiInsurancePolicyNumber] = useState("");
  const [piInsuranceExpiryAt, setPiInsuranceExpiryAt] = useState("");

  const [associationName, setAssociationName] = useState("MFAA");
  const [associationMembershipNumber, setAssociationMembershipNumber] = useState("");

  const [agreed, setAgreed] = useState(false);

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
      // Prefill edit forms with whatever's already saved.
      setCertIvCompletedAt(data.certIvCompletedAt?.slice(0, 10) ?? "");
      setDiplomaCompletedAt(data.diplomaCompletedAt?.slice(0, 10) ?? "");
      setCpdHoursCurrentYear(data.cpdHoursCurrentYear != null ? String(data.cpdHoursCurrentYear) : "");
      setPiInsurancePolicyNumber(data.piInsurancePolicyNumber ?? "");
      setPiInsuranceExpiryAt(data.piInsuranceExpiryAt?.slice(0, 10) ?? "");
      setAssociationName(data.associationName ?? "MFAA");
      setAssociationMembershipNumber(data.associationMembershipNumber ?? "");
      if (data.overallStatus === "ACTIVE") {
        const opts = await apiFetch<ConnectOptions>(`/brokers/${data.id}/connect-options`);
        setOptions(opts);
      }
      const docs = await apiFetch<DocumentRow[]>(`/documents/broker/${data.id}`);
      setDocuments(docs);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  function toggleTask(id: string) {
    setOpenTask((prev) => (prev === id ? null : id));
  }

  async function handleUpload() {
    if (!profile || !uploadFile) return;
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("docType", uploadDocType);
      await apiFetch("/documents", { method: "POST", body: formData });
      setUploadFile(null);
      setStatus("Document uploaded.");
      const docs = await apiFetch<DocumentRow[]>(`/documents/broker/${profile.id}`);
      setDocuments(docs);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handlePhotoUpload() {
    if (!profile || !photoFile) return;
    setUploadingPhoto(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      formData.append("docType", "PROFILE_PHOTO");
      await apiFetch("/documents", { method: "POST", body: formData });
      setPhotoFile(null);
      setPhotoVersion((v) => v + 1);
      setStatus("Profile photo updated.");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleViewDocument(doc: DocumentRow) {
    try {
      await apiOpenFile(`/documents/${doc.id}/file`, doc.originalFilename ?? "document");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  async function runTask(action: () => Promise<unknown>, successMessage: string) {
    setStatus(null);
    try {
      await action();
      setStatus(successMessage);
      setOpenTask(null);
      await load();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (loggedOut) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Broker dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in.{" "}
          <a href="/broker/login" className="text-primary hover:underline">
            Log in
          </a>{" "}
          or{" "}
          <a href="/broker/onboarding" className="text-primary hover:underline">
            create an account
          </a>
          .
        </p>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const hasBusiness = profile.businessMemberships.length > 0;
  const hasQualifications = !!profile.certIvCompletedAt;
  const hasInsurance = !!profile.piInsurancePolicyNumber;
  const hasAssociationDeclared = !!profile.associationMembershipNumber;
  const isVerified = profile.overallStatus === "ACTIVE";
  const inReview = ["SUBMITTED", "IDV_PENDING", "SCREENING_PENDING", "DOC_REVIEW_PENDING", "PENDING_ADMIN_APPROVAL"].includes(
    profile.overallStatus,
  );

  const activeAssociationRel = profile.relationships.find(
    (r) => r.organization.orgType === "ASSOCIATION" && r.status === "ACTIVE",
  );
  const activeAggregatorRel = profile.relationships.find(
    (r) => r.organization.orgType === "AGGREGATOR" && r.status === "ACTIVE",
  );
  const connectedLenderCount = profile.relationships.filter(
    (r) => r.organization.orgType === "LENDER" && r.status !== "REVOKED" && r.status !== "DECLINED",
  ).length;

  // "Waiting on others" - relationships where the ball is in an
  // organization's court, not the broker's.
  const waiting = profile.relationships.filter((r) =>
    ["PENDING_ACCEPTANCE", "CREDIT_REP_PENDING", "ACCREDITATION_PENDING"].includes(r.status),
  );

  const allCaughtUp =
    profile.overallStatus !== "DRAFT" &&
    hasBusiness &&
    hasQualifications &&
    hasInsurance &&
    hasAssociationDeclared &&
    waiting.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrokerAvatar
            brokerId={profile.id}
            firstName={profile.firstName}
            lastName={profile.lastName}
            version={photoVersion}
          />
          <h1 className="text-xl font-semibold tracking-tight">Your activities</h1>
        </div>
        <Badge variant={isVerified ? "success" : "secondary"}>{profile.overallStatus.replace(/_/g, " ")}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          className="h-8 max-w-[220px] text-xs"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" size="sm" variant="outline" disabled={!photoFile || uploadingPhoto} onClick={handlePhotoUpload}>
          {uploadingPhoto ? "Uploading..." : "Set profile photo"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Complete these whenever you have the information — nothing here has to be done all at once.
      </p>

      {allCaughtUp && (
        <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          You&apos;re all caught up. Nothing outstanding right now.
        </p>
      )}

      {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}

      {/* Group 1: Get verified */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Get verified</CardTitle>
          <CardDescription>Done once — trusted by every organization you connect with afterward.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {profile.overallStatus === "DRAFT" && (
            <TaskRow
              title="Agree to terms and submit for verification"
              done={false}
              isOpen={openTask === "submit"}
              onToggle={() => toggleTask("submit")}
            >
              <div className="grid gap-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                  <span>I agree to the Privacy Policy and Terms &amp; Conditions.</span>
                </label>
                <Button
                  type="button"
                  disabled={!agreed}
                  onClick={() =>
                    runTask(async () => {
                      await apiFetch(`/brokers/${profile.id}/attest`, { method: "PATCH" });
                      await apiFetch(`/brokers/${profile.id}/submit`, { method: "POST" });
                    }, "Submitted for verification.")
                  }
                >
                  Submit for verification
                </Button>
              </div>
            </TaskRow>
          )}
          {inReview && (
            <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
              Your verification is with our review team (status: {profile.overallStatus.replace(/_/g, " ")}). You&apos;ll
              get an email as it progresses.
            </p>
          )}
          {isVerified && (
            <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Verification complete.
            </p>
          )}
          {["DECLINED", "SUSPENDED", "REVOKED"].includes(profile.overallStatus) && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Status: {profile.overallStatus}. Contact support if you have questions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Group 2: Complete your profile */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Fill these in whenever you have the details on hand — you can come back and edit anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <TaskRow
            title="Business details"
            done={hasBusiness}
            doneLabel={hasBusiness ? profile.businessMemberships[0].brokerBusiness.legalName : undefined}
            isOpen={openTask === "business"}
            onToggle={() => toggleTask("business")}
          >
            {hasBusiness ? (
              <p className="text-sm text-muted-foreground">
                Already added. Editing existing business details isn&apos;t available yet — contact support if
                something needs to change.
              </p>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="legalName">Legal / business name</Label>
                  <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="entityType">Entity type</Label>
                  <Select id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                    <option value="SOLE_TRADER">Sole trader</option>
                    <option value="COMPANY">Company</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="TRUST">Trust</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="abnAcn">ABN / ACN</Label>
                  <Input id="abnAcn" value={abnAcn} onChange={(e) => setAbnAcn(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aclHolderType">Credit licence status</Label>
                  <Select id="aclHolderType" value={aclHolderType} onChange={(e) => setAclHolderType(e.target.value)}>
                    <option value="CREDIT_REPRESENTATIVE">Credit Representative (under another ACL)</option>
                    <option value="OWN_ACL">Holds own ACL</option>
                  </Select>
                </div>
                {aclHolderType === "OWN_ACL" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="aclNumber">ACL number</Label>
                    <Input id="aclNumber" value={aclNumber} onChange={(e) => setAclNumber(e.target.value)} />
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="crn">Credit Representative Number</Label>
                    <Input
                      id="crn"
                      value={creditRepresentativeNumber}
                      onChange={(e) => setCreditRepresentativeNumber(e.target.value)}
                    />
                  </div>
                )}
                <Button
                  type="button"
                  disabled={!legalName.trim()}
                  onClick={() =>
                    runTask(async () => {
                      const business = await apiFetch<{ id: string }>("/broker-businesses", {
                        method: "POST",
                        body: JSON.stringify({
                          legalName,
                          entityType,
                          abnAcn,
                          aclHolderType,
                          aclNumber: aclHolderType === "OWN_ACL" ? aclNumber : undefined,
                          creditRepresentativeNumber:
                            aclHolderType === "CREDIT_REPRESENTATIVE" ? creditRepresentativeNumber : undefined,
                        }),
                      });
                      await apiFetch(`/broker-businesses/${business.id}/members`, {
                        method: "POST",
                        body: JSON.stringify({ brokerId: profile.id, role: "PRINCIPAL", isPrimary: true }),
                      });
                    }, "Business details saved.")
                  }
                >
                  Save
                </Button>
              </div>
            )}
          </TaskRow>

          <TaskRow
            title="Qualifications & CPD"
            done={hasQualifications}
            isOpen={openTask === "qualifications"}
            onToggle={() => toggleTask("qualifications")}
          >
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="certIv">Certificate IV completed</Label>
                  <Input
                    id="certIv"
                    type="date"
                    value={certIvCompletedAt}
                    onChange={(e) => setCertIvCompletedAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="diploma">Diploma completed</Label>
                  <Input
                    id="diploma"
                    type="date"
                    value={diplomaCompletedAt}
                    onChange={(e) => setDiplomaCompletedAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cpdHours">CPD hours this year</Label>
                <Input
                  id="cpdHours"
                  type="number"
                  min={0}
                  value={cpdHoursCurrentYear}
                  onChange={(e) => setCpdHoursCurrentYear(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">ASIC&apos;s minimum competence expectation is 20 hours/year.</p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  runTask(
                    () =>
                      apiFetch(`/brokers/${profile.id}/qualifications`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          certIvCompletedAt: certIvCompletedAt || undefined,
                          diplomaCompletedAt: diplomaCompletedAt || undefined,
                          cpdHoursCurrentYear: cpdHoursCurrentYear ? Number(cpdHoursCurrentYear) : undefined,
                        }),
                      }),
                    "Qualifications saved.",
                  )
                }
              >
                Save
              </Button>
            </div>
          </TaskRow>

          <TaskRow
            title="Professional indemnity insurance"
            done={hasInsurance}
            isOpen={openTask === "insurance"}
            onToggle={() => toggleTask("insurance")}
          >
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                If your aggregator provides cover under their policy, you can leave this until you know.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="piPolicy">Policy number</Label>
                  <Input
                    id="piPolicy"
                    value={piInsurancePolicyNumber}
                    onChange={(e) => setPiInsurancePolicyNumber(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="piExpiry">Expiry date</Label>
                  <Input
                    id="piExpiry"
                    type="date"
                    value={piInsuranceExpiryAt}
                    onChange={(e) => setPiInsuranceExpiryAt(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={() =>
                  runTask(
                    () =>
                      apiFetch(`/brokers/${profile.id}/qualifications`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          piInsurancePolicyNumber: piInsurancePolicyNumber || undefined,
                          piInsuranceExpiryAt: piInsuranceExpiryAt || undefined,
                        }),
                      }),
                    "Insurance details saved.",
                  )
                }
              >
                Save
              </Button>
            </div>
          </TaskRow>

          <TaskRow
            title="Association membership"
            done={hasAssociationDeclared}
            doneLabel={hasAssociationDeclared ? `${profile.associationName} #${profile.associationMembershipNumber}` : undefined}
            isOpen={openTask === "association"}
            onToggle={() => toggleTask("association")}
          >
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                Self-declared for now — MFAA/FBAA don&apos;t offer a verification API yet. This is separate from
                actually connecting to your association (see below), which is a real accept step.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="associationName">Association</Label>
                <Select id="associationName" value={associationName} onChange={(e) => setAssociationName(e.target.value)}>
                  <option value="MFAA">MFAA</option>
                  <option value="FBAA">FBAA</option>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="membershipNumber">Membership number</Label>
                <Input
                  id="membershipNumber"
                  value={associationMembershipNumber}
                  onChange={(e) => setAssociationMembershipNumber(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={!associationMembershipNumber.trim()}
                onClick={() =>
                  runTask(
                    () =>
                      apiFetch(`/brokers/${profile.id}/association`, {
                        method: "PATCH",
                        body: JSON.stringify({ associationName, associationMembershipNumber }),
                      }),
                    "Association membership saved.",
                  )
                }
              >
                Save
              </Button>
            </div>
          </TaskRow>
        </CardContent>
      </Card>

      {/* Supporting documents - evidence for the self-declared fields above
          (ID, police check, Cert IV/Diploma, PI insurance, association
          membership). Upload is always available and never blocks the
          verification pipeline; Admin reviews and marks approved/rejected. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>
            Upload evidence for anything above whenever you have it on hand — certificates, insurance schedule,
            ID, police check.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
          {documents.length > 0 && (
            <ul className="grid gap-2">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="grid">
                    <button type="button" onClick={() => handleViewDocument(d)} className="text-left text-primary hover:underline">
                      {DOC_TYPE_LABEL[d.docType] ?? d.docType}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {d.originalFilename} · {new Date(d.uploadedAt).toLocaleDateString()}
                      {d.reviewNotes ? ` — ${d.reviewNotes}` : ""}
                    </span>
                  </div>
                  <Badge variant={docReviewVariant(d.reviewStatus)}>{d.reviewStatus}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="docType">Document type</Label>
              <Select id="docType" value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}>
                {BROKER_DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="docFile">File</Label>
              <Input
                id="docFile"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="button" disabled={!uploadFile || uploading} onClick={handleUpload}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Group 3: Connect with organizations */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Connect with organizations</CardTitle>
          <CardDescription>
            {isVerified
              ? "Association and aggregator can be connected in either order. Lenders always need an aggregator first — each just needs one lightweight accept."
              : "Unlocks once your verification is complete."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!isVerified && (
            <p className="text-sm text-muted-foreground">Finish verification above to unlock this.</p>
          )}
          {isVerified && (
            <>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  {activeAssociationRel ? "✓ " : "○ "}Association
                  {activeAssociationRel ? ` — ${activeAssociationRel.organization.legalName}` : ""}
                </span>
                {!activeAssociationRel && (
                  <a href="/broker/connect" className="text-primary hover:underline">
                    Connect →
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  {activeAggregatorRel ? "✓ " : "○ "}Aggregator
                  {activeAggregatorRel ? ` — ${activeAggregatorRel.organization.legalName}` : ""}
                </span>
                {!activeAggregatorRel && (
                  <a href="/broker/connect" className="text-primary hover:underline">
                    Connect →
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  Lenders — {connectedLenderCount} connected
                  {options && activeAggregatorRel ? ` of ${options.lenders.length} available` : ""}
                </span>
                {activeAggregatorRel && (
                  <a href="/broker/connect" className="text-primary hover:underline">
                    Connect →
                  </a>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Group 4: Waiting on others */}
      {waiting.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Waiting on others</CardTitle>
            <CardDescription>Nothing to do here — just keeping you posted.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {waiting.map((r) => {
              const trainingProgress =
                r.organization.orgType === "LENDER" && r.trainingRecords && r.trainingRecords.length > 0
                  ? ` (${r.trainingRecords.filter((t) => t.completed).length}/${r.trainingRecords.length} modules complete)`
                  : "";
              return (
                <p key={r.id} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                  {r.organization.legalName} — {ORG_STATUS_LABEL[r.status] ?? r.status}
                  {trainingProgress}
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
