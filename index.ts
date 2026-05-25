import './utils/env'
import express from 'express'
import authRoutes from './routes/authRoutes'
import fileRoutes from './routes/fileRoutes'
import locationRoutes from './routes/locationRoutes'
import shipRoutes from './routes/shipRoutes'
import submissionRoutes from './routes/submissionRoutes'
import { errorMiddleware, notFoundHandler } from './middlewares/errorMiddleware'
import { requestLogger } from './middlewares/requestLoggerMiddleware'

const cors = require('cors') as any
const app = express()

app.set('trust proxy', 1)

app.use(cors())
app.use(requestLogger)
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)
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
