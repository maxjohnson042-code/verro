import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { BrokerBusinessModule } from "./modules/broker-business/broker-business.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AccessGrantsModule } from "./modules/access-grants/access-grants.module";

// Modules mirror the domain boundaries from Section 4 of the architecture
// doc: Onboarding, BrokerBusiness, VerificationOrchestration,
// CaseCompliance (status state machine + notes/flags), Documents,
// Notifications, Admin - plus AccessGrants for the consent model.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    OnboardingModule,
    BrokerBusinessModule,
    VerificationModule,
    ComplianceModule,
    DocumentsModule,
    NotificationsModule,
    AdminModule,
    AccessGrantsModule,
  ],
})
export class AppModule {}
