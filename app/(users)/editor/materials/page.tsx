import Feature from "@/features/dashboard/materials/page";

// The gallery reads public/materials from disk. Pinning the segment to static
// means that scan happens once at build time — never inside a request — so the
// page costs nothing to serve and never depends on the deployed filesystem.
// New artwork ships with the deploy that adds the files.
export const dynamic = "force-static";

export default function Page() {
  return <Feature />;
}
