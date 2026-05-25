import { InspectionCondition, Role, Status } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { navigationInspectionChecklist } from '../services/navigationInspectionChecklist'
import prisma from '../utils/prisma'

const passwordPlain = 'password'
const dummyPdfUrl =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

function daysAgo (days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function minutesAgo (minutes: number): Date {
  const date = new Date()
  date.setMinutes(date.getMinutes() - minutes)
  return date
}

async function main () {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeder ini tidak boleh dijalankan di production')
  }

  console.log('Membersihkan data lama...')

  await prisma.location.deleteMany()
  await prisma.navigationInspectionItem.deleteMany()
  await prisma.arrivalInspection.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.ship.deleteMany()
  await prisma.user.deleteMany()

  console.log('Membuat user...')

  const hashedPassword = await bcrypt.hash(passwordPlain, 10)

  const admin = await prisma.user.create({
    data: {
      username: 'admin1',
      password: hashedPassword,
      role: Role.ADMIN,
      name: 'Admin Pelabuhan'
    }
  })

  const manager = await prisma.user.create({
    data: {
      username: 'manager1',
      password: hashedPassword,
      role: Role.MANAGER,
      name: 'Manager Pelabuhan'
    }
  })

  const nahkodaAktif = await prisma.user.create({
    data: {
      username: 'nahkoda1',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Budi Santoso'
    }
  })

  const nahkodaHistory = await prisma.user.create({
    data: {
      username: 'nahkoda2',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Andi Wijaya'
    }
  })

  const nahkodaRejected = await prisma.user.create({
    data: {
      username: 'nahkoda3',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Rudi Hartono'
    }
  })

  const nahkodaTanpaLokasi = await prisma.user.create({
    data: {
      username: 'nahkoda4',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Dedi Kurniawan'
    }
  })

  const nahkodaTanpaPengajuan = await prisma.user.create({
    data: {
      username: 'nahkoda5',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Agus Salim'
    }
  })

  const nahkodaTanpaKapal = await prisma.user.create({
    data: {
      username: 'nahkoda_no_ship',
      password: hashedPassword,
      role: Role.NAHKODA,
      name: 'Nahkoda Tanpa Kapal'
    }
  })

  console.log('Membuat kapal...')

  const kapalAktifPending = await prisma.ship.create({
    data: {
      shipNumber: 'KM-001',
      name: 'Kapal Nusantara Jaya',
      captainId: nahkodaAktif.id
    }
  })

  const kapalHistoryApproved = await prisma.ship.create({
    data: {
      shipNumber: 'KM-002',
      name: 'Kapal Samudra Abadi',
      captainId: nahkodaHistory.id
    }
  })

  const kapalRejected = await prisma.ship.create({
    data: {
      shipNumber: 'KM-003',
      name: 'Kapal Laut Sejahtera',
      captainId: nahkodaRejected.id
    }
  })

  const kapalTanpaLokasi = await prisma.ship.create({
    data: {
      shipNumber: 'KM-004',
      name: 'Kapal Bintang Timur',
      captainId: nahkodaTanpaLokasi.id
    }
  })

  const kapalTanpaPengajuan = await prisma.ship.create({
    data: {
      shipNumber: 'KM-005',
      name: 'Kapal Merah Putih',
      captainId: nahkodaTanpaPengajuan.id
    }
  })

  console.log('Membuat lokasi kapal...')

  await prisma.location.createMany({
    data: [
      {
        shipId: kapalAktifPending.id,
        latitude: -6.1021,
        longitude: 106.8833,
        createdAt: minutesAgo(1)
      },
      {
        shipId: kapalAktifPending.id,
        latitude: -6.103,
        longitude: 106.884,
        createdAt: minutesAgo(3)
      },
      {
        shipId: kapalHistoryApproved.id,
        latitude: -6.11,
        longitude: 106.89,
        createdAt: minutesAgo(2)
      },
      {
        shipId: kapalRejected.id,
        latitude: -6.12,
        longitude: 106.9,
        createdAt: minutesAgo(30)
      },
      {
        shipId: kapalTanpaPengajuan.id,
        latitude: -6.13,
        longitude: 106.91,
        createdAt: minutesAgo(5)
      }
    ]
  })

  console.log('Membuat pengajuan berlabuh...')

  await prisma.submission.createMany({
    data: [
      {
        shipId: kapalAktifPending.id,
        captainName: 'Budi Santoso',
        employeeCount: 12,
        cargo: 'Batu Bara',
        cargoAmount: '250 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.PENDING,
        submittedAt: daysAgo(0)
      },
      {
        shipId: kapalHistoryApproved.id,
        captainName: 'Andi Wijaya',
        employeeCount: 15,
        cargo: 'Semen',
        cargoAmount: '180 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.APPROVED,
        submittedAt: daysAgo(7),
        reviewedAt: daysAgo(6),
        reviewedBy: admin.id
      },
      {
        shipId: kapalHistoryApproved.id,
        captainName: 'Andi Wijaya',
        employeeCount: 14,
        cargo: 'Besi',
        cargoAmount: '120 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.APPROVED,
        submittedAt: daysAgo(20),
        reviewedAt: daysAgo(19),
        reviewedBy: admin.id
      },
      {
        shipId: kapalHistoryApproved.id,
        captainName: 'Andi Wijaya',
        employeeCount: 16,
        cargo: 'Pupuk',
        cargoAmount: '95 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.PENDING,
        submittedAt: daysAgo(1)
      },
      {
        shipId: kapalRejected.id,
        captainName: 'Rudi Hartono',
        employeeCount: 10,
        cargo: 'Minyak Kelapa Sawit',
        cargoAmount: '300 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.REJECTED,
        reviewNote:
          'Dokumen Sertifikat Keselamatan belum jelas dan perlu diunggah ulang.',
        submittedAt: daysAgo(3),
        reviewedAt: daysAgo(2),
        reviewedBy: admin.id
      },
      {
        shipId: kapalTanpaLokasi.id,
        captainName: 'Dedi Kurniawan',
        employeeCount: 8,
        cargo: 'Bahan Pokok',
        cargoAmount: '75 Ton',
        sailingPermitUrl: dummyPdfUrl,
        callSignCertificateUrl: dummyPdfUrl,
        safetyCertificateUrl: dummyPdfUrl,
        radioStationPermitUrl: dummyPdfUrl,
        status: Status.PENDING,
        submittedAt: daysAgo(2)
      }
    ]
  })

  const inspectedSubmission = await prisma.submission.findFirst({
    where: {
      shipId: kapalHistoryApproved.id,
      status: Status.APPROVED
    },
    orderBy: {
      submittedAt: 'desc'
    }
  })

  if (inspectedSubmission) {
    await prisma.arrivalInspection.create({
      data: {
        submissionId: inspectedSubmission.id,
        inspectionDocumentUrl: dummyPdfUrl,
        responseLetterUrl: dummyPdfUrl,
        note: 'Contoh hasil pemeriksaan alat navigasi dan komunikasi.',
        checkedBy: admin.id,
        checkedAt: daysAgo(5),
        items: {
          create: navigationInspectionChecklist.map((item) => ({
            itemNo: item.itemNo,
            question: item.question,
            condition:
              item.itemNo === 14
                ? InspectionCondition.NO
                : InspectionCondition.YES,
            note:
              item.itemNo === 14
                ? 'NAVTEX perlu pengecekan ulang sebelum keberangkatan.'
                : null
          }))
        }
      }
    })
  }

  console.log('Seed selesai.')
  console.log('Akun test:')
  console.table([
    {
      role: 'ADMIN',
      username: 'admin1',
      password: passwordPlain
    },
    {
      role: 'MANAGER',
      username: 'manager1',
      password: passwordPlain
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda1',
      password: passwordPlain,
      case: 'Kapal aktif, punya lokasi terbaru, punya pengajuan PENDING'
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda2',
      password: passwordPlain,
      case: 'Kapal punya banyak history APPROVED dan PENDING'
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda3',
      password: passwordPlain,
      case: 'Kapal punya history REJECTED'
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda4',
      password: passwordPlain,
      case: 'Kapal punya pengajuan tapi belum punya live location'
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda5',
      password: passwordPlain,
      case: 'Kapal punya live location tapi belum ada pengajuan'
    },
    {
      role: 'NAHKODA',
      username: 'nahkoda_no_ship',
      password: passwordPlain,
      case: 'Nahkoda tidak punya kapal'
    }
  ])
}

main()
  .catch(error => {
    console.error('Seed gagal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
