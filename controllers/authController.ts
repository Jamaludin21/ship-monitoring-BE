import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_skripsi_super_aman'

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    // 1. Cari user di database
    const user = await prisma.user.findUnique({
      where: { username },
      include: { ships: true }
    })
    if (!user) {
      res.status(404).json({ message: 'User tidak ditemukan' })
      return
    }

    // 2. Verifikasi Password (Di production, password harus di-hash saat register)
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Password salah' })
      return
    }

    // 3. Buat Token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' } // Token berlaku 1 hari
    )

    res.status(200).json({
      message: 'Login berhasil',
      token,
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        shipId: user.ships.length > 0 ? user.ships[0].id : null
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server', error })
  }
}
