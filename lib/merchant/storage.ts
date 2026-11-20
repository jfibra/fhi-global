import "server-only"

import { randomBytes } from "node:crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

/**
 * Merchant files on S3 (the four official documents, the signed agreement),
 * under the lowercase `fhi_global/merchants/` prefix like the sale proofs and
 * registration IDs. Keys carry a random part so a document's address can't
 * be guessed from the merchant id and a timestamp.
 */

let client: S3Client | null = null
const s3 = () => (client ??= new S3Client({ region: process.env.S3_REGION!, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } }))

export const MERCHANT_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export const MERCHANT_FILE_MAX_BYTES = 15 * 1024 * 1024

export function merchantFileKey(merchantId: string, kind: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)
  return `fhi_global/merchants/${merchantId}/${kind}/${Date.now()}-${randomBytes(6).toString("hex")}-${safeName}`
}

export async function putMerchantFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=0" }))
  return `${process.env.S3_PUBLIC_URL}/${key}`
}
