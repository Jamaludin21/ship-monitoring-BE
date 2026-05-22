import { NextFunction, Request, Response } from 'express'
import multer from 'multer'

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: 'Endpoint tidak ditemukan'
  })
}

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file maksimal 5MB'
        : 'Gagal memproses file'

    return res.status(400).json({ message })
  }

  if (error.message === 'File harus berformat PDF') {
    return res.status(400).json({ message: error.message })
  }

  console.error(error)

  return res.status(500).json({
    message: 'Terjadi kesalahan server'
  })
}
