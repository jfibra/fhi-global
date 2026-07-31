import { EBOOKS } from "@/lib/ebooks"
import { EbooksClient } from "./ebooks-client"

/**
 * Ebooks — shared training PDFs, open to every role.
 *
 * No padding here: the shelf and the reader set their own, because the reader
 * runs edge-to-edge to give the PDF as much room as possible.
 */
export default function EbooksPage() {
  return <EbooksClient books={EBOOKS} />
}
