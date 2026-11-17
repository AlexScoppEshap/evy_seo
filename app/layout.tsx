import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: [
    { path: './fonts/Manrope-Regular.ttf', weight: '400' },
    { path: './fonts/Manrope-Medium.ttf', weight: '500' },
    { path: './fonts/Manrope-SemiBold.ttf', weight: '600' },
    { path: './fonts/Manrope-Bold.ttf', weight: '700' },
    { path: './fonts/Manrope-ExtraBold.ttf', weight: '800 900' },
  ],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: "Evy",
  description: "Discover events with Evy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
