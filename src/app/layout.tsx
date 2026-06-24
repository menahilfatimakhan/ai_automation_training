import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEW SZN — Agency Performance Dashboard",
  description: "Multi-tenant analytics + workflow for a digital marketing agency.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
