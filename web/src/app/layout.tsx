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
      <body className="font-sans bg-[#eef1f7] h-screen flex justify-center items-stretch m-0 p-0 antialiased text-gray-900">
        {children}
      </body>
    </html>
  );
}
