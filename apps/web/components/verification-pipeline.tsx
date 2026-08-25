import { Fragment } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusEvent {
  toStatus: string;
  createdAt: string;
}

// Canonical linear pipeline - mirrors ALLOWED_TRANSITIONS in
// apps/api/src/modules/compliance/broker-verification.service.ts. DRAFT
// isn't a step here since it's the "not submitted yet" state before the
// pipeline starts; DECLINED/SUSPENDED/REVOKED are branch states handled
// separately by the caller (see the early return below) rather than
// forced into this linear stepper.
const PIPELINE_STEPS = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "IDV_PENDING", label: "ID check" },
  { key: "SCREENING_PENDING", label: "Screening" },
  { key: "DOC_REVIEW_PENDING", label: "Doc review" },
  { key: "PENDING_ADMIN_APPROVAL", label: "Admin review" },
  { key: "ACTIVE", label: "Active" },
] as const;

const BRANCH_STATES = ["DECLINED", "SUSPENDED", "REVOKED"];

function stepDate(statusEvents: StatusEvent[], stepKey: string): string | null {
  const event = statusEvents.find((e) => e.toStatus === stepKey);
  return event ? new Date(event.createdAt).toLocaleDateString() : null;
}

export function VerificationPipeline({
  overallStatus,
  statusEvents,
}: {
  overallStatus: string;
  statusEvents: StatusEvent[];
}) {
  if (BRANCH_STATES.includes(overallStatus)) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Verification status: {overallStatus}. Contact support if you have questions.
      </p>
    );
  }

  const overallIndex = PIPELINE_STEPS.findIndex((s) => s.key === overallStatus);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start" style={{ minWidth: "min(100%, 32rem)" }}>
        {PIPELINE_STEPS.map((step, index) => {
          const isComplete = overallIndex > index || (overallIndex === index && step.key === "ACTIVE");
          const isCurrent = overallIndex === index && step.key !== "ACTIVE";
          const date = stepDate(statusEvents, step.key);
          return (
            <Fragment key={step.key}>
              <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <p
                  className={cn(
                    "text-center text-[10px] font-medium leading-tight",
                    isComplete && "text-success",
                    isCurrent && "text-primary",
                    !isComplete && !isCurrent && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {date && <p className="text-center text-[10px] text-muted-foreground">{date}</p>}
              </div>
              {index < PIPELINE_STEPS.length - 1 && (
                <div className={cn("mt-2.5 h-px flex-1", overallIndex > index ? "bg-success" : "bg-border")} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
