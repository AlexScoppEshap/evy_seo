import document from "@/content/legal/contact-us.json";
import LegalPage, { legalMetadata } from "../legal-page";
export const metadata = legalMetadata("contact-us", document.title);
export default function Page() { return <LegalPage slug="contact-us" document={document}/>; }
