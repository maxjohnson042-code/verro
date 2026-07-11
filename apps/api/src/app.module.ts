import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { BrokerBusinessModule } from "./modules/broker-business/broker-business.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AccessGrantsModule } from "./modules/access-grants/access-grants.module";
import { AuthModule } from "./modules/auth/auth.module";

// Modules mirror the domain boundaries from Section 4 of the architecture
// doc: Onboarding, BrokerBusiness, Organizations, VerificationOrchestration,
// CaseCompliance (status state machine + notes/flags), Documents,
// Notifications, Admin - plus AccessGrants for the consent model.
//
// envFilePath lists both the monorepo root .env and a local one - Nest's
// ConfigModule loads every path that exists and the first file wins on
// conflicting keys, so this works whether the process is launched from
// the repo root (turbo) or from apps/api directly, without needing a
// duplicate .env checked in here.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    OnboardingModule,
    BrokerBusinessModule,
    OrganizationsModule,
    VerificationModule,
    ComplianceModule,
    DocumentsModule,
    NotificationsModule,
    AdminModule,
    AccessGrantsModule,
    AuthModule,
  ],
})
export class AppModule {}
