import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    endpoint: getEnv("STORAGE_ENDPOINT"),
    region: process.env["STORAGE_REGION"] ?? "us-east-1",
    credentials: {
      accessKeyId: getEnv("STORAGE_ACCESS_KEY"),
      secretAccessKey: getEnv("STORAGE_SECRET_KEY"),
    },
    forcePathStyle: true, // required for MinIO
  });
  return cachedClient;
}

function getBucket(): string {
  return getEnv("STORAGE_BUCKET");
}

/** Presigned PUT URL the browser uses to upload directly to storage. */
export async function getPresignedUploadUrl(storageKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

/** Presigned GET URL for viewing a stored object (bucket can stay private). */
export async function getPresignedViewUrl(storageKey: string) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 3600 });
}

export async function deleteObject(storageKey: string) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  await getClient().send(command);
}
