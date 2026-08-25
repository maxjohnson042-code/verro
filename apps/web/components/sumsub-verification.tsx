"use client";

import { useCallback, useEffect, useState } from "react";
import SumsubWebSdk from "@sumsub/websdk-react";
import { apiFetch } from "@/lib/api-client";

// Embeds Sumsub's WebSDK for the logged-in broker's own identity
// verification. The widget is an iframe Sumsub hosts and controls
// entirely (camera/mic capture, liveness check, document upload) - this
// component's only job is minting/refreshing the access token it needs
// (POST /verification/idv/token) and showing loading/error states around
// it. What happens after a session completes (PASS/FAIL, pipeline
// transitions) is handled server-side by
// VerificationService.handleIdvWebhook, not here - this widget never
// learns the outcome directly, it just launches the flow.
export function SumsubVerification() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    const res = await apiFetch<{ token: string; applicantId: string }>("/verification/idv/token", {
      method: "POST",
    });
    return res.token;
  }, []);

  useEffect(() => {
    fetchToken()
      .then(setAccessToken)
      .catch((err) => setError((err as Error).message));
  }, [fetchToken]);

  // Sumsub SDK tokens are short-lived (10 min by default - see
  // createAccessToken's ttlInSecs in sumsub-client.ts). The widget calls
  // this itself whenever the current token is about to expire mid-session,
  // so a long verification flow doesn't get cut off.
  const expirationHandler = useCallback(async () => fetchToken(), [fetchToken]);

  if (error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Couldn&apos;t start identity verification: {error}
      </p>
    );
  }

  if (!accessToken) {
    return <p className="text-sm text-muted-foreground">Loading identity verification...</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <SumsubWebSdk
        accessToken={accessToken}
        expirationHandler={expirationHandler}
        config={{ lang: "en" }}
        options={{ addViewportTag: false, adaptIframeHeight: true }}
        onMessage={() => {}}
        onError={(err: unknown) => setError(typeof err === "string" ? err : "Verification widget error")}
      />
    </div>
  );
}
