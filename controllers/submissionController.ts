import { Status } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middlewares/authMiddleware'
import { uploadToCloudinary } from '../services/cloudinaryService'
import prisma from '../utils/prisma'

const submissionInclude = {
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
      uploadToCloudinary(files.sailingPermit[0]),
      uploadToCloudinary(files.callSignCertificate[0]),
      uploadToCloudinary(files.safetyCertificate[0]),
      uploadToCloudinary(files.radioStationPermit[0])
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
      data: submission,
    })
  } catch (error) {
    console.error(error)

    if (
      error instanceof Error &&
      error.message === 'Cloudinary environment variables are required'
    ) {
      return res.status(500).json({
        message: 'Konfigurasi Cloudinary belum lengkap'
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
      data: submissions
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
      data: submission
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
        shipId: ship.id
      },
      include: submissionInclude,
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return res.status(200).json({
      message: 'History pengajuan kapal berhasil diambil',
      data: submissions,
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
      data: submissions
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil history pengajuan'
    })
  }
}

export const approveSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id)

    if (!id) {
      return res.status(400).json({
        message: 'ID pengajuan tidak valid'
      })
    }

    const submission = await prisma.submission.findUnique({
      where: {
        id
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (submission.status !== Status.PENDING) {
      return res.status(400).json({
        message: 'Pengajuan sudah divalidasi'
      })
    }

    const updatedSubmission = await prisma.submission.update({
      where: {
        id: submission.id
      },
      data: {
        status: Status.APPROVED,
        reviewNote: null,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id
      },
      include: submissionInclude
    })

    return res.status(200).json({
      message: 'Pengajuan berhasil disetujui',
      data: updatedSubmission
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal menyetujui pengajuan'
    })
  }
}

export const rejectSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id)
    const { reviewNote } = req.body

    if (!id) {
      return res.status(400).json({
        message: 'ID pengajuan tidak valid'
      })
    }

    if (isBlank(reviewNote)) {
      return res.status(400).json({
        message: 'reviewNote wajib diisi saat menolak pengajuan'
      })
    }

    const submission = await prisma.submission.findUnique({
      where: {
        id
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (submission.status !== Status.PENDING) {
      return res.status(400).json({
        message: 'Pengajuan sudah divalidasi'
      })
    }

    const updatedSubmission = await prisma.submission.update({
      where: {
        id: submission.id
      },
      data: {
        status: Status.REJECTED,
        reviewNote: reviewNote.trim(),
        reviewedAt: new Date(),
        reviewedBy: req.user!.id
      },
      include: submissionInclude
    })

    return res.status(200).json({
      message: 'Pengajuan berhasil ditolak',
      data: updatedSubmission
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal menolak pengajuan'
    })
  }
}
