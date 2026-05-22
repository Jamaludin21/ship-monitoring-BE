import { Response } from 'express'
import { AuthRequest } from '../middlewares/authMiddleware'
import prisma from '../utils/prisma'

const shipInclude = {
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
  },
  submissions: {
    orderBy: {
      submittedAt: 'desc' as const
    },
    take: 1
  }
}

const formatShip = (ship: any) => ({
  id: ship.id,
  shipNumber: ship.shipNumber,
  name: ship.name,
  captain: ship.captain,
  latestLocation: ship.locations[0] ?? null,
  latestSubmission: ship.submissions[0] ?? null,
  createdAt: ship.createdAt,
  updatedAt: ship.updatedAt
})

export const getShips = async (req: AuthRequest, res: Response) => {
  try {
    const ships = await prisma.ship.findMany({
      include: shipInclude,
      orderBy: {
        name: 'asc'
      }
    })

    return res.status(200).json({
      message: 'Data kapal berhasil diambil',
      data: ships.map(formatShip)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil data kapal'
    })
  }
}

export const getMyShips = async (req: AuthRequest, res: Response) => {
  try {
    const ships = await prisma.ship.findMany({
      where: {
        captainId: req.user!.id
      },
      include: shipInclude,
      orderBy: {
        name: 'asc'
      }
    })

    return res.status(200).json({
      message: 'Data kapal saya berhasil diambil',
      data: ships.map(formatShip)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil data kapal saya'
    })
  }
}
