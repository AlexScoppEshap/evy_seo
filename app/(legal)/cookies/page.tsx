import document from "@/content/legal/cookies.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("cookies", document.title);
export default function Page() { return <LegalPage slug="cookies" document={document}/>; }
