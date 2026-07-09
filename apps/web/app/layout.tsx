import type { ReactNode } from "react";

export const metadata = {
  title: "Verro",
  description: "Broker identity, verification, and compliance platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
