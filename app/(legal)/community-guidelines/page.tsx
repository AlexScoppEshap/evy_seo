import document from "@/content/legal/community-guidelines.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("community-guidelines", document.title);
export default function Page() { return <LegalPage slug="community-guidelines" document={document}/>; }
