import { defineConfig } from '@prisma/config'
import * as dotenv from 'dotenv'

// Paksa membaca file .env
dotenv.config({ quiet: true })

// Beri validasi agar jika .env kosong/salah, error-nya lebih jelas
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diatur di dalam file .env')
}

export default defineConfig({
  migrations: {
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
})
