"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api-client";

interface ReviewQueueItem {
  id: string;
  status: string;
  broker: { firstName: string; lastName: string };
  organization: { legalName: string };
}

// Milestone 1: internal Admin review queue, driven entirely by manual
// approve/decline decisions (Epic: Verro 'admin' review). Hits
// GET /admin/review-queue on the NestJS API.
export default function AdminReviewQueuePage() {
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ReviewQueueItem[]>("/admin/review-queue")
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      <h1>Review queue</h1>
      {error && <p>Could not load review queue: {error} (is the API running?)</p>}
      {!error && !items && <p>Loading...</p>}
      {items && items.length === 0 && <p>Nothing pending review.</p>}
      {items && items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Broker</th>
              <th>Organization</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.broker.firstName} {item.broker.lastName}
                </td>
                <td>{item.organization.legalName}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
