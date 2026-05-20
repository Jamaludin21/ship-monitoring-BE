import express from 'express'
const cors = require('cors') as any
import multer from 'multer'
import { login } from './controllers/authController'
import { uploadDocument } from './controllers/uploadController'
import {
  updateLocation,
  getAllShipLocations
} from './controllers/locationController'

const app = express()
const upload = multer({ storage: multer.memoryStorage() }) // Setup multer untuk memory

app.use(cors())
app.use(express.json()) // Agar bisa membaca body JSON (untuk login)

/// ==========================================
// DAFTAR ROUTES API
// ==========================================

// 1. Auth Routes
app.post('/api/auth/login', login)

// 2. Upload Routes
app.post('/api/upload/document', upload.single('document'), uploadDocument)

// 3. Location Routes
app.post('/api/location/update', updateLocation) // Dipanggil Nahkoda tiap 15 detik
app.get('/api/location/ships', getAllShipLocations) // Dipanggil Manager tiap 10 detik

// PERUBAHAN UNTUK VERCEL SERVERLESS
// Vercel akan otomatis mengatur NODE_ENV menjadi 'production'
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`✅ Server berjalan di http://localhost:${PORT}`)
  })
}

// WAJIB DIEKSPOR UNTUK VERCEL
export default app
