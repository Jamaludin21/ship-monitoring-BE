import { Response, NextFunction } from 'express'
import { AuthRequest, UserRole } from './authMiddleware'

export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    next()
  }
}
