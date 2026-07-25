import { redirect } from "next/navigation"

// The editor role's job is developer & project content, so its landing goes
// straight to Developers. proxy.ts sends logged-in editors to /editor.
export default function Page() {
  redirect("/editor/developers")
}
