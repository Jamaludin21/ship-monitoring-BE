import { Readable } from 'stream'
import { get } from '@vercel/blob'
import { Request, Response } from 'express'
import {
  verifyFileAccessToken
} from '../services/documentAccessService'

const sanitizeDownloadFileName = (fileName: string) => {
  return fileName.replace(/["\\\r\n]/g, '')
}

const getToken = (value: unknown) => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }

  return typeof value === 'string' ? value : undefined
}

export const downloadPrivateBlobFile = async (
  req: Request,
  res: Response
) => {
  try {
    const token = getToken(req.query.token)

    if (!token) {
      return res.status(400).json({
        message: 'Token file wajib diisi'
      })
    }

    const payload = verifyFileAccessToken(token)
    const result = await get(payload.blobUrl, {
      access: 'private',
      ifNoneMatch:
        typeof req.headers['if-none-match'] === 'string'
          ? req.headers['if-none-match']
          : undefined
    })

    if (!result) {
      return res.status(404).json({
        message: 'File tidak ditemukan'
      })
    }

    res.setHeader('ETag', result.blob.etag)
    res.setHeader('Cache-Control', 'private, no-store')

    if (result.statusCode === 304) {
      return res.status(304).end()
    }

    res.setHeader('Content-Type', result.blob.contentType)

    if (payload.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${sanitizeDownloadFileName(payload.fileName)}"`
      )
    }

    return Readable.fromWeb(result.stream).pipe(res)
  } catch (error) {
    console.error(error)

    return res.status(401).json({
      message: 'Token file tidak valid atau sudah kedaluwarsa'
    })
  }
}
