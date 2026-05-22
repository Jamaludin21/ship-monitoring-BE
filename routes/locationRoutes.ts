import express from 'express'
import {
  getAllShipLocations,
  updateLocation
} from '../controllers/locationController'
import { authenticate } from '../middlewares/authMiddleware'
import { authorizeRoles } from '../middlewares/roleMiddleware'

const router = express.Router()

router.post('/update', authenticate, authorizeRoles('NAHKODA'), updateLocation)

router.get(
  '/ships',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER'),
  getAllShipLocations
)

export default router
