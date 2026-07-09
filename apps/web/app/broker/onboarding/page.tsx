"use client";

import { useState } from "react";
import { apiFetch } from "../../../lib/api-client";

// Milestone 1 walking skeleton: personal info only. Business info,
// document upload, association/aggregator link, and lender multi-select
// (BRD Epic: Broker onboarding) get added as further steps in this wizard.
export default function BrokerOnboardingPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Submitting...");
    try {
      const broker = await apiFetch<{ id: string }>("/brokers", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, dateOfBirth }),
      });
      setStatus(`Registered - broker id ${broker.id}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <h1>Broker onboarding — Step 1: Personal information</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        <button type="submit">Continue</button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
}
