import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  NotFound,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getConfig } from "@landscrape/config";

const config = getConfig();

export const artifactStorage = new S3Client({
  region: config.storageRegion,
  endpoint: config.storageEndpoint,
  forcePathStyle: config.storageForcePathStyle,
  credentials: {
    accessKeyId: config.storageAccessKey,
    secretAccessKey: config.storageSecretKey,
  },
});

let bucketReadyPromise: Promise<void> | null = null;

function isBucketNotFound(err: unknown): boolean {
  if (err instanceof NotFound) return true;
  if (err instanceof S3ServiceException) {
    if (err.name === "NotFound" || err.name === "NoSuchBucket") return true;
    const status = (err as S3ServiceException).$metadata?.httpStatusCode;
    if (status === 404) return true;
  }
  return false;
}

export async function ensureArtifactBucket(): Promise<void> {
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    try {
      await artifactStorage.send(new HeadBucketCommand({ Bucket: config.storageBucket }));
    } catch (err) {
      if (!isBucketNotFound(err)) {
        throw new Error(
          `ensureArtifactBucket: HeadBucket on '${config.storageBucket}' failed non-404: ${(err as Error).message}`
        );
      }
      await artifactStorage.send(new CreateBucketCommand({ Bucket: config.storageBucket }));
    }
  })();

  return bucketReadyPromise;
}

export interface StoredArtifact {
  storageKey: string;
  storageUrl: string;
  contentType: string;
  byteSize: number;
}

export async function uploadArtifact(storageKey: string, body: Buffer | string, contentType: string): Promise<StoredArtifact> {
  await ensureArtifactBucket();
  const buffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  await artifactStorage.send(
    new PutObjectCommand({
      Bucket: config.storageBucket,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const normalizedBaseUrl = config.storagePublicBaseUrl.replace(/\/$/, "");
  return {
    storageKey,
    storageUrl: `${normalizedBaseUrl}/${config.storageBucket}/${storageKey}`,
    contentType,
    byteSize: buffer.byteLength,
  };
}
