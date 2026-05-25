import { randomUUID } from 'crypto'
import { put } from '@vercel/blob'

export const blobConfigErrorMessage =
  'Vercel Blob environment variables are required'

const assertBlobConfig = () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(blobConfigErrorMessage)
  }
}

const sanitizeFileName = (fileName: string) => {
  const sanitizedFileName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')

  return sanitizedFileName.length > 0 ? sanitizedFileName : 'document.pdf'
}

const buildBlobPathname = (file: Express.Multer.File, folder: string) => {
  const datePrefix = new Date().toISOString().slice(0, 10)
  const safeFileName = sanitizeFileName(file.originalname)

  return `${folder}/${datePrefix}/${randomUUID()}-${safeFileName}`
}

export const uploadToPrivateBlob = async (
  file: Express.Multer.File,
  folder = 'ship-monitoring/submissions'
): Promise<string> => {
  assertBlobConfig()

  const blob = await put(buildBlobPathname(file, folder), file.buffer, {
    access: 'private',
    contentType: file.mimetype,
    addRandomSuffix: false
  })

  return blob.url
}

export const isBlobStorageConfigError = (error: unknown) => {
  return error instanceof Error && error.message === blobConfigErrorMessage
}
