import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'



export default defineEventHandler(async (event) => {
  const { id, type, filename } = await readBody(event)
  console.log(id)
  console.log(type)
  console.log(filename)

  return {
    url: await createPresignedUrl(id, type, filename),
    headers: [],
    fields: [],
    method: 'PUT'
  }
})

const createPresignedUrl = async (id: string, type: string, filename: string) => {
  // Configure AWS SDK
  const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: "AKIASCPOEM7JYLK5BJFR",
      secretAccessKey: "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"
    }
  })

  // Specify the bucket name and key for the object you want to create a presigned URL for
  const bucketName = "theprivatecollection"
  const key = `${filename}`

  // Set the expiration time for the presigned URL (e.g., 1 hour from now)
  const expirationTime = 60 * 60 // 1 hour

  // Generate the presigned URL
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: id
  })

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: expirationTime
  })

  return signedUrl
}
