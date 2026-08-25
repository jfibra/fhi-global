import type { Metadata } from "next"
import { createPageMetadata } from "@/lib/seo"
import { LegalPage } from "@/components/public/legal-page"

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service",
  description:
    "The terms that govern your use of fhiglobal.ae — property information, accounts, intellectual property and liability.",
  pathname: "/terms",
  keywords: ["FHI Global terms of service"],
})

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effective="25 August 2026"
      intro="These terms govern your use of fhiglobal.ae, operated by FHI Global Property, a real estate brokerage based in Dubai, United Arab Emirates. By using the site you agree to them — they are short and fair, so please read them."
      sections={[
        {
          heading: "What this site is",
          paragraphs: [
            "fhiglobal.ae is a property information and brokerage platform: we present projects, listings and market information from developers and agents we work with, and we connect you with our consultants when you enquire.",
            "Content on the site is informational and does not constitute an offer capable of acceptance, nor legal, financial or investment advice. Property decisions should be made with your own advisers.",
          ],
        },
        {
          heading: "Prices and availability",
          paragraphs: [
            "Prices, payment plans, availability, handover dates and other project details originate from developers and are subject to change without notice. We keep the site current in good faith, but the developer's own documentation — and ultimately the signed contract — always prevails over anything shown here.",
          ],
        },
        {
          heading: "Accounts",
          bullets: [
            "Information you provide when registering must be accurate and kept up to date.",
            "You are responsible for keeping your credentials confidential and for activity under your account.",
            "We may suspend or close accounts used fraudulently, abusively, or in breach of these terms.",
          ],
        },
        {
          heading: "Intellectual property",
          paragraphs: [
            "The FHI Global name, logo, site design and original content belong to us. Project imagery, logos and marketing materials belong to their respective developers and are shown with permission. You may not scrape, republish or commercially exploit site content without written consent.",
          ],
        },
        {
          heading: "Third-party links and content",
          paragraphs: [
            "The site links to third-party websites (developers, news sources, maps). We are not responsible for their content or practices — their own terms and policies apply there.",
          ],
        },
        {
          heading: "Liability",
          paragraphs: [
            "To the maximum extent permitted by law, FHI Global is not liable for indirect or consequential losses arising from use of the site or reliance on information shown on it. Nothing in these terms excludes liability that cannot be excluded under UAE law.",
          ],
        },
        {
          heading: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai, and disputes are subject to the jurisdiction of the Dubai courts.",
          ],
        },
        {
          heading: "Changes",
          paragraphs: [
            "We may update these terms from time to time; the version on this page with the latest effective date is the one in force. Continued use of the site after an update means you accept the revised terms.",
          ],
        },
      ]}
    />
  )
}
