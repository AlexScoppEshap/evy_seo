import document from "@/content/legal/support.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("support", document.title);
export default function Page() { return <LegalPage slug="support" document={document}/>; }
