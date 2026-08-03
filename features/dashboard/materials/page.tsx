import { FolderDown } from "lucide-react"
import { listMaterials } from "@/lib/materials"
import { MaterialsGallery } from "./materials-gallery"

/**
 * Materials — shared marketing artwork, open to every role.
 *
 * A server component: the folder scan and the image probing happen once when
 * the page is prerendered, so the browser receives a plain list and never pays
 * for either.
 */
export default async function MaterialsPage() {
  const materials = await listMaterials()

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#001f3f] shadow-lg">
          <FolderDown className="h-6 w-6 text-[#d6b357]" />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Materials</h1>
          <p className="text-sm text-[#6b7280]">
            Shared marketing artwork — click any image to view it full size, or download the original.
          </p>
        </div>
      </div>

      <MaterialsGallery materials={materials} />
    </div>
  )
}
