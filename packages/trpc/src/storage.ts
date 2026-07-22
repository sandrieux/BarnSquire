import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Hard cap on any single uploaded object. Presigned PUT can't enforce this at
 *  upload time, so callers HeadObject after upload and reject oversize files. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB

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

/** Server-side metadata for an uploaded object; null if it does not exist.
 *  Used to verify the real content-length/type instead of trusting the client. */
export async function headObject(storageKey: string) {
  try {
    const out = await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: storageKey })
    );
    return { contentLength: out.ContentLength ?? 0, contentType: out.ContentType ?? null };
  } catch {
    return null;
  }
}

export async function deleteObject(storageKey: string) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  await getClient().send(command);
}
