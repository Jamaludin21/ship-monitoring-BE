import { ManagerDecision, Status } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middlewares/authMiddleware'
import {
  getBlobPathnameFromUrl,
  isBlobStorageConfigError,
  uploadToPrivateBlob
} from '../services/blobStorageService'
import {
  formatAdminVerificationDocumentUrls,
  formatManagerValidationDocumentUrls,
  formatSubmissionDocumentUrls,
  formatSubmissionListDocumentUrls
} from '../services/documentAccessService'
import prisma from '../utils/prisma'

const submissionInclude = {
  adminVerification: true,
  managerValidation: true,
  arrivalInspection: {
    include: {
      items: {
        orderBy: {
          itemNo: 'asc' as const
        }
      }
    }
  },
  ship: {
    include: {
      captain: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      locations: {
        orderBy: {
          createdAt: 'desc' as const
        },
        take: 1
      }
    }
  }
}

const isBlank = (value: unknown) =>
  typeof value !== 'string' || value.trim().length === 0

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

const isFinalStatus = (status: Status) => {
  return status === Status.APPROVED || status === Status.REJECTED
}

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

const parseStatusQuery = (status: unknown): Status | undefined => {
  if (typeof status !== 'string' || status.trim() === '') {
    return undefined
  }

  const normalizedStatus = status.toUpperCase()

  if (!Object.values(Status).includes(normalizedStatus as Status)) {
    return undefined
  }

  return normalizedStatus as Status
}

const parseManagerDecision = (
  decision: unknown
): ManagerDecision | undefined => {
  if (typeof decision !== 'string' || decision.trim() === '') {
    return undefined
  }

  const normalizedDecision = decision.trim().toUpperCase()

  if (
    !Object.values(ManagerDecision).includes(
      normalizedDecision as ManagerDecision
    )
  ) {
    return undefined
  }

  return normalizedDecision as ManagerDecision
}

const buildShipNumberSearchValues = (shipNumber: string) => {
  const normalizedShipNumber = shipNumber.trim().toUpperCase()
  const searchValues = [normalizedShipNumber]
  const numericPart = normalizedShipNumber.replace(/^KM-/, '')

  if (/^\d+$/.test(numericPart)) {
    const paddedNumber = numericPart.padStart(3, '0')

    searchValues.push(paddedNumber, `KM-${paddedNumber}`)
  }

  return Array.from(new Set(searchValues)).filter(Boolean)
}

const buildShipNumberWhere = (shipNumber: string) => {
  const searchValues = buildShipNumberSearchValues(shipNumber)
  const numericValue = searchValues.find((value) => /^\d+$/.test(value))

  return {
    OR: [
      {
        shipNumber: {
          in: searchValues
        }
      },
      ...(numericValue
        ? [
            {
              shipNumber: {
                endsWith: `-${numericValue}`
              }
            }
          ]
        : [])
    ]
  }
}

export const createSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const {
      captainName,
      employeeCount,
      cargo,
      cargoAmount,
    } = req.body

    const employeeCountNumber = Number(employeeCount)

    if (
      isBlank(captainName) ||
      isBlank(cargo) ||
      isBlank(cargoAmount) ||
      !Number.isInteger(employeeCountNumber) ||
      employeeCountNumber <= 0
    ) {
      return res.status(400).json({
        message:
          'captainName, employeeCount, cargo, dan cargoAmount wajib diisi dengan benar',
      })
    }

    const ship = await prisma.ship.findFirst({
      where: {
        captainId: userId,
      },
    })

    if (!ship) {
      return res.status(404).json({
        message: 'Kapal untuk nahkoda ini tidak ditemukan',
      })
    }

    const latestLocation = await prisma.location.findFirst({
      where: {
        shipId: ship.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!latestLocation) {
      return res.status(400).json({
        message: 'Aktifkan live location sebelum mengajukan berlabuh',
      })
    }

    const files = req.files as {
      [fieldname: string]: Express.Multer.File[]
    }

    if (
      !files?.sailingPermit?.[0] ||
      !files?.callSignCertificate?.[0] ||
      !files?.safetyCertificate?.[0] ||
      !files?.radioStationPermit?.[0]
    ) {
      return res.status(400).json({
        message: 'Semua dokumen wajib diunggah',
      })
    }

    const [
      sailingPermitUrl,
      callSignCertificateUrl,
      safetyCertificateUrl,
      radioStationPermitUrl
    ] = await Promise.all([
      uploadToPrivateBlob(files.sailingPermit[0]),
      uploadToPrivateBlob(files.callSignCertificate[0]),
      uploadToPrivateBlob(files.safetyCertificate[0]),
      uploadToPrivateBlob(files.radioStationPermit[0])
    ])

    const submission = await prisma.submission.create({
      data: {
        shipId: ship.id,
        captainName: captainName.trim(),
        employeeCount: employeeCountNumber,
        cargo: cargo.trim(),
        cargoAmount: cargoAmount.trim(),
        sailingPermitUrl,
        callSignCertificateUrl,
        safetyCertificateUrl,
        radioStationPermitUrl,
      },
      include: submissionInclude,
    })

    return res.status(201).json({
      message: 'Pengajuan berlabuh berhasil dikirim',
      data: formatSubmissionDocumentUrls(req, submission),
    })
  } catch (error) {
    console.error(error)

    if (isBlobStorageConfigError(error)) {
      return res.status(500).json({
        message: 'Konfigurasi Vercel Blob belum lengkap'
      })
    }

    return res.status(500).json({
      message: 'Gagal membuat pengajuan berlabuh',
    })
  }
}

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const status = parseStatusQuery(req.query.status)
    const shipNumber =
      typeof req.query.shipNumber === 'string'
        ? req.query.shipNumber.trim()
        : undefined

    if (req.query.status && !status) {
      return res.status(400).json({
        message: 'Status tidak valid'
      })
    }

    const submissions = await prisma.submission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(req.user!.role === 'MANAGER'
          ? {
              adminVerification: {
                isNot: null
              }
            }
          : {}),
        ...(shipNumber
          ? {
              ship: buildShipNumberWhere(shipNumber)
            }
          : {})
      },
      include: submissionInclude,
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return res.status(200).json({
      message: 'Data pengajuan berhasil diambil',
      data: formatSubmissionListDocumentUrls(req, submissions)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil data pengajuan'
    })
  }
}

export const getSubmissionDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id)

    if (!id) {
      return res.status(400).json({
        message: 'ID pengajuan tidak valid'
      })
    }

    const submission = await prisma.submission.findFirst({
      where: {
        id,
        ...(req.user!.role === 'NAHKODA'
          ? {
              ship: {
                captainId: req.user!.id
              }
            }
          : {}),
        ...(req.user!.role === 'MANAGER'
          ? {
              adminVerification: {
                isNot: null
              }
            }
          : {})
      },
      include: submissionInclude
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    return res.status(200).json({
      message: 'Detail pengajuan berhasil diambil',
      data: formatSubmissionDocumentUrls(req, submission)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil detail pengajuan'
    })
  }
}

export const getShipHistory = async (req: AuthRequest, res: Response) => {
  try {
    const shipNumber = getParamValue(req.params.shipNumber)?.trim()

    if (!shipNumber) {
      return res.status(400).json({
        message: 'Nomor kapal tidak valid'
      })
    }

    const matchingShips = await prisma.ship.findMany({
      where: buildShipNumberWhere(shipNumber),
      select: {
        id: true,
        shipNumber: true,
        name: true,
        captain: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      take: 2
    })

    if (matchingShips.length === 0) {
      return res.status(404).json({
        message: 'Kapal tidak ditemukan'
      })
    }

    if (matchingShips.length > 1) {
      return res.status(409).json({
        message: 'Nomor kapal terlalu umum, gunakan nomor kapal lengkap'
      })
    }

    const ship = matchingShips[0]
    const submissions = await prisma.submission.findMany({
      where: {
        shipId: ship.id,
        ...(req.user!.role === 'MANAGER'
          ? {
              adminVerification: {
                isNot: null
              }
            }
          : {})
      },
      include: submissionInclude,
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return res.status(200).json({
      message: 'History pengajuan kapal berhasil diambil',
      data: formatSubmissionListDocumentUrls(req, submissions),
      ship
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil history kapal'
    })
  }
}

export const getMySubmissionHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        ship: {
          captainId: req.user!.id
        }
      },
      include: submissionInclude,
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return res.status(200).json({
      message: 'History pengajuan berhasil diambil',
      data: formatSubmissionListDocumentUrls(req, submissions)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil history pengajuan'
    })
  }
}

export const upsertAdminVerification = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = getParamValue(req.params.id)

    if (!id) {
      return res.status(400).json({
        message: 'ID pengajuan tidak valid'
      })
    }

    const noteWasProvided = Object.prototype.hasOwnProperty.call(
      req.body,
      'note'
    )

    if (noteWasProvided && typeof req.body.note !== 'string') {
      return res.status(400).json({
        message: 'note harus berupa teks'
      })
    }

    const note = normalizeOptionalString(req.body.note)
    const verificationDocument = req.file

    const submission = await prisma.submission.findUnique({
      where: {
        id
      },
      include: {
        adminVerification: true
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (isFinalStatus(submission.status)) {
      return res.status(400).json({
        message:
          'Verifikasi admin tidak dapat diubah karena keputusan manager sudah final'
      })
    }

    if (!submission.adminVerification && !verificationDocument) {
      return res.status(400).json({
        message: 'verificationDocument wajib diunggah'
      })
    }

    if (
      submission.adminVerification &&
      !verificationDocument &&
      !noteWasProvided
    ) {
      return res.status(400).json({
        message: 'Unggah dokumen verifikasi atau isi catatan'
      })
    }

    const verificationDocumentUrl = verificationDocument
      ? await uploadToPrivateBlob(
          verificationDocument,
          'ship-monitoring/admin-verifications'
        )
      : undefined
    const verificationDocumentKey = getBlobPathnameFromUrl(
      verificationDocumentUrl
    )
    const verifiedAt = new Date()

    const verification = await prisma.$transaction(async (tx) => {
      const savedVerification = await tx.adminVerification.upsert({
        where: {
          submissionId: submission.id
        },
        create: {
          submissionId: submission.id,
          verificationDocumentUrl: verificationDocumentUrl ?? null,
          verificationDocumentKey,
          note: noteWasProvided ? note : null,
          verifiedBy: req.user!.id,
          verifiedAt
        },
        update: {
          ...(verificationDocumentUrl
            ? {
                verificationDocumentUrl,
                verificationDocumentKey
              }
            : {}),
          ...(noteWasProvided ? { note } : {}),
          verifiedBy: req.user!.id,
          verifiedAt
        }
      })

      await tx.submission.update({
        where: {
          id: submission.id
        },
        data: {
          status: Status.WAITING_MANAGER_VALIDATION
        }
      })

      return savedVerification
    })

    return res.status(submission.adminVerification ? 200 : 201).json({
      message: 'Dokumen verifikasi admin berhasil disimpan.',
      data: formatAdminVerificationDocumentUrls(req, verification)
    })
  } catch (error) {
    console.error(error)

    if (isBlobStorageConfigError(error)) {
      return res.status(500).json({
        message: 'Konfigurasi Vercel Blob belum lengkap'
      })
    }

    return res.status(500).json({
      message: 'Gagal menyimpan verifikasi admin'
    })
  }
}

export const submitManagerValidation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = getParamValue(req.params.id)

    if (!id) {
      return res.status(400).json({
        message: 'ID pengajuan tidak valid'
      })
    }

    const decision = parseManagerDecision(req.body.decision)

    if (!decision) {
      return res.status(400).json({
        message: 'decision hanya boleh APPROVED atau REJECTED'
      })
    }

    const noteWasProvided = Object.prototype.hasOwnProperty.call(
      req.body,
      'note'
    )

    if (noteWasProvided && typeof req.body.note !== 'string') {
      return res.status(400).json({
        message: 'note harus berupa teks'
      })
    }

    const validationDocument = req.file

    if (!validationDocument) {
      return res.status(400).json({
        message: 'validationDocument wajib diunggah'
      })
    }

    const note = normalizeOptionalString(req.body.note)
    const submission = await prisma.submission.findUnique({
      where: {
        id
      },
      include: {
        adminVerification: true
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (!submission.adminVerification) {
      return res.status(400).json({
        message: 'Pengajuan belum memiliki dokumen verifikasi admin'
      })
    }

    if (isFinalStatus(submission.status)) {
      return res.status(400).json({
        message: 'Keputusan manager sudah final'
      })
    }

    const validationDocumentUrl = await uploadToPrivateBlob(
      validationDocument,
      'ship-monitoring/manager-validations'
    )
    const validationDocumentKey = getBlobPathnameFromUrl(validationDocumentUrl)
    const validatedAt = new Date()
    const status =
      decision === ManagerDecision.APPROVED
        ? Status.APPROVED
        : Status.REJECTED

    const validation = await prisma.$transaction(async (tx) => {
      const savedValidation = await tx.managerValidation.upsert({
        where: {
          submissionId: submission.id
        },
        create: {
          submissionId: submission.id,
          decision,
          validationDocumentUrl,
          validationDocumentKey,
          note: noteWasProvided ? note : null,
          validatedBy: req.user!.id,
          validatedAt
        },
        update: {
          decision,
          validationDocumentUrl,
          validationDocumentKey,
          note: noteWasProvided ? note : null,
          validatedBy: req.user!.id,
          validatedAt
        }
      })

      await tx.submission.update({
        where: {
          id: submission.id
        },
        data: {
          status,
          reviewNote: noteWasProvided ? note : null,
          reviewedAt: validatedAt,
          reviewedBy: req.user!.id
        }
      })

      return savedValidation
    })

    return res.status(200).json({
      message: 'Validasi manager berhasil dikirim.',
      data: formatManagerValidationDocumentUrls(req, validation)
    })
  } catch (error) {
    console.error(error)

    if (isBlobStorageConfigError(error)) {
      return res.status(500).json({
        message: 'Konfigurasi Vercel Blob belum lengkap'
      })
    }

    return res.status(500).json({
      message: 'Gagal mengirim validasi manager'
    })
  }
}

export const approveSubmission = async (req: AuthRequest, res: Response) => {
  return res.status(410).json({
    message:
      'Endpoint approval lama sudah tidak digunakan. Gunakan PUT /api/submissions/:id/manager-validation'
  })
}

export const rejectSubmission = async (req: AuthRequest, res: Response) => {
  return res.status(410).json({
    message:
      'Endpoint rejection lama sudah tidak digunakan. Gunakan PUT /api/submissions/:id/manager-validation'
  })
}
