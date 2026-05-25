import { Response } from 'express'
import prisma from '../utils/prisma'
import { AuthRequest } from '../middlewares/authMiddleware'

export const updateLocation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const latitude = Number(req.body.latitude)
    const longitude = Number(req.body.longitude)

    if (req.body.latitude === undefined || req.body.longitude === undefined) {
      return res.status(400).json({
        message: 'Latitude dan longitude wajib diisi'
      })
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        message: 'Latitude dan longitude harus berupa angka'
      })
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: 'Koordinat tidak valid'
      })
    }

    const ship = await prisma.ship.findFirst({
      where: {
        captainId: userId
      }
    })

    if (!ship) {
      return res.status(404).json({
        message: 'Kapal tidak ditemukan'
      })
    }

    await prisma.location.create({
      data: {
        shipId: ship.id,
        latitude,
        longitude
      }
    })

    return res.status(200).json({
      message: 'Lokasi berhasil diperbarui'
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal memperbarui lokasi'
    })
  }
}

export const getAllShipLocations = async (req: AuthRequest, res: Response) => {
  try {
    const ships = await prisma.ship.findMany({
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
            createdAt: 'desc'
          },
          take: 1
        },
        submissions: {
          orderBy: {
            submittedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const data = ships
      .filter(ship => ship.locations.length > 0)
      .map(ship => ({
        shipId: ship.id,
        shipNumber: ship.shipNumber,
        shipName: ship.name,
        captain: ship.captain,
        latitude: ship.locations[0].latitude,
        longitude: ship.locations[0].longitude,
        updatedAt: ship.locations[0].createdAt,
        latestSubmission: ship.submissions[0] ?? null
      }))

    return res.status(200).json({
      message: 'Lokasi kapal berhasil diambil',
      data
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'Gagal mengambil lokasi kapal'
    })
  }
}
