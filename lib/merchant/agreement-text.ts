import {
  AGENT_INCENTIVE_AED,
  MERCHANT_AGREEMENT_MONTHS,
  MERCHANT_CLAWBACK_DAYS,
  MERCHANT_INCENTIVE_AED,
  MERCHANT_PAY_DAY,
} from "@/lib/merchant/rules"

/**
 * The Merchant Partnership Agreement's clauses, written from the Merchant
 * Partnership Proposal 2026–2027 (what each side provides, the commercial
 * terms, the other terms) in the plain style of the Business Development
 * Officer Agreement. Rendered by lib/merchant/agreement.ts into the PDF the
 * merchant signs on screen or downloads to sign.
 *
 * It is a DRAFT until a UAE-licensed lawyer has reviewed it; the PDF says so
 * on every page. Change the words here, never in the renderer.
 */

export const AGREEMENT_TITLE = "Merchant Partnership Agreement"
export const AGREEMENT_DRAFT_NOTE = "DRAFT - to be reviewed by a UAE-licensed lawyer before signing"

export type AgreementClause = { title: string; plain: string; paragraphs: string[] }

const ordinal = (d: number) => `${d}${d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th"}`

export const AGREEMENT_BACKGROUND = [
  `RentSouq operates rentsouq.ae, an online platform where people in the UAE browse and rent properties directly. It is run by FHI Global Property LLC in partnership with MCG Properties LLC (together "RentSouq", "we" or "us").`,
  `The Merchant is a business with its own customers. Under this Agreement the Merchant shares rentsouq.ae with those customers through a unique QR code and earns a reward for every rental that results. The parties agree as follows.`,
]

export const AGREEMENT_CLAUSES: AgreementClause[] = [
  {
    title: "1. Words we use",
    plain: "The few terms this Agreement turns on.",
    paragraphs: [
      `1.1 Merchant QR Code means the unique, trackable QR code RentSouq issues to the Merchant under this Agreement, and the tracked link behind it.`,
      `1.2 Closed Deal means a property listed on the Platform that is rented by a person who reached the Platform by scanning the Merchant QR Code (or using its tracked link), where the tenancy contract is signed and the first rent payment is received. One property counts once.`,
      `1.3 Merchant Incentive means AED ${MERCHANT_INCENTIVE_AED} for each Closed Deal.`,
      `1.4 Voucher means the discount the Merchant gives each customer who rents through the Merchant QR Code, redeemed directly with the Merchant.`,
      `1.5 RentSouq's records means the tracking data and the merchant dashboard of the Platform.`,
    ],
  },
  {
    title: "2. How long it lasts",
    plain: `${MERCHANT_AGREEMENT_MONTHS} months from the start date. It renews only in writing.`,
    paragraphs: [
      `2.1 This Agreement starts on the start date written on the first page and runs for ${MERCHANT_AGREEMENT_MONTHS} months. It renews only by a written agreement signed by both parties before the end date; it does not renew automatically.`,
    ],
  },
  {
    title: "3. What RentSouq provides",
    plain: "The QR code, the printed materials, the tracking, the promotion and the reward.",
    paragraphs: [
      `3.1 A unique trackable Merchant QR Code, a flyer and a roll-up banner design carrying it.`,
      `3.2 Scan and rental tracking, and a merchant dashboard showing the scans, the Closed Deals and the Merchant Incentive due.`,
      `3.3 Twice a month, a post featuring the Merchant's products and services on the rentsouq.ae social media pages, website and email blast.`,
      `3.4 The Merchant Incentive for every Closed Deal, paid under clause 6.`,
    ],
  },
  {
    title: "4. What the Merchant provides",
    plain: "Show the QR code, hand it out, post it, and honour the voucher.",
    paragraphs: [
      `4.1 Display the Merchant QR Code on the flyer or roll-up banner in its store, office or shop, and have its staff hand it out to customers.`,
      `4.2 Twice a month, display or post the Merchant QR Code on its website, social media pages and email blast, where it has them.`,
      `4.3 Give each customer who rents through the Merchant QR Code the Voucher written on the first page, and honour it when presented. MCG Properties LLC and FHI Global Property LLC purchase the Vouchers at the maximum discount the Merchant can provide.`,
      `4.4 Use RentSouq's names, logos and materials only as supplied and only for this programme; never create look-alike codes, pages or accounts.`,
    ],
  },
  {
    title: "5. Tracking and records",
    plain: "The Platform's records say what was scanned and what was rented.",
    paragraphs: [
      `5.1 The Merchant accepts RentSouq's records as the primary evidence of scans and Closed Deals, unless clearly shown to be wrong.`,
      `5.2 Each month the Merchant's closed deal report and the Merchant Incentive due appear in the merchant dashboard. The Merchant may question any entry within 15 days; the parties then review the records together in good faith, and undisputed amounts are paid on time.`,
      `5.3 RentSouq does not give the Merchant tenants' or landlords' personal details, and the Merchant collects none. Each party handles personal data only as the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) allows.`,
    ],
  },
  {
    title: "6. Payment",
    plain: `AED ${MERCHANT_INCENTIVE_AED} per Closed Deal, paid on the ${ordinal(MERCHANT_PAY_DAY)} of the following month.`,
    paragraphs: [
      `6.1 RentSouq pays the Merchant Incentive on the ${ordinal(MERCHANT_PAY_DAY)} day of the following month (or the next working day) for the Closed Deals of the preceding calendar month, by bank transfer to the account written on the first page.`,
      `6.2 If a tenancy is cancelled or the rent refunded within ${MERCHANT_CLAWBACK_DAYS} days, the Merchant Incentive for that unit is not due, or may be deducted from a later payment.`,
      `6.3 No Merchant Incentive is due on rentals not recorded through the Merchant QR Code, on rentals by the Merchant, its owners or staff for themselves, or on rentals created by fraud, fake scans or misuse.`,
      `6.4 Amounts exclude VAT unless the first page says otherwise. A VAT-registered Merchant issues valid tax invoices under UAE VAT law. Each party bears its own taxes.`,
    ],
  },
  {
    title: "7. What this relationship is, and is not",
    plain: "A marketing partnership. Neither side is the other's agent, broker or employee.",
    paragraphs: [
      `7.1 The Merchant is a channel marketing partner. It is not an agent, broker, partner or employee of RentSouq and may not advertise, negotiate or arrange specific property rentals, collect money from tenants or landlords, or speak for RentSouq beyond the approved materials.`,
      `7.2 The arrangement is non-exclusive for both sides. RentSouq works with other merchants and the Merchant may run other programmes, as long as it does not pass the Merchant QR Code or RentSouq's materials to a competing property rental platform. The agent who introduced the Merchant earns a separate incentive of AED ${AGENT_INCENTIVE_AED} per Closed Deal from RentSouq; it does not reduce the Merchant Incentive.`,
    ],
  },
  {
    title: "8. Confidentiality",
    plain: "Keep the terms and the Platform's information private.",
    paragraphs: [
      `8.1 Each party keeps the other's non-public information, including these terms, the tracking data and customer information, confidential during the Term and for 3 years after it, uses it only for this Agreement, and returns or deletes it on request. This does not cover information that is public without a breach or lawfully known from elsewhere.`,
    ],
  },
  {
    title: "9. Ending the Agreement early",
    plain: "Either side may leave with 30 days' notice; serious problems allow an immediate exit.",
    paragraphs: [
      `9.1 Either party may end this Agreement for convenience by 30 days' written notice.`,
      `9.2 Either party may end it by written notice if the other commits a material breach and does not fix it within 15 days of written notice. RentSouq may end it immediately if the Merchant creates fake scans or self-referrals, misuses the Merchant QR Code or RentSouq's brand, or loses its trade licence.`,
      `9.3 On ending, RentSouq pays the Merchant Incentive earned up to the end date, the Merchant stops using the Merchant QR Code and RentSouq's materials within 7 days, and clauses 5, 6 (for amounts owed) and 8 continue to apply.`,
    ],
  },
  {
    title: "10. Liability",
    plain: "No promised number of rentals; each side answers for its own conduct.",
    paragraphs: [
      `10.1 RentSouq does not promise any number of scans, rentals or earnings; any example figures are illustrations only. Each party is responsible for loss it causes the other through breach of this Agreement, fraud or unlawful acts. Except for fraud or a breach of clause 8, each party's total liability is limited to the Merchant Incentives paid or due in the 12 months before the claim.`,
    ],
  },
  {
    title: "11. Governing law and disputes",
    plain: "Dubai law. We talk first.",
    paragraphs: [
      `11.1 This Agreement is governed by the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates applicable in it. The parties first try to settle any dispute by friendly discussion for 30 days after written notice; if not settled, the courts of Dubai have exclusive jurisdiction.`,
      `11.2 This Agreement is written in English and may be signed in counterparts and electronically under UAE electronic transactions law. FHI Global Property LLC and MCG Properties LLC each give the promises made by "RentSouq".`,
    ],
  },
]
