import { AdminProjects } from "@/features/dashboard/projects/variants";

// Editors get the same all-projects management as admins (the variant's role
// gate permits editor). See features/dashboard/projects/variants.tsx.
export default function Page() {
  return <AdminProjects />;
}
