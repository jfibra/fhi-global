/**
 * Buyer FAQs shown on the homepage and published as FAQPage structured data,
 * which is what lets Google expand them under our result.
 *
 * These answer the questions overseas buyers actually ask before they enquire.
 * Figures (fees, visa thresholds) are the published DLD/ICP rules at the time
 * of writing — confirm them before relying on them in a transaction, and keep
 * the wording here in step if they change.
 */

export type Faq = { question: string; answer: string }

export const HOME_FAQS: Faq[] = [
  {
    question: "Can foreigners buy property in Dubai?",
    answer:
      "Yes. Foreign nationals can buy freehold property in Dubai's designated freehold areas — which covers most of the communities investors know, including Dubai Marina, Downtown, Business Bay, JVC and Dubai Creek Harbour. You own the property outright, in your own name, and there is no requirement to live in the UAE or hold residency first.",
  },
  {
    question: "What does buying off-plan actually mean?",
    answer:
      "Off-plan means buying before the building is finished — usually at launch, when prices are lowest. You pay in instalments tied to construction milestones rather than all at once, the developer builds, and you take handover on completion. It is the most common way investors enter the Dubai market because the entry cost is spread out and the choice of units is widest.",
  },
  {
    question: "How much do I need to pay upfront?",
    answer:
      "On a typical off-plan launch the first payment is a booking deposit of around 10–20% of the price, with the balance spread across the payment plan. On top of the price you should budget for the Dubai Land Department transfer fee of 4% plus administrative charges. Payment plans differ from project to project, so the specific schedule is shown on each project page.",
  },
  {
    question: "Does buying property in Dubai give me residency?",
    answer:
      "It can. Property investment is one of the routes to a UAE residence visa: currently a property worth AED 750,000 or more can support a renewable investor visa, and AED 2 million or more can qualify for the 10-year Golden Visa. Eligibility depends on the property and your circumstances, so treat this as a starting point and confirm the current rules with us before you buy for that purpose.",
  },
  {
    question: "Is there property tax or income tax in Dubai?",
    answer:
      "There is no annual property tax in Dubai and no personal income tax in the UAE, so rental income is not taxed locally. The main government cost is the one-off 4% Dubai Land Department transfer fee at purchase. You may still owe tax in your country of residence, so check your own position at home.",
  },
  {
    question: "What rental returns can I expect?",
    answer:
      "Gross rental yields in Dubai typically run in the region of 5–8%, which is high compared with most major global cities, though the figure varies considerably by community, building and unit type. Short-term holiday lets can return more but carry higher running costs. We are happy to run the numbers for any specific project you are considering.",
  },
  {
    question: "Can I buy from abroad without flying to Dubai?",
    answer:
      "Yes. The whole purchase can be completed remotely — documents are signed digitally, payments are made by international transfer, and where a physical signature is needed a power of attorney can cover it. We handle the developer paperwork and keep you updated through construction, and many of our clients see the property for the first time at handover.",
  },
  {
    question: "What does FHI Global charge buyers?",
    answer:
      "Nothing. We work directly with the developers, so the prices and payment plans you see are the developer's own, with no mark-up, and our commission is paid by the developer rather than by you. Consultations, shortlists and project comparisons cost you nothing.",
  },
]

/** FAQPage structured data — Google uses this to expand answers in results. */
export function faqPageSchema(faqs: Faq[] = HOME_FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }
}
