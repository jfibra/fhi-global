import type { Area } from "react-easy-crop"

/**
 * Render the cropped region of an image (data/object URL) to a Blob via canvas.
 *
 * Default output is PNG so transparency is preserved (important for logos).
 * Pass "image/jpeg" + a quality (e.g. 0.92) for photos/avatars where a smaller
 * flattened file is preferable.
 */
export async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  type: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  quality?: number,
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", (e) => reject(e))
    img.src = imageSrc
  })

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(pixelCrop.width))
  canvas.height = Math.max(1, Math.round(pixelCrop.height))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is not supported in this browser.")

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the cropped image."))),
      type,
      quality,
    )
  })
}
