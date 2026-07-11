"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { getAuth, saveAuth, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Section 2 (reworked, then simplified for the broker portal/dashboard):
// onboarding is now JUST account creation - name, email, DOB, password.
// Everything else that used to be here (business info, qualifications/CPD,
// PI insurance, association membership, attest + submit) is now handled as
// activities on the /broker dashboard instead, since a lot of that
// information (insurance details, an MFAA/FBAA number, etc.) genuinely
// isn't known at signup time. The dashboard lets a broker come back and
// fill each of those in whenever they have it, in any order, rather than
// forcing it into a single up-front wizard.
export default function BrokerOnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (auth && auth.user.role === "BROKER") {
      setAlreadyLoggedIn(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Registering...");
    try {
      // Creates both the Broker profile and the login (PortalUser)
      // together, and returns a token - every request from here on is
      // authenticated as this broker (see api-client.ts / auth.ts).
      const result = await apiFetch<{ broker: { id: string }; accessToken: string }>("/auth/register/broker", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, dateOfBirth, password }),
      });
      const user: AuthUser = {
        id: result.broker.id,
        email,
        role: "BROKER",
        organizationId: null,
        brokerId: result.broker.id,
      };
      saveAuth(result.accessToken, user);
      router.push("/broker");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  if (alreadyLoggedIn) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re already registered</CardTitle>
            <CardDescription>Head to your dashboard to see what&apos;s next.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => router.push("/broker")}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight">Create your broker account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Just the basics for now — you&apos;ll complete verification, business details, and everything else from
        your dashboard once you&apos;re in, at your own pace.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Your legal name and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">At least 8 characters. You&apos;ll use this to log back in.</p>
            </div>
            {status && <p className="text-sm text-muted-foreground">{status}</p>}
            <Button type="submit" className="mt-2">
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <a href="/broker/login" className="text-primary hover:underline">
                Log in
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
