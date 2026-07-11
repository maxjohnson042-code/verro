import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const portals = [
  {
    href: "/broker",
    title: "Broker portal",
    description: "Register, complete onboarding, and manage your accreditation across every organization you work with.",
  },
  {
    href: "/portal",
    title: "Aggregator / lender / association portal",
    description: "Review brokers who've granted you access, see shared verification status, and raise compliance notes or flags.",
  },
  {
    href: "/admin",
    title: "Internal Admin portal",
    description: "Move broker applications through the review queue and manage flagged or suspended relationships.",
  },
];

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col justify-center gap-8 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verro</h1>
        <p className="mt-2 text-muted-foreground">
          Broker identity, verification, and compliance platform. Verify once, trusted by the network. Pick a portal
          to continue.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {portals.map((portal) => (
          <Link key={portal.href} href={portal.href} className="block">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{portal.title}</CardTitle>
                <CardDescription>{portal.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
