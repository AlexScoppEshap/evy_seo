import document from "@/content/legal/terms.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("terms", document.title);
export default function Page() { return <LegalPage slug="terms" document={document}/>; }
