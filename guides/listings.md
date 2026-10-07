# Agent listings (`agent_listings`)

Agents post sale and rent listings from the dashboard (`features/dashboard/listings/`). A listing is either
**linked to a developer project** (`project_id`; location, photos, price range and unit facts are inherited from
the project) or **standalone**. The public page is `/listings/<slug>`; `/listings/<uuid>` is the legacy link.
Listings also appear on `/buy` and `/rent`, on the developer page ("On the market now") and on agents' own
sites (`/website/<slug>`).

## Schema (migrations 002, 004, 005, 006, 013, 019)

| Column | Notes |
|---|---|
| `id` uuid | primary key |
| `agent_id` | owner (`profiles.id`, cascade) |
| `project_id` | optional link to `projects.id` (`ON DELETE SET NULL`) |
| `title`, `description` | free text |
| `listing_kind` | `sale` \| `rent` |
| `price`, `currency` | only standalone listings have a price of their own; a linked listing shows the project's |
| `status` | `draft` \| `published` \| `archived` (CHECK) — **new listings start as `draft`** |
| `unit_type` (005) | matched against the project's `unit_type` rows for beds/baths/size |
| `og_card_options` (006) | saved share-card customisation |
| `slug` (013) | generated from the title by a BEFORE INSERT trigger; stable across title edits |
| `is_featured` (019) | agent-chosen highlight |
| `created_at`, `updated_at`, `deleted_at` | soft delete via `deleted_at` |

`agent_listing_images` holds the listing's own photos (a linked listing also shows the project's gallery).

### Slugs
`agent_listings_set_slug()` lowercases the title to `a-z0-9-` (80 chars). A taken slug gets an id fragment
(`azizi-venice-d35c`), so **the clean slug belongs to the oldest listing with that title**; later copies are
duplicates competing for the same query. A listing with no usable title characters is served at its uuid.

### RLS
- Owner can select/update their own rows **only while `deleted_at IS NULL`** — no policy shows a soft-deleted row
  to its owner. Anything that must see a deleted row (purging its page, announcing the removal) runs on the
  service role after checking `agent_id` explicitly (`app/api/seo/revalidate`, `app/api/admin/listings/[id]`).
- Staff (`super_admin`, `admin`) can read all live rows; the public (anon) can read `published`, not deleted.
- Agents write from the browser (`lib/agent-listings-service.ts`, browser client under RLS), so a database-side
  rule is the only one an agent cannot bypass. Today's rules are checked where a publish is **requested** (below).

## What may be public

One predicate family lives in `lib/listing-publish-checks.ts` (pure, shared by browser and server):

- **`isTestRecord({ title, projectName })`** — placeholder wording (`test`, `demo`, `sample`, `dummy`,
  `placeholder`, `lorem`, whole words) in the **title** or in the **name of the linked project**. Not the
  description (real adverts say "sample flat"). Judged on the *raw* row, before a retired project is dropped from
  it — the junk record `/listings/luxury` is titled just "luxury"; its only giveaway is the project
  "Test IT purposes".
- **`isLiveProject(project)`** — the linked project is published, active and not deleted (a flag that was not
  read counts as live).

Where they apply:

| Surface | Test record | Linked project retired |
|---|---|---|
| `/listings/<slug>` (`fetchPublicAgentListingById`) | **404** | page renders without the project's price/photos, `noindex,follow` |
| `/buy`, `/rent` (`fetchPublishedAgentListings`) | hidden | card shows without the project's facts |
| sitemap listings shard (`lib/sitemap-sections.ts`) | omitted | omitted (a noindex URL must not be listed) |
| developer page "On the market now" | hidden | n/a (lists only live projects) |
| agent sites (`fetchListingCards`) | hidden | card shows without the project's facts |
| FHI Assistant `data_health` | listed under `looks_like_test_data` | listed under `linked_project_not_live` |

## Publish checklist (`listingPublishIssues`)

Runs on a **transition to published** — the agent form (create-as-published, edit-to-published), the row
"Publish" action, and the admin PATCH (`app/api/admin/listings/[id]`, 422 with the issue list; admins get no
override and can still save as Draft):

- title has no placeholder wording; description has no `lorem` filler and is at least 120 characters
- at least one photo (own, or the linked project's **while that project is public**)
- a linked project must not look like test data and must be public
- standalone price inside AED 50k–1B (sale) / 5k–10M (rent)

A listing that is **already live** is never held to the checklist (routine edits must go through), with one
exception: the admin PATCH refuses a rename *into* test wording (`That title looks like test data`).

## Removal and revalidation

Every change that can alter a public page purges it; a change that put a page on the site or took it off also
tells IndexNow.

- **Agent actions** (browser): `setAgentListingStatus`, `softDeleteAgentListing` and a save from the form ping
  `POST /api/seo/revalidate` via `lib/seo-ping.ts` (`removed: true` for Draft/Archived/Delete).
- **Admin actions**: `app/api/admin/listings/[id]` purges itself (`purgeListing`) — slug page, uuid page, `/buy`,
  `/rent`, tag `agent-listings` — and announces when the row is or just was published.
- The route purges always, but touches IndexNow and the cached lists only when the page is public or was just
  removed (`announce = isPublic || removed`; a deleted row that was published counts as removed whatever the
  caller said). A draft that was never online is never submitted — dozens of 404 URLs is what gets an IndexNow
  key rate-limited.

## Ops runbook — retiring a bad listing

1. Admin → Listings → open it → set **Draft** (purges the page and announces the removal), or Delete.
2. Duplicates: keep the **oldest** copy (clean slug); Draft → Delete the suffixed ones. `data_health` lists each
   group with `keep` / `remove`.
3. A listing on a retired project: publish the project, relink the listing, or retire the listing.
4. A test project linked to live listings: unpublish/delete the project **and** the listings; the site already
   hides them (404 / omitted) but they stay on the Data Health list until removed.

## Not done on purpose
- **Agent BRN on the listing page.** `profiles.metadata.license_number` is free text and half the stored values are
  not in BRN shape (some are trade-licence numbers), so printing it as a "RERA BRN" would be a compliance
  claim we cannot back. The profile field is now labelled "RERA BRN (broker card number)"; once the values are
  verified against the DLD brokers register, print it beside the contact buttons.
- **A per-listing Trakheesi permit** (columns, display, verify page) and the database-side publish guard need
  migrations — optional, production-affecting (dev and prod share one Supabase project), only on explicit approval.
