import { EditorOverview } from "@/features/dashboard/_overview/overviews"

// Editor landing: content KPIs, quick actions, and the editor's own activity.
// proxy.ts sends logged-in editors to /editor.
export default function Page() {
  return <EditorOverview />
}
