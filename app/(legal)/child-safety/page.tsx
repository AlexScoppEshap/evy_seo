import document from "@/content/legal/child-safety.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("child-safety", document.title);
export default function Page() { return <LegalPage slug="child-safety" document={document}/>; }
