"use client";

import { useEffect, useState } from "react";
import { apiFetchImageUrl } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Shared avatar used everywhere a broker's profile shows up (their own
// dashboard/profile, the admin broker-profile page, the Client/FI portal
// broker detail page). Fetches GET /documents/broker/:brokerId/photo
// (same GRANTED-access/self/admin guard as every other document route)
// and falls back to initials-on-a-circle when no photo has been
// uploaded yet, rather than showing a broken image or an error.
export function BrokerAvatar({
  brokerId,
  firstName,
  lastName,
  size = 48,
  version = 0,
}: {
  brokerId: string;
  firstName: string;
  lastName: string;
  size?: number;
  // Bump this after a successful photo upload to force a re-fetch - the
  // brokerId itself doesn't change on re-upload, so it alone wouldn't
  // retrigger the effect.
  version?: number;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    apiFetchImageUrl(`/documents/broker/${brokerId}/photo`).then((url) => {
      if (cancelled) return;
      objectUrl = url;
      setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [brokerId, version]);

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        style={{ width: size, height: size }}
        className="rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        "flex items-center justify-center rounded-full border border-border bg-secondary font-medium text-muted-foreground",
      )}
    >
      {initials || "?"}
    </div>
  );
}
