import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Triage Agent",
  description: "AI-powered medical triage system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
