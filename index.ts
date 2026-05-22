import './utils/env'
import express from 'express'
import authRoutes from './routes/authRoutes'
import locationRoutes from './routes/locationRoutes'
import shipRoutes from './routes/shipRoutes'
import submissionRoutes from './routes/submissionRoutes'
import { errorMiddleware, notFoundHandler } from './middlewares/errorMiddleware'

const cors = require('cors') as any
const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/location', locationRoutes)
app.use('/api/ships', shipRoutes)
app.use('/api/submissions', submissionRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

app.use(notFoundHandler)
app.use(errorMiddleware)

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000

  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`)
  })
}

export default app
