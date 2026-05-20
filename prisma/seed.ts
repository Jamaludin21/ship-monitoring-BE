import { PrismaClient, Role, Status } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// 1. Inisialisasi Environment
dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error(
    '❌ Error: DATABASE_URL tidak ditemukan. Pastikan file .env sudah ada.'
  )
  process.exit(1)
}

// 2. Inisialisasi Prisma dengan Driver Adapter PG
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main () {
  console.log('⏳ Memulai proses seeding data komprehensif...')

  // Hapus data lama (Reset) dari tabel paling ujung (child) ke paling atas (parent)
  await prisma.location.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.ship.deleteMany()
  await prisma.user.deleteMany()

  const salt = await bcrypt.genSalt(10)
  const defaultPassword = await bcrypt.hash('password123', salt)

  // ==========================================
  // 1. SEED AKUN ADMIN & MANAGER
  // ==========================================
  await prisma.user.create({
    data: {
      username: 'admin1',
      password: defaultPassword,
      role: Role.ADMIN,
      name: 'Admin Pelabuhan Pusat'
    }
  })

  await prisma.user.create({
    data: {
      username: 'manager1',
      password: defaultPassword,
      role: Role.MANAGER,
      name: 'Manager Operasional'
    }
  })

  // ==========================================
  // 2. SEED AKUN NAHKODA & KAPALNYA
  // ==========================================

  // Nahkoda 1: KM. Kelud (Kasus: Sedang berlayar menuju pelabuhan, status pengajuan APPROVED)
  const nahkoda1 = await prisma.user.create({
    data: {
      username: 'nahkoda_kelud',
      password: defaultPassword,
      role: Role.NAHKODA,
      name: 'Kapten Haris',
      ships: { create: [{ name: 'KM. Kelud' }] }
    },
    include: { ships: true }
  })

  // Nahkoda 2: KM. Awu (Kasus: Baru mau mengajukan dokumen, status PENDING)
  const nahkoda2 = await prisma.user.create({
    data: {
      username: 'nahkoda_awu',
      password: defaultPassword,
      role: Role.NAHKODA,
      name: 'Kapten Rudi',
      ships: { create: [{ name: 'KM. Awu' }] }
    },
    include: { ships: true }
  })

  // Nahkoda 3: KM. Dobonsolo (Kasus: Dokumen ditolak, dan belum pernah menyalakan GPS)
  const nahkoda3 = await prisma.user.create({
    data: {
      username: 'nahkoda_dobonsolo',
      password: defaultPassword,
      role: Role.NAHKODA,
      name: 'Kapten Junaidi',
      ships: { create: [{ name: 'KM. Dobonsolo' }] }
    },
    include: { ships: true }
  })

  // ==========================================
  // 3. SEED DOKUMEN PENGAJUAN (SUBMISSIONS)
  // ==========================================

  // Dokumen dummy URL (Bisa diganti dengan link cloudinary beneran nanti)
  const dummyDocUrl =
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

  await prisma.submission.createMany({
    data: [
      {
        shipId: nahkoda1.ships[0].id,
        documentUrl: dummyDocUrl,
        status: Status.APPROVED,
        reviewedAt: new Date()
      },
      {
        shipId: nahkoda2.ships[0].id,
        documentUrl: dummyDocUrl,
        status: Status.PENDING
      },
      {
        shipId: nahkoda3.ships[0].id,
        documentUrl: dummyDocUrl,
        status: Status.REJECTED,
        reviewedAt: new Date()
      }
    ]
  })

  // ==========================================
  // 4. SEED LOKASI GPS (Riwayat Pergerakan Kapal)
  // ==========================================

  const now = new Date()

  // Riwayat KM. Kelud (Punya 3 titik lokasi untuk mensimulasikan pergerakan menuju Tj Priok)
  await prisma.location.createMany({
    data: [
      // 20 menit lalu (Jauh dari pelabuhan)
      {
        shipId: nahkoda1.ships[0].id,
        latitude: -5.9,
        longitude: 106.8,
        updatedAt: new Date(now.getTime() - 20 * 60000)
      },
      // 10 menit lalu (Mendekat)
      {
        shipId: nahkoda1.ships[0].id,
        latitude: -6.0,
        longitude: 106.85,
        updatedAt: new Date(now.getTime() - 10 * 60000)
      },
      // SEKARANG (Titik terbaru yang akan muncul di Peta Manager) - Tanjung Priok
      {
        shipId: nahkoda1.ships[0].id,
        latitude: -6.1021,
        longitude: 106.8833,
        updatedAt: now
      }
    ]
  })

  // Riwayat KM. Awu (Hanya 1 titik lokasi, kapal sedang diam / berlabuh di titik lain)
  await prisma.location.create({
    data: {
      shipId: nahkoda2.ships[0].id,
      latitude: -6.115,
      longitude: 106.87,
      updatedAt: now
    }
  })

  // KM. Dobonsolo sengaja TIDAK DIBERI DATA LOKASI untuk menguji apakah sistem crash jika array kosong.

  console.log('✅ Seeding Selesai!')
  console.log('====================================================')
  console.log('   DATA PENGUJIAN APLIKASI (Gunakan untuk Login)')
  console.log('====================================================')
  console.log(`[NAHKODA 1 - KM. Kelud]`)
  console.log(`- Kondisi   : GPS Aktif (3 Riwayat), Dokumen APPROVED`)
  console.log(`- Username  : nahkoda_kelud`)
  console.log(`- Password  : password123`)
  console.log(`- ID Kapal  : ${nahkoda1.ships[0].id}\n`)

  console.log(`[NAHKODA 2 - KM. Awu]`)
  console.log(`- Kondisi   : GPS Aktif (1 Titik), Dokumen PENDING`)
  console.log(`- Username  : nahkoda_awu\n`)

  console.log(`[NAHKODA 3 - KM. Dobonsolo]`)
  console.log(`- Kondisi   : GPS MATI (Blank), Dokumen REJECTED`)
  console.log(`- Username  : nahkoda_dobonsolo\n`)

  console.log(`[MANAGER]`)
  console.log(`- Kondisi   : Akan melihat 2 Kapal di Peta (Kelud & Awu)`)
  console.log(`- Username  : manager1\n`)

  console.log(`[ADMIN]`)
  console.log(`- Username  : admin1`)
  console.log('====================================================')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
