import { Request, Response } from 'express'
import cloudinary from '../utils/cloudinary'
import prisma from '../utils/prisma'

export const uploadDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file
    const { shipId } = req.body // Dikirim dari Android

    if (!file) {
      res.status(400).json({ message: 'File tidak ditemukan' })
      return
    }

    // 1. Upload buffer file ke Cloudinary
    const b64 = Buffer.from(file.buffer).toString('base64')
    let dataURI = 'data:' + file.mimetype + ';base64,' + b64

    const cloudRes = await cloudinary.uploader.upload(dataURI, {
      folder: 'skripsi-dokumen-kapal',
      resource_type: 'auto' // Otomatis mendeteksi PDF atau Gambar
    })

    // 2. Simpan URL Cloudinary ke Database Neon
    const submission = await prisma.submission.create({
      data: {
        shipId: shipId,
        documentUrl: cloudRes.secure_url,
        status: 'PENDING'
      }
    })

    res.status(201).json({
      message: 'Dokumen berhasil diunggah',
      data: submission
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunggah dokumen', error })
  }
}
