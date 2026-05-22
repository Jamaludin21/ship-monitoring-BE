import { UploadApiResponse } from 'cloudinary'
import cloudinary from '../utils/cloudinary'

const assertCloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary environment variables are required')
  }
}

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder = 'ship-monitoring/submissions'
): Promise<string> => {
  assertCloudinaryConfig()

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true
      },
      (error, result?: UploadApiResponse) => {
        if (error) {
          reject(error)
          return
        }

        if (!result?.secure_url) {
          reject(new Error('Cloudinary tidak mengembalikan URL file'))
          return
        }

        resolve(result.secure_url)
      }
    )

    uploadStream.end(file.buffer)
  })
}
