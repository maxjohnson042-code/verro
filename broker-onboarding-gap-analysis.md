# Broker onboarding: critical gap analysis

Working note, dated 25 August 2026. Companion to `platform-architecture-and-brd-additions.md` — that document says what was *planned*; this one says what's actually *built* against it, and where the gaps carry real risk.

## Bottom line

Verro today is a well-built **case management and consent workflow** for broker onboarding, not yet a **verification** platform. The state machine, document pipeline, org-scoped visibility, and audit trail are solid. But of the six check types the schema already defines (`IDV`, `AML`, `CREDIT`, `POLICE`, `ASIC`, `ABN`), only one — ABN lookup — actually calls out to a real source of truth. The other five either don't exist as code at all, or exist as a stub that immediately writes `PENDING` and stops. Every status a broker moves through — `IDV_Pending`, `Screening_Pending`, `Doc_Review_Pending` — describes a check that, today, nothing actually runs.

That's a reasonable place to be for an MVP built human-in-the-loop-first. But it means the platform's core value proposition — "verified once, trusted by the network" — currently rests entirely on an admin manually eyeballing uploaded documents and clicking "next," with no system enforcing that the underlying check actually passed before the status advances. That's worth being clear-eyed about before this goes anywhere near real brokers' data.

## 1. The verification pipeline doesn't gate on verification

This is the single biggest structural gap, so it goes first. `admin/review/page.tsx` lets a reviewer move a broker from `IDV_PENDING` to `SCREENING_PENDING` to `DOC_REVIEW_PENDING` to `PENDING_ADMIN_APPROVAL` to `ACTIVE` via buttons that are only constrained by the state machine's *allowed transitions* — not by whether a corresponding `VerificationCheck` row actually exists, let alone passed. A reviewer can click through the entire pipeline for a broker with zero checks on file. The new "External checks" card on the admin broker-profile page shows check results if you go look, but nothing in the queue itself surfaces "this broker has no IDV check" or blocks the transition if one is missing or failed.

Practically: the status labels currently function as a checklist a human is expected to follow off-system (physically confirm ID, physically check the police certificate PDF, etc.), not a mechanism that enforces it. That's a fine MVP posture if everyone involved knows that's what's happening. It's a serious gap if anyone — internally or externally — is being told "IDV\_PENDING means identity is being verified" and assuming that's automated.

## 2. The five unbuilt checks

- **IDV (`runIdv`)** — stub only. Logs a warning, writes a `PENDING` `VerificationCheck`, calls no vendor. FrankieOne was the named target vendor in the original plan; there's no sandbox integration yet, no document OCR/extraction, no biometric liveness check, no comparison of broker-entered data against extracted ID data (which was an explicit BRD requirement — "system compares broker-entered data against extracted ID&V data and flags disparities").
- **AML/PEP/sanctions** — no `runAml` method exists at all, not even a stub. `CheckType.AML` is defined in the schema and never referenced anywhere else in the codebase.
- **ASIC banned/disqualified register** — same: no `runAsic` method exists. This one matters more than it might look, because `BrokerBusiness.aclHolderType`/`aclNumber`/`creditRepresentativeNumber` are all self-entered text fields with nothing checking them against ASIC's actual register. A broker could currently enter a fabricated ACL number and nothing would catch it.
- **Credit / bankruptcy** — no `runCredit` method. The architecture doc flagged this as contingent on completing Equifax/illion's commercial credit-provider accreditation (a real, potentially slow process) — worth checking whether that conversation has even started, since it was called out as a Phase 1 date risk back in July.
- **Police check** — no automated check. Entirely dependent on the broker uploading a PDF/photo of a police certificate and an admin visually reviewing it via the documents card. No integration with fit2work or National Crime Check, both of which were already named as viable vendors.

None of these need to be built simultaneously. But it's worth deciding deliberately which one comes next rather than letting "ABN was easy so we did it" set the roadmap by accident. ID&V is the one the original BRD treats as foundational (it's literally what "IDV\_Pending" means), so it's the natural next pick if verification substance is the priority.

## 3. Ongoing monitoring exists in the schema but not in practice

`VerificationCheck.expiresAt` is set correctly (global 12-month policy), and `VerificationService.listStale()` correctly finds checks past that expiry. But nothing ever calls `listStale()`. There's no scheduled job, no cron, no admin dashboard surfacing "these 14 brokers have expired checks." A broker verified today will show as `ACTIVE` indefinitely even if their PI insurance lapsed fourteen months ago or they were added to a banned register last week — the data to know that might exist, but nothing acts on it. `broadcastAdverseFinding()` (notify every org with access when something adverse turns up) is also just a log line, not a real notification.

This is the difference between "verified once" and "verified once, forever, regardless of what happens after" — which is a materially different (and much weaker) claim to be making to lenders and aggregators relying on the network.

## 4. PI insurance and CPD are unverified free text, and CPD has a structural bug

PI insurance is two fields on `Broker` — `piInsurancePolicyNumber`, `piInsuranceExpiryAt` — entered by the broker, optionally backed by an uploaded certificate PDF an admin can eyeball. No insurer confirmation, no `VerificationCheck` row generated for it at all (despite the generic expiry-tracking machinery existing and being unused here), so it doesn't even benefit from the ongoing-monitoring gap being fixed — it'd need its own wiring.

CPD is a single integer, `cpdHoursCurrentYear`, with no year attached to it. That means: no automatic reset on 1 January, no historical record of prior years' completion, and no way to tell whether "20" was entered this month or eleven months ago. If CPD compliance ever needs to be reported on or audited (ASIC's expectation is roughly 20 hours/year, per the UI's own helper text), the current field can't actually answer "did this broker meet the requirement in each of the last three years" — it can only ever answer "what's the last number they typed in."

## 5. Security gaps that contradict the platform's own stated requirements

The architecture doc's Security epic explicitly states **"All authentication must support MFA," MVP: Yes**. There is no MFA anywhere in the codebase — no enrolment, no challenge, nothing. Given this platform aggregates identity documents, DOB, police check results, and credit licensing data across every broker in the network, this is the gap I'd flag most strongly of anything in this document, precisely because it was already identified as required and didn't make it into the build.

Two more, smaller but real:
- **No password reset flow at all.** Zero routes, zero UI. If a broker forgets their password, there's currently no self-service path back into their account — that's a support burden today and a security anti-pattern generally (it tends to push people toward workarounds).
- **No rate limiting anywhere.** `/auth/login` and `/auth/register/broker` have no throttling, no lockout after repeated failures, nothing. Both are open to automated credential-stuffing or account-enumeration attempts as they stand.

## 6. Model-level gaps

- **AFCA/EDR membership isn't tracked at all.** Association membership (MFAA/FBAA) has a field; external dispute resolution scheme membership — which brokers are required to hold under NCCP — has no equivalent anywhere in the schema. Worth checking whether this was a deliberate scope cut or just didn't come up.
- **The broker-XOR-business "exactly one subject" rule is enforced only in application code**, not as a DB constraint (documented as an open item in the architecture doc, still open). A bug or race condition could currently produce a `Document`/`VerificationCheck`/`ComplianceNote` row attached to neither or both, and the database wouldn't stop it.
- **No `CheckType` exists for bankruptcy, reference checks, or qualification verification specifically** — bankruptcy is conceptually folded into `CREDIT`, and qualifications/CPD live only as self-declared `Broker` fields with no corresponding check row ever generated, even once the checks pass admin review.

## 7. Smaller process gaps worth knowing about

- **No reference/employment-history checks anywhere** — common in aggregator onboarding agreements, not represented in the model at all.
- **Business details become read-only after creation** ("Editing existing business details isn't available yet — contact support," per the dashboard's own copy). Given ABNs, addresses, and entity structures legitimately change, this will generate real support tickets fairly quickly.
- **No duplicate-detection or fraud signals at registration** — nothing stops the same person registering multiple times under different emails, or the same ABN being used fraudulently by two different registrants.
- **No bulk-invite/CSV import** for an aggregator wanting to onboard many existing brokers at once — flagged as a roadmap idea in the original doc, still just an idea.
- **No offboarding workflow beyond the status transition itself** — `Active → Revoked` exists as a state change with a reason string, but there's no exit checklist, no data-retention decision point, no handover process.

## Suggested priority order

If the goal is closing the gap between "what the platform claims" and "what it actually does," roughly in order of risk:

1. **MFA** — already a documented MVP requirement that's missing; this is the fastest "we said we'd do this and didn't" fix, and the platform handles sensitive-enough data that it shouldn't wait.
2. **Gate the verification pipeline on actual check results** — even before IDV is real, the admin UI should refuse (or at minimum loudly warn) to advance a broker past a stage without a corresponding non-PENDING `VerificationCheck`. This makes the *existing* manual process safer without needing any new vendor integration.
3. **Real IDV via FrankieOne (or an alternative)** — this is what "IDV\_Pending" is supposed to mean, and it's the one piece the original BRD treats as non-negotiable.
4. **A scheduler that actually consumes `listStale()`** — the data model for ongoing monitoring already exists; it just needs something to run it and something to act on what it finds (admin dashboard + `broadcastAdverseFinding` actually sending).
5. **Password reset + basic rate limiting** — not glamorous, but both are one-day-of-work fixes for real gaps.
6. **CPD as a real, dated record** rather than a single unversioned integer, since the current shape can't support any real compliance reporting.

Everything else in this document (AML, ASIC, credit/bankruptcy, police, AFCA tracking, bulk invite, business editing, fraud signals) is real and worth doing, but lower-severity than the six above — either because a vendor dependency makes the timeline someone else's decision (credit bureau accreditation), or because the current manual/self-declared fallback is an acceptable stopgap for now (association membership, police check review).
