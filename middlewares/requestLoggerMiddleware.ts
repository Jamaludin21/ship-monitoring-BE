import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'
import {
  getRequestLogContext,
  logProcess,
  logProcessError,
  sanitizeForLog
} from '../utils/requestLogger'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      requestStartedAt?: number
    }
  }
}

const getIncomingRequestId = (req: Request) => {
  const headerValue = req.headers['x-request-id']

  if (Array.isArray(headerValue)) {
    return headerValue[0]
  }

  return headerValue
}

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = getIncomingRequestId(req) || randomUUID()

  req.requestId = requestId
  req.requestStartedAt = Date.now()
  res.setHeader('X-Request-Id', requestId)

  logProcess(
    'REQUEST_START',
    getRequestLogContext(req, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    })
  )

  res.on('finish', () => {
    const durationMs = Date.now() - (req.requestStartedAt ?? Date.now())
    const details = getRequestLogContext(req, {
      statusCode: res.statusCode,
      durationMs,
      body: req.is('multipart/form-data')
        ? '[multipart/form-data]'
        : sanitizeForLog(req.body)
    })

    if (res.statusCode >= 400) {
      logProcessError('REQUEST_FAILED', details)
      return
    }

    logProcess('REQUEST_SUCCESS', details)
  })

  res.on('close', () => {
    if (res.writableEnded) {
      return
    }

    const durationMs = Date.now() - (req.requestStartedAt ?? Date.now())

    logProcessError(
      'REQUEST_ABORTED',
      getRequestLogContext(req, {
        durationMs
      })
    )
  })

  next()
}
