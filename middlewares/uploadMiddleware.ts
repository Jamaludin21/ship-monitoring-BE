import multer from 'multer'

const storage = multer.memoryStorage()

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf']
  const hasPdfExtension = file.originalname.toLowerCase().endsWith('.pdf')

  if (!allowedMimeTypes.includes(file.mimetype) && !hasPdfExtension) {
    return cb(new Error('File harus berformat PDF'))
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024
  }
})

export const uploadSubmissionFiles = upload.fields([
  { name: 'sailingPermit', maxCount: 1 },
  { name: 'callSignCertificate', maxCount: 1 },
  { name: 'safetyCertificate', maxCount: 1 },
  { name: 'radioStationPermit', maxCount: 1 }
])

export const uploadArrivalInspectionFiles = upload.fields([
  { name: 'inspectionDocument', maxCount: 1 },
  { name: 'responseLetter', maxCount: 1 }
])

export const uploadAdminVerificationFile = upload.single('verificationDocument')

export const uploadManagerValidationFile = upload.single('validationDocument')
