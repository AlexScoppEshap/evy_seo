import document from "@/content/legal/privacy.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("privacy", document.title);
export default function Page() { return <LegalPage slug="privacy" document={document}/>; }
