import type { Metadata } from "next"
import { SampleSite } from "./sample-site"

// Design sample for the next-generation Website Builder template — a full
// standalone agent site (own navbar + footer, no global chrome) filled with
// placeholder data. Not indexable; exists so the layout can be reviewed at
// /website/sample before it's wired to real builder data.

export const metadata: Metadata = {
  title: "Website Builder — Sample Template",
  robots: { index: false, follow: false },
}

export default function WebsiteSamplePage() {
  return <SampleSite />
}
