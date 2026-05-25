import express from 'express'
import { downloadPrivateBlobFile } from '../controllers/fileController'

const router = express.Router()

router.get('/download', downloadPrivateBlobFile)

export default router
