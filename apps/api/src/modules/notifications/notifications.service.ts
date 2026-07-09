import { Injectable, Logger } from "@nestjs/common";

// Epic: Notifications (Section 3). Milestone 1: log only. Wire up SES (or
// Postmark) once an AWS account and a verified sending domain exist - see
// SES_FROM_EMAIL in .env.example.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendStatusChangeEmail(to: string, fromStatus: string | null, toStatus: string) {
    this.logger.log(`[stub email] to=${to} status ${fromStatus ?? "(none)"} -> ${toStatus}`);
  }

  async sendAccessGrantNotification(to: string, orgName: string, status: string) {
    this.logger.log(`[stub email] to=${to} access grant with ${orgName} -> ${status}`);
  }
}
