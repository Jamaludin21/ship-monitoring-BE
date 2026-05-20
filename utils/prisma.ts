import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL belum diatur!");
}

// Inisialisasi pool koneksi database
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Masukkan adapter ke konstruktor PrismaClient
const prisma = new PrismaClient({ adapter });

export default prisma;