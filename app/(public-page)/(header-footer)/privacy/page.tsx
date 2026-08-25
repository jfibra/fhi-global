import type { Metadata } from "next"
import { createPageMetadata } from "@/lib/seo"
import { LegalPage } from "@/components/public/legal-page"

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "How FHI Global Property collects, uses and protects your personal information — enquiries, accounts, cookies and your rights.",
  pathname: "/privacy",
  keywords: ["FHI Global privacy policy"],
})

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="25 August 2026"
      intro="FHI Global Property (“FHI Global”, “we”, “us”) is a Dubai-based real estate brokerage operating fhiglobal.ae. This policy explains what personal information we collect, why we collect it, and the choices you have. We keep it in plain language on purpose."
      sections={[
        {
          heading: "What we collect",
          bullets: [
            "Contact details you submit through our forms — your name, email address, phone or WhatsApp number, and the message or enquiry you send.",
            "Account details if you register on the platform — your name, contact information and profile data you provide.",
            "Property preferences you share with our consultants, such as budget, preferred areas and purpose (living or investment).",
            "Technical usage data — device type, pages visited and general location — collected through cookies and analytics to understand how the site is used.",
          ],
        },
        {
          heading: "How we use your information",
          bullets: [
            "To respond to your enquiries and connect you with the consultant, listing agent or developer relevant to the property you asked about.",
            "To operate your account and provide the services you request.",
            "To send you information you asked for — such as project details, availability and payment plans.",
            "To improve the website and our services, using aggregated, non-identifying analytics.",
            "To comply with legal and regulatory obligations that apply to real estate brokerages in the UAE.",
          ],
        },
        {
          heading: "When we share information",
          paragraphs: [
            "We share your details only where it serves your request or the law requires it — with the developer or listing agent of a property you enquired about, and with the service providers who run our infrastructure (hosting, email delivery, analytics) under confidentiality obligations.",
            "We do not sell your personal information, and we do not share it with third parties for their own marketing.",
          ],
        },
        {
          heading: "Storage and security",
          paragraphs: [
            "Your information is stored on secured infrastructure with access controls, encryption in transit, and role-based permissions inside our team. We retain personal information only as long as needed for the purposes above or as UAE law requires, then delete or anonymise it.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "You may request access to the personal information we hold about you, ask us to correct it, or ask us to delete it where we have no continuing legal basis to keep it. To exercise any of these rights, email info@fhiglobal.ae from the address you used with us — we respond within one business day.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "The site uses essential cookies to keep you signed in and remember your preferences, and analytics cookies to understand site usage. See our Cookie Policy for the full picture and how to control them in your browser.",
          ],
        },
        {
          heading: "Changes to this policy",
          paragraphs: [
            "If we change this policy, we will update it here with a new effective date. Material changes will be highlighted on the site.",
          ],
        },
      ]}
    />
  )
}
