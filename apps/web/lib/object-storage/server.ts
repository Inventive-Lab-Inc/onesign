import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getObjectStorageServerConfig, type ObjectStorageServerConfig } from "./env";

let cachedClient: S3Client | null | undefined;

function getClient(): S3Client {
  if (cachedClient !== undefined) return cachedClient!;

  const config = getObjectStorageServerConfig();
  if (!config) {
    cachedClient = null;
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY.",
    );
  }

  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  return cachedClient;
}

function requireConfig(): ObjectStorageServerConfig {
  const config = getObjectStorageServerConfig();
  if (!config) {
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY.",
    );
  }
  return config;
}

export function assertOwnerStoragePath(ownerId: string, storagePath: string): void {
  const normalized = storagePath.replace(/^\/+/, "");
  const prefix = `${ownerId}/`;
  if (!normalized.startsWith(prefix) || normalized.includes("..")) {
    throw new Error("Invalid storage path for this user.");
  }
}

export async function putMediaObject(
  ownerId: string,
  storagePath: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=86400",
): Promise<void> {
  assertOwnerStoragePath(ownerId, storagePath);
  const config = requireConfig();
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.mediaBucket,
      Key: storagePath.replace(/^\/+/, ""),
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function deleteMediaObject(ownerId: string, storagePath: string): Promise<void> {
  assertOwnerStoragePath(ownerId, storagePath);
  const config = requireConfig();
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.mediaBucket,
      Key: storagePath.replace(/^\/+/, ""),
    }),
  );
}

function assertOwnerStoragePrefix(ownerId: string, prefix: string): string {
  const normalized = prefix.replace(/^\/+/, "");
  const ownerPrefix = `${ownerId}/`;
  if (!normalized.startsWith(ownerPrefix) || normalized.includes("..")) {
    throw new Error("Invalid storage prefix for this user.");
  }
  return normalized;
}

/** Deletes every object under `prefix`, optionally keeping one key (e.g. the newly uploaded file). */
export async function deleteMediaObjectsUnderPrefix(
  ownerId: string,
  prefix: string,
  keepStoragePath?: string | null,
): Promise<void> {
  const normalizedPrefix = assertOwnerStoragePrefix(ownerId, prefix);
  const keepKey = keepStoragePath?.replace(/^\/+/, "") ?? null;
  const config = requireConfig();
  const client = getClient();

  let continuationToken: string | undefined;
  do {
    const listing = await client.send(
      new ListObjectsV2Command({
        Bucket: config.mediaBucket,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of listing.Contents ?? []) {
      const key = object.Key;
      if (!key || key === keepKey) continue;
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.mediaBucket,
          Key: key,
        }),
      );
    }

    continuationToken = listing.NextContinuationToken;
  } while (continuationToken);
}

export async function headMediaObjectSize(ownerId: string, storagePath: string): Promise<number | null> {
  assertOwnerStoragePath(ownerId, storagePath);
  const config = requireConfig();
  const client = getClient();

  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: config.mediaBucket,
        Key: storagePath.replace(/^\/+/, ""),
      }),
    );
    return typeof result.ContentLength === "number" ? result.ContentLength : null;
  } catch {
    return null;
  }
}
