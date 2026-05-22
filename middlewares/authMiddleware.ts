import '../utils/env'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type UserRole = 'ADMIN' | 'MANAGER' | 'NAHKODA'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: UserRole
  }
}

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required')
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string
      role: UserRole
    }

    req.user = {
      id: decoded.id,
      role: decoded.role
    }

    next()
  } catch {
    return res.status(401).json({ message: 'Token tidak valid' })
  }
}
