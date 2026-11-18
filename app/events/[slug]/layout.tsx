import type { Metadata } from "next";
import { manrope } from "@/app/brand-font";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Evy",
  description: "Discover events with Evy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
