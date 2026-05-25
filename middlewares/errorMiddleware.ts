import { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { getRequestLogContext, logProcessError } from '../utils/requestLogger'

export const notFoundHandler = (req: Request, res: Response) => {
  logProcessError(
    'NOT_FOUND',
    getRequestLogContext(req, {
      statusCode: 404
    })
  )

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

    logProcessError(
      'UPLOAD_ERROR',
      getRequestLogContext(req, {
        statusCode: 400,
        multerCode: error.code,
        message
      }),
      error
    )

    return res.status(400).json({ message })
  }

  if (error.message === 'File harus berformat PDF') {
    logProcessError(
      'UPLOAD_VALIDATION_ERROR',
      getRequestLogContext(req, {
        statusCode: 400,
        message: error.message
      }),
      error
    )

    return res.status(400).json({ message: error.message })
  }

  logProcessError(
    'UNHANDLED_ERROR',
    getRequestLogContext(req, {
      statusCode: 500,
      message: error.message
    }),
    error
  )

  return res.status(500).json({
    message: 'Terjadi kesalahan server'
  })
}
