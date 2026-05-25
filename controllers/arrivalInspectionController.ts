import { InspectionCondition, Status } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middlewares/authMiddleware'
import {
  getNavigationInspectionQuestion,
  navigationInspectionChecklist,
  navigationInspectionItemNumbers
} from '../services/navigationInspectionChecklist'
import {
  isBlobStorageConfigError,
  uploadToPrivateBlob
} from '../services/blobStorageService'
import { buildDocumentDownloadUrl } from '../services/documentAccessService'
import prisma from '../utils/prisma'

type ParsedInspectionItem = {
  itemNo: number
  question: string
  condition: InspectionCondition
  note: string | null
}

const arrivalInspectionInclude = {
  items: {
    orderBy: {
      itemNo: 'asc' as const
    }
  },
  submission: {
    include: {
      ship: {
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              username: true
            }
          }
        }
      }
    }
  }
}

const getParamValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

const parseCondition = (value: unknown): InspectionCondition => {
  if (typeof value === 'boolean') {
    return value ? InspectionCondition.YES : InspectionCondition.NO
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return InspectionCondition.YES
    }

    if (value === 0) {
      return InspectionCondition.NO
    }
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toUpperCase()

    if (['YES', 'YA', 'TRUE', '1'].includes(normalizedValue)) {
      return InspectionCondition.YES
    }

    if (['NO', 'TIDAK', 'FALSE', '0'].includes(normalizedValue)) {
      return InspectionCondition.NO
    }
  }

  throw new Error('condition hanya boleh bernilai YES/NO atau YA/TIDAK')
}

const parseInspectionItems = (
  value: unknown
): ParsedInspectionItem[] | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  let payload = value

  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value)
    } catch {
      throw new Error('inspectionItems harus berupa JSON array yang valid')
    }
  }

  if (!Array.isArray(payload)) {
    throw new Error('inspectionItems harus berupa array')
  }

  const seenItemNumbers = new Set<number>()

  const parsedItems = payload.map((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') {
      throw new Error('Setiap item checklist harus berupa object')
    }

    const item = rawItem as {
      itemNo?: unknown
      condition?: unknown
      note?: unknown
    }
    const itemNo = Number(item.itemNo)
    const question = getNavigationInspectionQuestion(itemNo)

    if (!Number.isInteger(itemNo) || !question) {
      throw new Error('Nomor item checklist tidak valid')
    }

    if (seenItemNumbers.has(itemNo)) {
      throw new Error('Nomor item checklist tidak boleh duplikat')
    }

    seenItemNumbers.add(itemNo)

    return {
      itemNo,
      question,
      condition: parseCondition(item.condition),
      note: normalizeOptionalString(item.note) ?? null
    }
  })

  const missingItemNumbers = navigationInspectionItemNumbers.filter(
    (itemNo) => !seenItemNumbers.has(itemNo)
  )

  if (missingItemNumbers.length > 0) {
    throw new Error(
      `inspectionItems harus memuat semua item checklist: ${navigationInspectionItemNumbers.join(
        ', '
      )}`
    )
  }

  return parsedItems.sort((firstItem, secondItem) => {
    return (
      navigationInspectionItemNumbers.indexOf(firstItem.itemNo) -
      navigationInspectionItemNumbers.indexOf(secondItem.itemNo)
    )
  })
}

const getArrivalInspectionFiles = (req: AuthRequest) => {
  const files = req.files as
    | {
        [fieldname: string]: Express.Multer.File[]
      }
    | undefined

  return {
    inspectionDocument: files?.inspectionDocument?.[0],
    responseLetter: files?.responseLetter?.[0]
  }
}

const formatArrivalInspectionDocumentUrls = (
  req: AuthRequest,
  inspection: any
) => {
  if (!inspection) {
    return inspection
  }

  return {
    ...inspection,
    inspectionDocumentUrl: buildDocumentDownloadUrl(
      req,
      inspection.inspectionDocumentUrl
    ),
    responseLetterUrl: buildDocumentDownloadUrl(req, inspection.responseLetterUrl)
  }
}

export const getArrivalInspectionChecklist = async (
  req: AuthRequest,
  res: Response
) => {
  return res.status(200).json({
    message: 'Checklist pemeriksaan berhasil diambil',
    data: navigationInspectionChecklist
  })
}

export const getArrivalInspection = async (
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
      include: {
        arrivalInspection: {
          include: arrivalInspectionInclude
        }
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (!submission.arrivalInspection) {
      return res.status(404).json({
        message: 'Hasil cek kapal belum tersedia'
      })
    }

    return res.status(200).json({
      message: 'Hasil cek kapal berhasil diambil',
      data: formatArrivalInspectionDocumentUrls(req, submission.arrivalInspection)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil hasil cek kapal'
    })
  }
}

export const upsertArrivalInspection = async (
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

    const submission = await prisma.submission.findUnique({
      where: {
        id
      },
      include: {
        arrivalInspection: true
      }
    })

    if (!submission) {
      return res.status(404).json({
        message: 'Pengajuan tidak ditemukan'
      })
    }

    if (submission.status !== Status.APPROVED) {
      return res.status(400).json({
        message:
          'Hasil cek kapal hanya dapat dibuat untuk pengajuan yang sudah disetujui'
      })
    }

    let inspectionItems: ParsedInspectionItem[] | undefined

    try {
      inspectionItems = parseInspectionItems(req.body.inspectionItems)
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : 'Checklist tidak valid'
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
    const { inspectionDocument, responseLetter } = getArrivalInspectionFiles(req)

    if (
      !inspectionItems &&
      !inspectionDocument &&
      !responseLetter &&
      !noteWasProvided
    ) {
      return res.status(400).json({
        message:
          'Isi checklist, unggah dokumen hasil cek, unggah surat balasan, atau isi catatan'
      })
    }

    const [inspectionDocumentUrl, responseLetterUrl] = await Promise.all([
      inspectionDocument
        ? uploadToPrivateBlob(
            inspectionDocument,
            'ship-monitoring/arrival-inspections'
          )
        : Promise.resolve(undefined),
      responseLetter
        ? uploadToPrivateBlob(
            responseLetter,
            'ship-monitoring/response-letters'
          )
        : Promise.resolve(undefined)
    ])

    const inspection = submission.arrivalInspection
      ? await prisma.arrivalInspection.update({
          where: {
            submissionId: submission.id
          },
          data: {
            ...(inspectionDocumentUrl ? { inspectionDocumentUrl } : {}),
            ...(responseLetterUrl ? { responseLetterUrl } : {}),
            ...(noteWasProvided ? { note } : {}),
            checkedBy: req.user!.id,
            checkedAt: new Date(),
            ...(inspectionItems
              ? {
                  items: {
                    deleteMany: {},
                    create: inspectionItems.map((item) => ({
                      itemNo: item.itemNo,
                      question: item.question,
                      condition: item.condition,
                      note: item.note
                    }))
                  }
                }
              : {})
          },
          include: arrivalInspectionInclude
        })
      : await prisma.arrivalInspection.create({
          data: {
            submissionId: submission.id,
            inspectionDocumentUrl: inspectionDocumentUrl ?? null,
            responseLetterUrl: responseLetterUrl ?? null,
            note: noteWasProvided ? note : null,
            checkedBy: req.user!.id,
            ...(inspectionItems
              ? {
                  items: {
                    create: inspectionItems.map((item) => ({
                      itemNo: item.itemNo,
                      question: item.question,
                      condition: item.condition,
                      note: item.note
                    }))
                  }
                }
              : {})
          },
          include: arrivalInspectionInclude
        })

    return res.status(submission.arrivalInspection ? 200 : 201).json({
      message: 'Hasil cek kapal berhasil disimpan',
      data: formatArrivalInspectionDocumentUrls(req, inspection)
    })
  } catch (error) {
    console.error(error)

    if (isBlobStorageConfigError(error)) {
      return res.status(500).json({
        message: 'Konfigurasi Vercel Blob belum lengkap'
      })
    }

    return res.status(500).json({
      message: 'Gagal menyimpan hasil cek kapal'
    })
  }
}
