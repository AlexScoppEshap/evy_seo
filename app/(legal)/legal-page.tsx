import { productionIndexingEnabled } from "@/lib/seo-launch";
import type { Metadata } from "next";
import { Header, Footer } from "@/app/components/marketing/site-shell";
import { getDictionary } from "@/lib/i18n/dictionaries";
export function legalMetadata(slug: string, title: string): Metadata {
  return { title: `${title} | Evy`, description: `${title} — Evy. Published information in English.`,
    alternates: { canonical: `https://myevy.app/${slug}/` },
    robots: { index: productionIndexingEnabled(), follow: true } };
}
export default async function LegalPage({slug, document}: {slug: string; document: {title: string; html: string}}) {
  const d = await getDictionary("en");
  return <div className="marketing-site"><Header locale="en" page="home" d={d}/>
    <main id="main" tabIndex={-1} className="legal-page container">
      <aside className="legal-language" aria-label="Content language">
        <p lang="en">This page uses the existing published English content. Verified translations are not available. The language menu opens the marketing website.</p>
        <details><summary>Français · Deutsch · Italiano · Español</summary>
          <p lang="fr">Cette page reprend le contenu publié en anglais. Aucune traduction vérifiée n’est disponible. Le menu des langues ouvre le site marketing.</p>
          <p lang="de">Diese Seite enthält die bestehenden veröffentlichten englischen Inhalte. Geprüfte Übersetzungen sind nicht verfügbar. Das Sprachmenü öffnet die Marketing-Website.</p>
          <p lang="it">Questa pagina riporta i contenuti esistenti pubblicati in inglese. Non sono disponibili traduzioni verificate. Il menu delle lingue apre il sito di presentazione.</p>
          <p lang="es">Esta página conserva el contenido existente publicado en inglés. No hay traducciones verificadas disponibles. El menú de idiomas abre el sitio de presentación.</p>
        </details>
      </aside>
      <article className="legal-document" aria-label={document.title} dangerouslySetInnerHTML={{__html: document.html}}/>
      {slug === "contact-us" && <section className="legal-contact" aria-labelledby="email-contact"><h2 id="email-contact">Contact by email</h2>
        <p>The website contact form is not available here yet. Please email us directly.</p>
        <a className="button" href="mailto:info@myevy.app">Email info@myevy.app</a>
      </section>}
    </main><Footer locale="en" page="home" d={d}/></div>;
}
