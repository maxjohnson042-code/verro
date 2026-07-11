import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

// Epic: Notifications (Section 3). Live via Resend (resend.com) - a real
// send happens whenever RESEND_API_KEY is configured; without it, this
// service falls back to logging the email instead of sending it, so local
// dev keeps working with zero setup (see .env.example). Every send is
// wrapped in try/catch: a broken email provider should never block a
// status transition or access-grant decision, which is why every call
// site treats this as fire-and-forget.
function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background:#111827;padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.02em;">Verro</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:#18181b;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#fafafa;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:12px;color:#71717a;">
                  You're receiving this because you have an account with Verro. This is an automated message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = this.config.get<string>("EMAIL_FROM") ?? "Verro <onboarding@resend.dev>";
    this.appBaseUrl = this.config.get<string>("APP_BASE_URL") ?? "http://localhost:3000";

    if (!this.resend) {
      this.logger.warn(
        "RESEND_API_KEY not set - emails will be logged instead of sent. See .env.example to enable real sending.",
      );
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.log(`[stub email] to=${to} subject="${subject}"`);
      return;
    }
    try {
      const result = await this.resend.emails.send({ from: this.fromAddress, to, subject, html });
      if (result.error) {
        this.logger.error(`Email to ${to} failed: ${result.error.message}`);
        return;
      }
      this.logger.log(`Email sent to ${to} (id=${result.data?.id ?? "unknown"})`);
    } catch (err) {
      // Never let an email provider outage break the caller's transaction -
      // the status change / grant decision has already been persisted by
      // the time this runs.
      this.logger.error(`Email to ${to} threw: ${(err as Error).message}`);
    }
  }

  // Fired from BrokerVerificationService (overall verification pipeline)
  // and ComplianceService (per-org relationship state machine). contextLabel
  // distinguishes the two in the copy, e.g. "your Verro verification" vs
  // "your relationship with Australian Finance Group (AFG)".
  async sendStatusChangeEmail(
    to: string,
    recipientName: string,
    contextLabel: string,
    fromStatus: string | null,
    toStatus: string,
    reason?: string,
  ) {
    const prettyTo = humanizeStatus(toStatus);
    const subject = `Update on ${contextLabel}: ${prettyTo}`;
    const body = `
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;">Hi ${recipientName},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;">
        The status of ${contextLabel} has changed${fromStatus ? ` from <strong>${humanizeStatus(fromStatus)}</strong>` : ""} to
        <strong>${prettyTo}</strong>.
      </p>
      ${reason ? `<p style="margin:0 0 12px;font-size:14px;color:#3f3f46;">Note: ${reason}</p>` : ""}
      <a href="${this.appBaseUrl}/broker" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#111827;color:#ffffff;font-size:14px;text-decoration:none;border-radius:6px;">
        View your dashboard
      </a>
    `;
    await this.send(to, subject, emailShell(subject, body));
  }

  // Fired from AccessGrantsService.requestAccess - an organization has
  // asked to see a broker's profile without an existing relationship, and
  // the broker needs to explicitly grant or deny it (Section 1.1 consent
  // model). Also usable for GRANTED/DENIED/REVOKED confirmations later.
  async sendAccessGrantNotification(to: string, recipientName: string, orgName: string, status: string) {
    const isPendingDecision = status === "PENDING";
    const subject = isPendingDecision
      ? `${orgName} has requested access to your Verro profile`
      : `Access grant update: ${orgName}`;
    const body = `
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;">Hi ${recipientName},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46;">
        ${
          isPendingDecision
            ? `<strong>${orgName}</strong> has requested access to view your Verro profile. Nothing is shared until you approve it.`
            : `Your data-sharing status with <strong>${orgName}</strong> is now <strong>${humanizeStatus(status)}</strong>.`
        }
      </p>
      <a href="${this.appBaseUrl}/broker/profile" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#111827;color:#ffffff;font-size:14px;text-decoration:none;border-radius:6px;">
        ${isPendingDecision ? "Review the request" : "View your profile"}
      </a>
    `;
    await this.send(to, subject, emailShell(subject, body));
  }
}
