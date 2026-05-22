import express from 'express'
import { getMyShips, getShips } from '../controllers/shipController'
import { authenticate } from '../middlewares/authMiddleware'
import { authorizeRoles } from '../middlewares/roleMiddleware'

const router = express.Router()

router.get('/', authenticate, authorizeRoles('ADMIN', 'MANAGER'), getShips)
router.get('/my', authenticate, authorizeRoles('NAHKODA'), getMyShips)

export default router
