import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Procura — Procurement",
  description:
    "Purchase requests, vendor assignment, purchase orders, payments, deliveries, and inventory in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
