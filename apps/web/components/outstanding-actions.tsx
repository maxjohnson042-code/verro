import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OutstandingActionButton {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive";
  disabled?: boolean;
}

export interface OutstandingAction {
  id: string;
  label: string;
  description?: string;
  onClick?: () => void;
  buttons?: OutstandingActionButton[];
}

// Consolidates everything that needs the broker's own action - incomplete
// profile tasks, rejected documents, and pending access grant requests -
// into one at-a-glance list. Deliberately excludes relationships where the
// ball is in an organization's court (see the separate "Waiting on
// others" card in the dashboard) - this list is only ever things the
// broker themselves can act on right now.
export function OutstandingActions({ items }: { items: OutstandingAction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outstanding actions</CardTitle>
        <CardDescription>
          {items.length > 0 ? "Everything that needs your attention right now, in one place." : "Nothing needs your attention right now."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length === 0 && (
          <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            You&apos;re all caught up.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2",
              item.onClick && "cursor-pointer hover:bg-secondary",
            )}
            onClick={item.onClick}
            role={item.onClick ? "button" : undefined}
          >
            <div className="grid">
              <span className="text-sm font-medium">{item.label}</span>
              {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
            </div>
            {item.buttons ? (
              <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {item.buttons.map((btn) => (
                  <Button
                    key={btn.label}
                    type="button"
                    size="sm"
                    variant={btn.variant ?? "outline"}
                    disabled={btn.disabled}
                    onClick={btn.onClick}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            ) : item.onClick ? (
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
