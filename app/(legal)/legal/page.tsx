import document from "@/content/legal/legal.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("legal", document.title);
export default function Page() { return <LegalPage slug="legal" document={document}/>; }
