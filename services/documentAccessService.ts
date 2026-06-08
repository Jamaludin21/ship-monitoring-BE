import jwt from 'jsonwebtoken'
import { Request } from 'express'

const documentUrlFields = [
  'sailingPermitUrl',
  'callSignCertificateUrl',
  'safetyCertificateUrl',
  'radioStationPermitUrl'
] as const

const arrivalInspectionUrlFields = [
  'inspectionDocumentUrl',
  'responseLetterUrl'
] as const

const adminVerificationUrlFields = ['verificationDocumentUrl'] as const

const managerValidationUrlFields = ['validationDocumentUrl'] as const

export type FileAccessTokenPayload = {
  blobUrl: string
  fileName?: string
}

const getFileAccessSecret = () => {
  return process.env.FILE_ACCESS_SECRET || process.env.JWT_SECRET
}

export const assertFileAccessConfig = () => {
  if (!getFileAccessSecret()) {
    throw new Error('FILE_ACCESS_SECRET or JWT_SECRET is required')
  }
}

const getBaseUrl = (req: Request) => {
  const configuredBaseUrl =
    process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '')
  }

  return `${req.protocol}://${req.get('host')}`
}

const getFileNameFromUrl = (value: string) => {
  try {
    const pathname = new URL(value).pathname
    const fileName = pathname.split('/').pop()
    return fileName ? decodeURIComponent(fileName) : undefined
  } catch {
    const fileName = value.split('/').pop()
    return fileName || undefined
  }
}

export const isPrivateBlobUrl = (value: unknown): value is string => {
  return (
    typeof value === 'string' &&
    value.includes('.private.blob.vercel-storage.com/')
  )
}

export const createFileAccessToken = (payload: FileAccessTokenPayload) => {
  assertFileAccessConfig()

  const signOptions: jwt.SignOptions = {
    expiresIn: (process.env.FILE_ACCESS_TOKEN_EXPIRES_IN ||
      '15m') as jwt.SignOptions['expiresIn']
  }

  return jwt.sign(payload, getFileAccessSecret()!, signOptions)
}

export const verifyFileAccessToken = (token: string): FileAccessTokenPayload => {
  assertFileAccessConfig()

  const payload = jwt.verify(token, getFileAccessSecret()!)

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.blobUrl !== 'string' ||
    !isPrivateBlobUrl(payload.blobUrl)
  ) {
    throw new Error('Token file tidak valid')
  }

  return {
    blobUrl: payload.blobUrl,
    fileName:
      typeof payload.fileName === 'string' ? payload.fileName : undefined
  }
}

export const buildDocumentDownloadUrl = (req: Request, value: unknown) => {
  if (!isPrivateBlobUrl(value)) {
    return value
  }

  const token = createFileAccessToken({
    blobUrl: value,
    fileName: getFileNameFromUrl(value)
  })

  return `${getBaseUrl(req)}/api/files/download?token=${encodeURIComponent(
    token
  )}`
}

const rewriteDocumentUrlFields = <T extends Record<string, any>>(
  req: Request,
  data: T,
  fields: readonly string[]
) => {
  const formattedData: Record<string, any> = {
    ...data
  }

  fields.forEach((field) => {
    if (field in formattedData) {
      formattedData[field] = buildDocumentDownloadUrl(req, formattedData[field])
    }
  })

  return formattedData
}

export const formatAdminVerificationDocumentUrls = <T>(
  req: Request,
  verification: T
) => {
  if (!verification || typeof verification !== 'object') {
    return verification
  }

  return rewriteDocumentUrlFields(
    req,
    verification as Record<string, any>,
    adminVerificationUrlFields
  )
}

export const formatManagerValidationDocumentUrls = <T>(
  req: Request,
  validation: T
) => {
  if (!validation || typeof validation !== 'object') {
    return validation
  }

  return rewriteDocumentUrlFields(
    req,
    validation as Record<string, any>,
    managerValidationUrlFields
  )
}

export const formatSubmissionDocumentUrls = <T>(req: Request, submission: T) => {
  if (!submission || typeof submission !== 'object') {
    return submission
  }

  const formattedSubmission = rewriteDocumentUrlFields(
    req,
    submission as Record<string, any>,
    documentUrlFields
  )

  if (
    formattedSubmission.arrivalInspection &&
    typeof formattedSubmission.arrivalInspection === 'object'
  ) {
    formattedSubmission.arrivalInspection = rewriteDocumentUrlFields(
      req,
      formattedSubmission.arrivalInspection,
      arrivalInspectionUrlFields
    )
  }

  if (
    formattedSubmission.adminVerification &&
    typeof formattedSubmission.adminVerification === 'object'
  ) {
    formattedSubmission.adminVerification = formatAdminVerificationDocumentUrls(
      req,
      formattedSubmission.adminVerification
    )
  }

  if (
    formattedSubmission.managerValidation &&
    typeof formattedSubmission.managerValidation === 'object'
  ) {
    formattedSubmission.managerValidation = formatManagerValidationDocumentUrls(
      req,
      formattedSubmission.managerValidation
    )
  }

  return formattedSubmission
}

export const formatSubmissionListDocumentUrls = <T>(
  req: Request,
  submissions: T[]
) => {
  return submissions.map((submission) =>
    formatSubmissionDocumentUrls(req, submission)
  )
}
