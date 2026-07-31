/**
 * Ebook catalogue for the dashboard reader.
 *
 * The PDFs stay where they are — hosted on leuteriorealty.com — and are read
 * straight from that URL in an <iframe> using the browser's built-in PDF
 * viewer. That is the fastest option available: the file streams over a CDN we
 * don't pay for, the server sends `Accept-Ranges: bytes` so the browser pulls
 * pages on demand instead of the whole file up front, and there is no PDF
 * library in our bundle.
 *
 * Adding a book is one entry here. A new HOST additionally needs two entries in
 * next.config.mjs: the CSP `frame-src` allowlist (or the reader renders blank)
 * and `images.remotePatterns` (or the cover fails to load).
 */

export type Ebook = {
  /** URL-safe id, used as the React key. */
  id: string
  title: string
  /** Grouping label; each distinct value becomes a tab on the shelf. */
  category: string
  /** Absolute https URL to the PDF. */
  url: string
  description: string
  /** Cover override. Omit to use the .png sitting next to the PDF. */
  cover?: string
}

/**
 * Cover art for a book. The host stores each cover as a .png beside its PDF —
 * …/Success_as_a_Real_Estate_Agent_For_Dummies.pdf pairs with
 * …/Success_as_a_Real_Estate_Agent_For_Dummies.png — so the default is derived
 * rather than transcribed. Set `cover` on the entry to point elsewhere.
 */
export function ebookCoverUrl(book: Ebook): string {
  return book.cover ?? book.url.replace(/\.pdf$/i, ".png")
}

/** Tab order on the shelf. Categories not listed here are appended, sorted. */
export const CATEGORY_ORDER = [
  "Sales Person Training",
  "Rental",
  "Motivation",
  "Leadership",
  "Brokerage",
] as const

/** Distinct categories present in the catalogue, in CATEGORY_ORDER first. */
export function ebookCategories(books: Ebook[]): string[] {
  const present = Array.from(new Set(books.map((b) => b.category)))
  const ranked = present.filter((c) => (CATEGORY_ORDER as readonly string[]).includes(c))
  const rest = present.filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c)).sort()
  ranked.sort((a, b) => CATEGORY_ORDER.indexOf(a as never) - CATEGORY_ORDER.indexOf(b as never))
  return [...ranked, ...rest]
}

/**
 * Hosts allowed to be framed. Keep in sync with `frame-src` in
 * next.config.mjs — a host missing there loads as an empty viewer.
 */
export const EBOOK_FRAME_HOSTS = ["https://leuteriorealty.com"] as const

export const EBOOKS: Ebook[] = [
  {
    id: "1200-great-sales-tips",
    title: "1,200 Great Sales Tips for Real Estate Pros",
    category: "Sales Person Training",
    url: "https://leuteriorealty.com/ebook/sales%20person%20training/1200_Great_Sales_Tips_for_Real_Estate_Pros.pdf",
    description: "A working reference of practical selling tactics, objection handling and closing techniques.",
  },
  {
    id: "how-to-list-and-sell",
    title: "How to List and Sell Real Estate",
    category: "Sales Person Training",
    url: "https://leuteriorealty.com/ebook/sales%20person%20training/How_to_List_and_Sell_Real_Estate_30th_Anniversary_Edition.pdf",
    description: "Danielle Kennedy's 30th anniversary edition on dominating every turn of the market.",
  },
  {
    id: "success-as-an-agent-for-dummies",
    title: "Success as a Real Estate Agent For Dummies",
    category: "Sales Person Training",
    url: "https://leuteriorealty.com/ebook/sales%20person%20training/Success_as_a_Real_Estate_Agent_For_Dummies.pdf",
    description: "Build a personal brand, market yourself online and close more deals, start to finish.",
  },
  {
    id: "real-estate-marketing",
    title: "Real Estate Marketing",
    category: "Rental",
    url: "https://leuteriorealty.com/ebook/rental/REAL_ESTATE_MARKETING.pdf",
    description: "Marketing fundamentals for listing and filling rental properties.",
  },
  {
    id: "the-digital-real-estate-agent",
    title: "The Digital Real Estate Agent",
    category: "Rental",
    url: "https://leuteriorealty.com/ebook/rental/The_Digital_Real_Estate_Agent.pdf",
    description: "Building an online presence that brings in leads and listings.",
  },
  {
    id: "100-ways-to-motivate-others",
    title: "100 Ways to Motivate Others",
    category: "Motivation",
    url: "https://leuteriorealty.com/ebook/motivation/100_Ways_to_Motivate_Others.pdf",
    description: "Steve Chandler on how great leaders get insane results without driving people crazy.",
  },
  {
    id: "the-book-of-yes",
    title: "The Book of YES",
    category: "Motivation",
    url: "https://leuteriorealty.com/ebook/motivation/The_Book_of_YES_The_Ultimate_Real_Estate_Agent_Conversation_Guide.pdf",
    description: "Kevin Ward's scripts — the ultimate real estate agent conversation guide.",
  },
  {
    id: "trump-strategies-for-real-estate",
    title: "Trump Strategies for Real Estate",
    category: "Motivation",
    url: "https://leuteriorealty.com/ebook/motivation/Trump_Strategies_For_Real_Estate.pdf",
    description: "George H. Ross on billionaire lessons applied by the small investor.",
  },
  {
    id: "the-real-book-of-real-estate",
    title: "The Real Book of Real Estate",
    category: "Leadership",
    url: "https://leuteriorealty.com/ebook/leadership/Robert_Kiyosaki_the_Real_Book_of_Real_Estate.pdf",
    description: "Robert Kiyosaki gathers real experts on the deals, teams and risks behind big portfolios.",
  },
  {
    id: "the-new-masters-of-real-estate",
    title: "The New Masters of Real Estate",
    category: "Leadership",
    url: "https://leuteriorealty.com/ebook/leadership/The_New_Masters_of_Real_Estate.pdf",
    description: "How a new generation of operators is building wealth in property.",
  },
  {
    id: "how-successful-people-think",
    title: "How Successful People Think",
    category: "Leadership",
    url: "https://leuteriorealty.com/ebook/leadership/how_successful_people_think_change_your_thinking_change_your_life.pdf",
    description: "John C. Maxwell on changing your thinking to change your life.",
  },
  {
    id: "napoleon-hill-golden-rules",
    title: "Napoleon Hill's Golden Rules",
    category: "Leadership",
    url: "https://leuteriorealty.com/ebook/leadership/napoleon_hill_golden_rules_the_lost_writings.pdf",
    description: "The lost writings — the foundations behind Think and Grow Rich.",
  },
  {
    id: "marketing-real-estate-digital-age",
    title: "Marketing Real Estate in the Digital Age",
    category: "Brokerage",
    url: "https://leuteriorealty.com/ebook/brokerage/Marketing_Real_Estate_in_the_Digital_Age.pdf",
    description: "Taking a brokerage's marketing online — channels, content and conversion.",
  },
  {
    id: "staging-to-sell",
    title: "Staging to Sell",
    category: "Brokerage",
    url: "https://leuteriorealty.com/ebook/brokerage/Staging_to_Sell_The_Secret_to_Selling_Homes_in_a_Down_Market.pdf",
    description: "The secret to selling homes in a down market.",
  },
  {
    id: "agents-guide-to-fsbos",
    title: "The Real Estate Agent's Guide to FSBOs",
    category: "Brokerage",
    url: "https://leuteriorealty.com/ebook/brokerage/The_Real_Estate_Agents_Guide_to_FSBOs_Make_Big_Money_Prospecting_For_Sale_By_Owner_Properties.pdf",
    description: "Prospecting For Sale By Owner properties and converting them into listings.",
  },
]

/** The file name a download should use, derived from the URL. */
export function ebookFileName(book: Ebook): string {
  try {
    const last = new URL(book.url).pathname.split("/").pop() ?? ""
    return decodeURIComponent(last) || `${book.id}.pdf`
  } catch {
    return `${book.id}.pdf`
  }
}
