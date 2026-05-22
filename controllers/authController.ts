import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import '../utils/env'
import prisma from '../utils/prisma'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required')
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ message: 'Username dan password wajib diisi' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { ships: true }
    })
    if (!user) {
      res.status(404).json({ message: 'User tidak ditemukan' })
      return
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Password salah' })
      return
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    const primaryShip = user.ships[0] ?? null

    res.status(200).json({
      message: 'Login berhasil',
      token,
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        shipId: primaryShip?.id ?? null,
        shipNumber: primaryShip?.shipNumber ?? null,
        shipName: primaryShip?.name ?? null
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server', error })
  }
}
