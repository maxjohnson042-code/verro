# Verro platform — Milestone 0 scaffold

This is the Milestone 0 scaffold described in `platform-architecture-and-brd-additions.md`
(Section 9, "Where to begin"): repo structure, the Postgres schema translated
from the domain model in Section 1, and NestJS/Next.js skeletons for the
three portals. No vendor integrations or AWS resources are provisioned —
those need your own accounts/credentials, see "What's stubbed" below.

## Structure

```
apps/
  web/     Next.js app - three portals as URL segments, each with its own
           layout: /broker, /portal (Client: aggregator/lender/association),
           /admin (internal)
  api/     NestJS backend - modules mirror the domain: onboarding,
           broker-business, verification, compliance (status state
           machine + compliance notes/flags), documents, notifications,
           admin, access-grants (consent model)
packages/
  db/      Prisma schema (packages/db/prisma/schema.prisma) - the ERD from
           Section 1 of the architecture doc: Broker/BrokerBusiness split,
           AccessGrant for consent, ComplianceNote/ComplianceFlag
  types/   Shared TypeScript types for the frontend
```

## Local dev setup

1. **Start Postgres and Redis:**
   ```
   docker compose up -d
   ```
2. **Install dependencies** (run once from the repo root — npm workspaces
   will link `@verro/db` and `@verro/types` into the apps automatically):
   ```
   npm install
   ```
3. **Copy the env file and fill in what you have:**
   ```
   cp .env.example .env
   ```
   Leave the AWS/vendor keys blank for now — the API falls back to stub
   behaviour (see below) when they're not set.
4. **Run the first migration** (creates all tables from `schema.prisma`):
   ```
   npm run db:migrate
   ```
5. **Start everything:**
   ```
   npm run dev
   ```
   This runs the Next.js app on `http://localhost:3000` and the NestJS API
   on `http://localhost:3001` via Turborepo.
6. Visit `http://localhost:3000`, pick a portal. `/broker/onboarding` will
   actually create a broker row via the API; `/admin/review` will actually
   query the review queue.

## What's real vs. stubbed

**Real and working once you run the steps above:**
- The full Postgres schema (all entities from Section 1 of the architecture
  doc), including the `Broker` / `BrokerBusiness` split (sole trader vs.
  multi-broker firm, via `BrokerBusinessMembership`), `AccessGrant` for the
  consent model, and `ComplianceNote` / `ComplianceFlag`.
- Broker registration (`POST /brokers`) end to end: web form → API → Postgres.
- Broker business creation and membership management
  (`POST /broker-businesses`, `POST /broker-businesses/:id/members`).
- The broker relationship status state machine (`ComplianceService`) with
  its allowed-transitions table matching Section 2 of the architecture doc,
  and an append-only `StatusEvent` audit log.
- The admin review queue (`GET /admin/review-queue`), querying real data.
- The `AccessGrant` model and service (broker-initiated auto-grant vs.
  org-requested pending-approval, per Section 1.1 / the Data sharing &
  consent epic). Revocation is intentionally never blocked - see the
  comment in `access-grants.service.ts`.
- Compliance notes (`POST /compliance-notes`, org-private by default) and
  compliance flags (`POST /compliance-flags`, always network-visible) -
  see `compliance-notes.service.ts` / `compliance-flags.service.ts`.
- `VerificationCheck.expiresAt`: every check is stamped with a 12-month
  global expiry at creation time (`VerificationService.oneYearFromNow()`),
  and `GET /verification/stale` lists checks past that date.

**Stubbed — needs your accounts/credentials to go live:**
- **Production identity.** Local email/password login, JWT authentication,
  and role-based endpoint guards are implemented. Cognito is not wired yet;
  the current browser session uses local storage and is suitable for local
  development only. Production startup requires an explicit `JWT_SECRET`.
- **Document storage.** `DocumentsService.recordUpload` just writes a
  `storageKey` string to Postgres; it doesn't talk to S3. Add presigned
  upload URLs once you have an AWS account and bucket.
- **ABN Lookup, FrankieOne, credit bureau.** `VerificationService` has
  `runAbnLookup` and `runIdv` methods that create a `PENDING`
  `VerificationCheck` row and log a warning instead of calling the real
  vendor. Fill in the `TODO` comments once API keys exist — ABN Lookup is
  free and simplest, start there (Milestone 2 in Section 9).
- **Email.** `NotificationsService` logs instead of sending. Wire up SES (or
  Postmark) once you have a verified sending domain.
- **Adverse-finding broadcast.** `VerificationService.broadcastAdverseFinding`
  is a stub — the real version should look up every `AccessGrant` with
  `status = GRANTED` for a broker and notify each organization.

## Open product decisions carried over from the architecture doc

Resolved since the last review pass: `AccessGrant` revocation is **never**
blocked, even on an active relationship (Section 8, decision #3); check
expiry is a **global, annual** policy for every check type (decision #4).
Both are implemented as described above.

Still open, worth deciding before you build much further into Milestones 1+:
- FrankieOne's actual AU coverage for the ASIC banned & disqualified
  register — confirm during vendor evaluation, it determines whether
  `CheckType.ASIC` needs a different vendor.
- Whether a broker can see compliance flags raised against them, and how
  much detail (category/severity only vs. full description) — a policy
  question, not just a technical one.
- Adding a DB-level CHECK constraint enforcing "exactly one of
  broker/brokerBusiness set" on `VerificationCheck`, `Document`,
  `StatusEvent`, `ComplianceNote`, `ComplianceFlag` — currently only
  enforced in application code.

See `platform-architecture-and-brd-additions.md` for the full reasoning
behind all of the above.
