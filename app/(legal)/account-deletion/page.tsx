import document from "@/content/legal/account-deletion.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("account-deletion", document.title);
export default function Page() { return <LegalPage slug="account-deletion" document={document}/>; }
