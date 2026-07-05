import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
// R2_PUBLIC_URL must be your bucket's public URL, e.g.:
//   https://pub-<hash>.r2.dev  (if you enabled R2 public access)
//   https://your-custom-domain.com  (if you set a custom domain)
// Do NOT use the private S3 endpoint here — browsers can't auth against it.
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

export const uploadFile = async (key, buffer, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2.send(command);
  const url = `${PUBLIC_URL}/${key}`;
  console.log(`Uploaded: ${key} → ${url}`);
  return url;
};

export const deleteFile = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await r2.send(command);
};
