export const navigationInspectionChecklist = [
  {
    itemNo: 1,
    question:
      'Radar berfungsi dengan baik, dapat menangkap object disekitar dengan baik, dengan jangkauan yang sudah memenuhi ketentuan'
  },
  {
    itemNo: 2,
    question:
      'Echosounder berfungsi dengan baik, dapat menunjukan kedalaman perairan dari lunas kapal sampai dasar perairan'
  },
  {
    itemNo: 3,
    question: 'Lampu-Lampu navigasi berfungsi dengan baik'
  },
  {
    itemNo: 4,
    question:
      'GPS Navigator berfungsi dengan baik, dapat menunjukan posisi kapal dengan koordinat lintang dan bujur, mengetahui haluan dan kecepatan kapal, dapat membuat route pelayaran terdiri dari beberapa way point.'
  },
  {
    itemNo: 5,
    question:
      'AIS berfungsi dengan baik, dapat mengetahui informasi lengkap kapal lain disekitar kapal kita yang juga ada instalasi AIS'
  },
  {
    itemNo: 7,
    question:
      'VHF Radio berfungsi dengan baik, dapat berkomunikasi antar kapal maupun dengan stasiun lain dengan jarak tertentu.'
  },
  {
    itemNo: 8,
    question:
      'Rudder Indicator berfungsi dengan baik, dapat menunjukan dan memperlihatkan sudut/derajat yang di kemudikan'
  },
  {
    itemNo: 9,
    question:
      'Magnetic Compass berfungsi baik, dapat menunjuk arah kapal saat berlayar'
  },
  {
    itemNo: 10,
    question:
      'Radio HT berfungsi dengan baik, dapat berkomunikasi antara kapal dengan tongkang maupun dengan stasiun/jetty lain dengan jarak tertentu.'
  },
  {
    itemNo: 11,
    question:
      'Joy stick & Kemudi berfungsi baik, dapat digunakan dengan baik untuk maneuver kapal.'
  },
  {
    itemNo: 12,
    question:
      'RADIO SSB berfungsi baik, dapat digunakan dengan baik untuk berkomunikasi jarak jauh'
  },
  {
    itemNo: 13,
    question: 'ECDIS NF430 SAMYUNG'
  },
  {
    itemNo: 14,
    question: 'NAVTEX'
  }
] as const

export const navigationInspectionItemNumbers =
  navigationInspectionChecklist.map((item) => item.itemNo) as number[]

export const getNavigationInspectionQuestion = (itemNo: number) =>
  navigationInspectionChecklist.find((item) => item.itemNo === itemNo)?.question
