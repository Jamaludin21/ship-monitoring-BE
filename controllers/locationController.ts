import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// 1. Fungsi untuk Nahkoda (Mengirim lokasi secara berkala)
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shipId, latitude, longitude } = req.body;

    if (!shipId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ message: "Data lokasi tidak lengkap" });
      return;
    }

    // Best Practice: Simpan sebagai riwayat baru setiap kali Nahkoda mengirim lokasi
    // Ini bagus untuk skripsi jika dosen bertanya "Apakah rute kapal terekam?"
    await prisma.location.create({
      data: {
        shipId,
        latitude,
        longitude
      }
    });

    res.status(200).json({ message: "Lokasi berhasil diperbarui" });
  } catch (error) {
    console.error("Error Update Location:", error);
    res.status(500).json({ message: "Terjadi kesalahan server saat update lokasi" });
  }
};

// 2. Fungsi untuk Manager (Mengambil posisi terakhir dari setiap kapal)
export const getAllShipLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    // Best Practice Prisma: Ambil semua data kapal beserta relasi lokasinya, 
    // TAPI cukup ambil 1 data lokasi terbaru (descending) untuk mengefisienkan RAM/Bandwidth
    const ships = await prisma.ship.findMany({
      include: {
        locations: {
          orderBy: {
            updatedAt: 'desc' // Urutkan dari yang paling baru
          },
          take: 1 // Ambil 1 teratas saja (titik live location saat ini)
        }
      }
    });

    // Format (Mapping) struktur JSON agar sesuai dengan data class `ShipLocation` di Android Kotlin Anda
    const formattedData = ships
      .filter(ship => ship.locations.length > 0) // Abaikan kapal yang belum pernah menyalakan GPS
      .map(ship => ({
        shipId: ship.id,
        shipName: ship.name,
        latitude: ship.locations[0].latitude,
        longitude: ship.locations[0].longitude
      }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error Get Locations:", error);
    res.status(500).json({ message: "Terjadi kesalahan server saat mengambil data lokasi" });
  }
};