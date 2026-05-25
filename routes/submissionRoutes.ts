import express from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import { authorizeRoles } from '../middlewares/roleMiddleware'
import {
  uploadArrivalInspectionFiles,
  uploadSubmissionFiles
} from '../middlewares/uploadMiddleware'
import {
  getArrivalInspectionChecklist,
  getArrivalInspection,
  upsertArrivalInspection
} from '../controllers/arrivalInspectionController'
import {
  createSubmission,
  getSubmissions,
  getSubmissionDetail,
  getShipHistory,
  getMySubmissionHistory,
  approveSubmission,
  rejectSubmission
} from '../controllers/submissionController'

const router = express.Router()

router.post(
  '/',
  authenticate,
  authorizeRoles('NAHKODA'),
  uploadSubmissionFiles,
  createSubmission
)

router.get('/', authenticate, authorizeRoles('ADMIN', 'MANAGER'), getSubmissions)

router.get(
  '/my-history',
  authenticate,
  authorizeRoles('NAHKODA'),
  getMySubmissionHistory
)

router.get(
  '/arrival-inspection/checklist',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER', 'NAHKODA'),
  getArrivalInspectionChecklist
)

router.get(
  '/:id/arrival-inspection',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER', 'NAHKODA'),
  getArrivalInspection
)

router.put(
  '/:id/arrival-inspection',
  authenticate,
  authorizeRoles('ADMIN'),
  uploadArrivalInspectionFiles,
  upsertArrivalInspection
)

router.get(
  '/ship/:shipNumber/history',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER'),
  getShipHistory
)

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER', 'NAHKODA'),
  getSubmissionDetail
)

router.patch(
  '/:id/approve',
  authenticate,
  authorizeRoles('ADMIN'),
  approveSubmission
)

router.patch(
  '/:id/reject',
  authenticate,
  authorizeRoles('ADMIN'),
  rejectSubmission
)

export default router
