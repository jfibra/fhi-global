/**
 * What a listing needs before it may go live.
 *
 * Agents create and publish their own listings straight from the browser
 * (lib/agent-listings-service.ts, under RLS), and new listings used to default
 * to "published" — so a test record, "/listings/luxury" (linked to a test
 * project, AED 100–500M, 120,000 sq ft), reached the public site and the
 * sitemap. These checks run where a publish is requested: the agent form, the
 * row "Publish" action, and the admin PATCH route. They are advisory against a
 * determined direct write to the database (that would need a trigger — see the
 * optional migration in the SEO plan), but they stop the everyday mistakes.
 *
 * Pure and dependency-free so the browser and the server share one rule set.
 */

export type ListingPublishInput = {
  title: string
  description: string | null | undefined
  listingKind: "sale" | "rent"
  /** The listing links a developer project (photos and price are inherited from it). */
  hasProject: boolean
  /** The linked project's name — a listing on "Test IT purposes" is test data whatever its own title says. */
  projectName?: string | null
  /**
   * The linked project is public (published, active, not deleted). `false` = a retired project: the public page
   * then shows the listing with no photos or price. Leave undefined when it is not known (treated as live).
   */
  projectLive?: boolean
  /** Photos uploaded to the listing itself. */
  ownPhotoCount: number
  /** The linked project has at least one photo. Ignored without a project. */
  projectHasPhoto?: boolean
  /** The listing's own price, when it has one (standalone listings only). */
  price?: number | null
}

export type ListingIssue = { field: "title" | "description" | "photos" | "price" | "project"; message: string }

/** Words that mark a record as a placeholder rather than a real property. */
export const PLACEHOLDER_WORDS = /\b(test|testing|demo|sample|dummy|placeholder|lorem)\b/i

/** The three flags that decide whether a project's page is public (null/undefined = not recorded). */
export type ProjectLiveFlags = { is_published?: boolean | null; is_active?: boolean | null; deleted_at?: string | null }

/**
 * Whether a listing's linked project is still public. The same rule the public listing reader applies
 * (lib/buy/agent-listings-public.ts withLiveProject): a flag that was not recorded counts as live, so a row
 * read without the flags is never misjudged. A project that could not be read at all is not live — callers
 * check that the listing links a project (project_id) before asking.
 */
export function isLiveProject(project: ProjectLiveFlags | null | undefined): boolean {
  if (!project) return false
  return project.is_published !== false && project.is_active !== false && !project.deleted_at
}

/**
 * A record that is test data rather than a property: placeholder wording in its TITLE or in the NAME of the
 * project it links. Deliberately not the description — real adverts say "sample flat" or "demo unit" — and
 * judged on the RAW row, before a retired project is dropped from it (the junk listing "/listings/luxury" is
 * titled "luxury"; its only giveaway is the project name "Test IT purposes").
 */
export function isTestRecord(input: { title?: string | null; projectName?: string | null }): boolean {
  return PLACEHOLDER_WORDS.test(input.title ?? "") || PLACEHOLDER_WORDS.test(input.projectName ?? "")
}

/** A description shorter than this is a stub, not an advertisement. */
export const MIN_LISTING_DESCRIPTION = 120

// AED bands outside which a price is a typo or a placeholder (the test listing carried AED 100M–500M for a studio).
const SALE_PRICE_BAND = { min: 50_000, max: 1_000_000_000 }
const RENT_PRICE_BAND = { min: 5_000, max: 10_000_000 }

const aed = (n: number) => `AED ${n.toLocaleString("en-AE")}`

export function listingPublishIssues(input: ListingPublishInput): ListingIssue[] {
  const issues: ListingIssue[] = []
  const title = input.title.trim()
  const description = (input.description ?? "").trim()

  if (PLACEHOLDER_WORDS.test(title)) {
    issues.push({ field: "title", message: "Remove placeholder wording (“test”, “demo”, “sample”, …) from the title." })
  }
  // Only the unmistakable filler blocks a description: real adverts say "sample flat" and "demo unit".
  // (Placeholder wording in a description is reported by the Data Health check, never enforced here.)
  if (/\blorem\b/i.test(description)) {
    issues.push({ field: "description", message: "Replace the placeholder text in the description." })
  }

  if (input.hasProject && PLACEHOLDER_WORDS.test(input.projectName ?? "")) {
    issues.push({ field: "project", message: "The linked project looks like test data — pick a real project." })
  } else if (input.hasProject && input.projectLive === false) {
    issues.push({
      field: "project",
      message: "The linked project is not public, so this listing would show no photos or price — publish the project or unlink it.",
    })
  }

  if (description.length < MIN_LISTING_DESCRIPTION) {
    issues.push({
      field: "description",
      message: `Write a description of at least ${MIN_LISTING_DESCRIPTION} characters (now ${description.length}).`,
    })
  }

  // The project's photo counts only while the project is public — the rendered page drops a retired project's
  // photos, and the gate must agree with the page.
  const photos = input.ownPhotoCount + (input.hasProject && input.projectHasPhoto && input.projectLive !== false ? 1 : 0)
  if (photos < 1) {
    issues.push({ field: "photos", message: "Add at least one photo." })
  }

  if (!input.hasProject && input.price != null) {
    const band = input.listingKind === "rent" ? RENT_PRICE_BAND : SALE_PRICE_BAND
    if (input.price < band.min || input.price > band.max) {
      issues.push({
        field: "price",
        message: `The price looks wrong for a ${input.listingKind === "rent" ? "rental" : "sale"} (expected ${aed(band.min)}–${aed(band.max)}).`,
      })
    }
  }

  return issues
}

/** "Can't publish yet: …" — one line for a toast or an API error. */
export function listingIssuesMessage(issues: ListingIssue[]): string {
  return `Can't publish yet: ${issues.map((i) => i.message).join(" ")}`
}
