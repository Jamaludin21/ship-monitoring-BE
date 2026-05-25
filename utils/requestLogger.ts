import { Request } from 'express'

const sensitiveKeys = new Set([
  'authorization',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'apisecret',
  'secret'
])

const maxStringLength = 300

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Buffer)
  )
}

export const sanitizeForLog = (value: unknown, depth = 0): unknown => {
  if (value === undefined) {
    return undefined
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.length > maxStringLength
      ? `${value.slice(0, maxStringLength)}...`
      : value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Buffer) {
    return `[Buffer ${value.length} bytes]`
  }

  if (depth >= 4) {
    return '[MaxDepth]'
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1))
  }

  if (!isPlainObject(value)) {
    return String(value)
  }

  return Object.entries(value).reduce<Record<string, unknown>>(
    (sanitizedValue, [key, nestedValue]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        sanitizedValue[key] = '[REDACTED]'
        return sanitizedValue
      }

      sanitizedValue[key] = sanitizeForLog(nestedValue, depth + 1)
      return sanitizedValue
    },
    {}
  )
}

export const hasLogValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value === 'string') {
    return value.length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length > 0
  }

  return true
}

export const formatLogDetails = (details: Record<string, unknown>) => {
  return Object.entries(details)
    .filter(([, value]) => hasLogValue(value))
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}=${value}`
      }

      return `${key}=${JSON.stringify(value)}`
    })
    .join(' ')
}

export const getRequestUser = (req: Request) => {
  const user = (req as Request & {
    user?: {
      id?: string
      role?: string
    }
  }).user

  return {
    userId: user?.id,
    role: user?.role
  }
}

export const getRequestLogContext = (
  req: Request,
  extraDetails: Record<string, unknown> = {}
) => {
  const { userId, role } = getRequestUser(req)

  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    params: sanitizeForLog(req.params),
    query: sanitizeForLog(req.query),
    userId,
    role,
    ...extraDetails
  }
}

export const logProcess = (
  event: string,
  details: Record<string, unknown> = {}
) => {
  console.log(`[BE:${event}] ${formatLogDetails(details)}`)
}

export const logProcessError = (
  event: string,
  details: Record<string, unknown> = {},
  error?: unknown
) => {
  console.error(`[BE:${event}] ${formatLogDetails(details)}`)

  if (error) {
    console.error(error)
  }
}
