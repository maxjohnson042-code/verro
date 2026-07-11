// Seeds real Australian mortgage aggregators and lenders as Organization
// rows, so the broker onboarding wizard's aggregator/lender picker (Epic:
// Broker onboarding) has real options instead of the dev-only "add one"
// fallback. Plain CommonJS (not TS) so it can run with plain `node`,
// without adding ts-node as a monorepo dependency.
//
// Names only - no ABN/ACN or contact details are fabricated here, since
// those would be unverified placeholder data masquerading as real
// compliance-relevant fields. Idempotent: safe to run more than once
// (checks for an existing row by legalName + orgType before creating).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Dev-only seeded admin login (Milestone 2 auth) - there's no admin
// invite flow yet, so this is the only way to get an INTERNAL_ADMIN
// PortalUser to test the Admin portal locally. Change/remove before this
// ever runs anywhere but a local machine.
const ADMIN_EMAIL = "admin@verro.local";
const ADMIN_PASSWORD = "verro-admin-dev";

// Dev-only seeded Client/FI portal logins - there's no self-serve org
// signup or invite flow yet (Section 8, open decision #5), so these are
// the only way to log in as an org and test the Client/FI portal locally.
// Tied to the first lender/aggregator seeded below. Change/remove before
// this ever runs anywhere but a local machine.
const ORG_USERS = [
  { email: "lender@verro.local", password: "verro-lender-dev", legalName: "Commonwealth Bank of Australia", orgType: "LENDER" },
  { email: "aggregator@verro.local", password: "verro-aggregator-dev", legalName: "Australian Finance Group (AFG)", orgType: "AGGREGATOR" },
];

// Dev-only demo brokers - so all three portals have something real to
// look at immediately after seeding, without manually registering and
// progressing a broker through the pipeline first. Same password for all
// three, for convenience. Change/remove before this ever runs anywhere
// but a local machine.
const DEMO_BROKER_PASSWORD = "verro-broker-dev";

// Must match ComplianceService.STANDARD_LENDER_TRAINING (apps/api) - kept
// as a separate literal here since this script runs standalone with plain
// node, not through the Nest app.
const LENDER_TRAINING_MODULES = [
  "Responsible lending training",
  "Best interests duty training",
  "Privacy, AML/CTF & fraud training",
  "CRM & loan submission platform training",
  "Lender product & policy training",
];

// Major mortgage aggregators operating in Australia (broker networks that
// brokers affiliate with - Epic: Broker onboarding, "link to the
// Aggregator or Broking firm I work through").
const aggregators = [
  "Australian Finance Group (AFG)",
  "Connective",
  "Loan Market Group (LMG)",
  "Finsure",
  "Outsource Financial",
  "Specialist Finance Group (SFG)",
  "MoneyQuest",
  "Vow Financial",
  "Astute Financial Management",
  "Australian Mortgage Acquisitions Group (AMAG)",
];

// Lenders spanning the big four, major second-tier/regional banks, and
// leading non-bank lenders - Epic: Broker onboarding, "select the Lenders
// I wish to onboard with".
const lenders = [
  "Commonwealth Bank of Australia",
  "Westpac Banking Corporation",
  "National Australia Bank (NAB)",
  "ANZ Bank",
  "Macquarie Bank",
  "Bankwest",
  "St.George Bank",
  "ING Australia",
  "Suncorp Bank",
  "AMP Bank",
  "Bendigo and Adelaide Bank",
  "Bank of Queensland (BOQ)",
  "ME Bank",
  "Newcastle Permanent",
  "IMB Bank",
  "Great Southern Bank",
  "Unloan",
  "Athena Home Loans",
  "Firstmac",
  "La Trobe Financial",
  "Resimac",
  "Pepper Money",
  "Liberty Financial",
];

// Australia's two mortgage broker associations - Epic: Broker onboarding.
// Now a real Organization (orgType ASSOCIATION) rather than just the
// self-declared associationName/associationMembershipNumber text fields,
// since the chain-of-trust rework requires a genuine accept step from the
// association before a broker can connect to an aggregator.
const associations = ["MFAA", "FBAA"];

async function upsertOrg(legalName, orgType) {
  const existing = await prisma.organization.findFirst({ where: { legalName, orgType } });
  if (existing) return existing;
  return prisma.organization.create({ data: { legalName, orgType } });
}

async function upsertPanel(aggregatorOrgId, lenderOrgId) {
  const existing = await prisma.aggregatorLenderPanel.findFirst({ where: { aggregatorOrgId, lenderOrgId } });
  if (existing) return existing;
  return prisma.aggregatorLenderPanel.create({ data: { aggregatorOrgId, lenderOrgId } });
}

async function seedAdmin() {
  const existing = await prisma.portalUser.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  return prisma.portalUser.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "INTERNAL_ADMIN",
      firstName: "Verro",
      lastName: "Admin",
    },
  });
}

async function seedOrgUser({ email, password, organizationId }) {
  const existing = await prisma.portalUser.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.portalUser.create({
    data: {
      email,
      passwordHash,
      role: "CLIENT_ADMIN",
      organizationId,
      firstName: "Verro",
      lastName: "Client",
    },
  });
}

// Broker + login are created together (mirrors AuthService.registerBroker)
// so a demo broker can actually be logged into. Returns isNew so callers
// can skip re-seeding dependent rows (relationships, grants, history) on
// repeat runs - those don't have a natural unique key to upsert against.
async function upsertDemoBroker(data) {
  const existing = await prisma.broker.findUnique({ where: { email: data.email } });
  if (existing) return { broker: existing, isNew: false };
  const broker = await prisma.broker.create({ data });
  return { broker, isNew: true };
}

async function upsertDemoBrokerLogin(email, brokerId, firstName, lastName) {
  const existing = await prisma.portalUser.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(DEMO_BROKER_PASSWORD, 10);
  return prisma.portalUser.create({
    data: { email, passwordHash, role: "BROKER", brokerId, firstName, lastName },
  });
}

async function grantAccess(brokerId, organizationId) {
  return prisma.accessGrant.upsert({
    where: { brokerId_organizationId: { brokerId, organizationId } },
    create: {
      brokerId,
      organizationId,
      origin: "BROKER_INITIATED",
      status: "GRANTED",
      decidedAt: new Date(),
      decidedByBrokerId: brokerId,
    },
    update: {},
  });
}

async function main() {
  const aggregatorOrgs = [];
  for (const legalName of aggregators) {
    aggregatorOrgs.push(await upsertOrg(legalName, "AGGREGATOR"));
  }
  const lenderOrgs = [];
  for (const legalName of lenders) {
    lenderOrgs.push(await upsertOrg(legalName, "LENDER"));
  }
  const associationOrgs = [];
  for (const legalName of associations) {
    associationOrgs.push(await upsertOrg(legalName, "ASSOCIATION"));
  }

  // Deterministic PARTIAL panel (not every aggregator has every lender) so
  // the "lender must be on the aggregator's panel" restriction is
  // actually exercised in testing, not vacuously true. Each aggregator
  // gets roughly two-thirds of the lenders.
  let panelCount = 0;
  for (let a = 0; a < aggregatorOrgs.length; a++) {
    for (let l = 0; l < lenderOrgs.length; l++) {
      if ((l + a) % 3 === 0) continue;
      await upsertPanel(aggregatorOrgs[a].id, lenderOrgs[l].id);
      panelCount++;
    }
  }
  // Explicitly guarantee AFG <-> CBA are on each other's panel, regardless
  // of the deterministic pattern above - the demo broker below connects
  // through exactly this pair, and the dev org logins are tied to exactly
  // these two orgs, so this keeps the demo data consistent with the
  // panel-restriction business rule rather than seeding around it.
  await upsertPanel(aggregatorOrgs[0].id, lenderOrgs[0].id);

  await seedAdmin();

  for (const orgUser of ORG_USERS) {
    const org = [...aggregatorOrgs, ...lenderOrgs].find((o) => o.legalName === orgUser.legalName);
    if (!org) continue;
    await seedOrgUser({ email: orgUser.email, password: orgUser.password, organizationId: org.id });
  }

  // --- Demo broker 1: fresh signup, nothing done yet. Good for testing
  // the Broker portal's "Your activities" dashboard from a blank slate.
  const sam = await upsertDemoBroker({
    firstName: "Sam",
    lastName: "Newbroker",
    email: "sam.broker@verro.local",
    dateOfBirth: new Date("1990-01-01"),
    overallStatus: "DRAFT",
  });
  await upsertDemoBrokerLogin(sam.broker.email, sam.broker.id, "Sam", "Newbroker");

  // --- Demo broker 2: submitted, sitting in Admin's verification queue.
  // Good for testing Admin verification actions immediately.
  const alex = await upsertDemoBroker({
    firstName: "Alex",
    lastName: "Pending",
    email: "alex.broker@verro.local",
    dateOfBirth: new Date("1988-05-14"),
    overallStatus: "SUBMITTED",
    attestedAt: new Date(),
  });
  await upsertDemoBrokerLogin(alex.broker.email, alex.broker.id, "Alex", "Pending");
  if (alex.isNew) {
    await prisma.brokerStatusEvent.create({
      data: {
        brokerId: alex.broker.id,
        fromStatus: "DRAFT",
        toStatus: "SUBMITTED",
        reason: "Broker submitted onboarding",
      },
    });
  }

  // --- Demo broker 3: fully ACTIVE with real relationships to an
  // association, aggregator, and lender, so the Client/FI portal
  // (lender@verro.local / aggregator@verro.local) has something to show
  // immediately, and the Broker portal shows the fully "caught up" state.
  const associationOrg = associationOrgs.find((o) => o.legalName === "MFAA");
  const aggregatorOrg = aggregatorOrgs[0]; // AFG
  const lenderOrg = lenderOrgs[0]; // CBA - guaranteed on AFG's panel above

  const jane = await upsertDemoBroker({
    firstName: "Jane",
    lastName: "Broker",
    email: "jane.broker@verro.local",
    dateOfBirth: new Date("1985-03-20"),
    overallStatus: "ACTIVE",
    attestedAt: new Date(),
    associationName: "MFAA",
    associationMembershipNumber: "MFAA-10023",
    certIvCompletedAt: new Date("2015-06-01"),
    diplomaCompletedAt: new Date("2017-09-01"),
    cpdHoursCurrentYear: 24,
    piInsurancePolicyNumber: "PI-998877",
    piInsuranceExpiryAt: new Date("2027-01-01"),
  });
  await upsertDemoBrokerLogin(jane.broker.email, jane.broker.id, "Jane", "Broker");

  if (jane.isNew) {
    const janeVerificationSteps = [
      ["DRAFT", "SUBMITTED"],
      ["SUBMITTED", "IDV_PENDING"],
      ["IDV_PENDING", "SCREENING_PENDING"],
      ["SCREENING_PENDING", "DOC_REVIEW_PENDING"],
      ["DOC_REVIEW_PENDING", "PENDING_ADMIN_APPROVAL"],
      ["PENDING_ADMIN_APPROVAL", "ACTIVE"],
    ];
    for (const [fromStatus, toStatus] of janeVerificationSteps) {
      await prisma.brokerStatusEvent.create({ data: { brokerId: jane.broker.id, fromStatus, toStatus } });
    }

    const janeBusiness = await prisma.brokerBusiness.create({
      data: {
        legalName: "Jane Broker Finance",
        entityType: "SOLE_TRADER",
        abnAcn: "12 345 678 901",
        aclHolderType: "CREDIT_REPRESENTATIVE",
      },
    });
    await prisma.brokerBusinessMembership.create({
      data: { brokerId: jane.broker.id, brokerBusinessId: janeBusiness.id, role: "PRINCIPAL", isPrimary: true },
    });

    // Association relationship
    const assocRel = await prisma.brokerRelationship.create({
      data: { brokerId: jane.broker.id, organizationId: associationOrg.id, status: "ACTIVE" },
    });
    await prisma.statusEvent.create({
      data: {
        relationshipId: assocRel.id,
        fromStatus: "PENDING_ACCEPTANCE",
        toStatus: "ACTIVE",
        reason: "Membership confirmed",
      },
    });
    await grantAccess(jane.broker.id, associationOrg.id);

    // Aggregator relationship (credit rep already appointed)
    const aggRel = await prisma.brokerRelationship.create({
      data: {
        brokerId: jane.broker.id,
        organizationId: aggregatorOrg.id,
        status: "ACTIVE",
        creditRepNumber: "CR-445566",
        creditRepAuthorisedAt: new Date(),
      },
    });
    await prisma.statusEvent.create({
      data: {
        relationshipId: aggRel.id,
        fromStatus: "PENDING_ACCEPTANCE",
        toStatus: "ACTIVE",
        reason: "Credit representative appointment recorded",
      },
    });
    await grantAccess(jane.broker.id, aggregatorOrg.id);

    // Lender relationship (all accreditation modules completed)
    const lenderRel = await prisma.brokerRelationship.create({
      data: { brokerId: jane.broker.id, organizationId: lenderOrg.id, status: "ACTIVE" },
    });
    await prisma.statusEvent.create({
      data: {
        relationshipId: lenderRel.id,
        fromStatus: "ACCREDITATION_PENDING",
        toStatus: "ACTIVE",
        reason: "All accreditation modules completed",
      },
    });
    for (const trainingName of LENDER_TRAINING_MODULES) {
      await prisma.trainingRecord.create({
        data: { relationshipId: lenderRel.id, trainingName, completed: true, completedDate: new Date() },
      });
    }
    await grantAccess(jane.broker.id, lenderOrg.id);

    // A note and an open flag from the lender, so the Client/FI portal
    // has something to look at on first login.
    const lenderPortalUser = await prisma.portalUser.findUnique({ where: { email: "lender@verro.local" } });
    if (lenderPortalUser) {
      await prisma.complianceNote.create({
        data: {
          brokerId: jane.broker.id,
          organizationId: lenderOrg.id,
          authorUserId: lenderPortalUser.id,
          body: "Strong file quality on recent submissions. No concerns.",
          visibility: "PRIVATE_TO_ORG",
        },
      });
      await prisma.complianceFlag.create({
        data: {
          brokerId: jane.broker.id,
          raisedByOrganizationId: lenderOrg.id,
          raisedByUserId: lenderPortalUser.id,
          category: "DOCUMENTATION",
          severity: "LOW",
          description: "Missing updated proof of address - requested from broker.",
          status: "OPEN",
        },
      });
    }
  }

  console.log(`Seeded ${aggregators.length} aggregators, ${lenders.length} lenders, ${associations.length} associations.`);
  console.log(`Seeded ${panelCount} aggregator-lender panel entries.`);
  console.log("");
  console.log("Dev logins:");
  console.log(`  Admin:               ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  for (const orgUser of ORG_USERS) {
    console.log(`  Org (${orgUser.legalName}): ${orgUser.email} / ${orgUser.password}`);
  }
  console.log(`  Broker (draft, no data):        sam.broker@verro.local / ${DEMO_BROKER_PASSWORD}`);
  console.log(`  Broker (submitted, in review):  alex.broker@verro.local / ${DEMO_BROKER_PASSWORD}`);
  console.log(`  Broker (active, fully linked):  jane.broker@verro.local / ${DEMO_BROKER_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
