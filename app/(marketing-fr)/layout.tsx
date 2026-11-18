import { manrope } from "@/app/brand-font";
import "@/app/globals.css";
import "@/app/marketing.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
