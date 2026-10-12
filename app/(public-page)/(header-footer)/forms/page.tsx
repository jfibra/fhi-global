import type { Metadata } from "next"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList, webPageSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { listPublicForms } from "@/lib/forms"
import { FormsShelf } from "./forms-shelf"

/**
 * /forms — the dashboard's Library → Documents shelf, public and download-only.
 * Reads with the service-role client (lib/forms.ts); revalidates every 5 minutes.
 */

export const revalidate = 300

const PATH = "/forms"
const TITLE = "Forms — DLD Forms, Agreements and Templates"
const DESCRIPTION =
  "Download Dubai real estate forms: Dubai Land Department contract forms, agreements and FHI Global templates."

export const metadata: Metadata = createPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  pathname: PATH,
  keywords: ["Dubai real estate forms", "DLD forms download", "real estate agreement template Dubai"],
})

export default async function FormsPage() {
  const forms = await listPublicForms()
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <JsonLd
        schema={[
          webPageSchema({ path: PATH, name: TITLE, description: DESCRIPTION }),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Forms" }]),
        ]}
      />
      <FormsShelf docs={forms} />
    </div>
  )
}
