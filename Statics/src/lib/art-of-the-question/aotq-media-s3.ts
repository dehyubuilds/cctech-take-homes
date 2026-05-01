import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "@/lib/config";

/** Prefer `config.artOfTheQuestion.mediaBucket` (Statics pattern); env overrides remain for local tooling. */
export function aotqMediaBucket(): string | null {
  const fromConfig = config.artOfTheQuestion.mediaBucket?.trim();
  if (fromConfig) return fromConfig;
  return (
    process.env.AOTQ_MEDIA_BUCKET?.trim() ||
    process.env.S3_BUCKET_NAME?.trim() ||
    process.env.STATICS_AOTQ_MEDIA_BUCKET?.trim() ||
    null
  );
}

function s3Client(): S3Client {
  const region = config.dynamo.region;
  return new S3Client({
    region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
}

export async function putAotqTranscriptJson(
  key: string,
  body: string
): Promise<{ bucket: string; key: string } | null> {
  const bucket = aotqMediaBucket();
  if (!bucket) return null;
  const client = s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(body, "utf8"),
      ContentType: "application/json; charset=utf-8",
      ServerSideEncryption: "AES256",
    })
  );
  return { bucket, key };
}

type TranscriptJsonPayload = {
  plainText?: string;
};

/**
 * Load full timed transcript text written by {@link putAotqTranscriptJson} (JSON with `plainText`).
 * Used when Dynamo holds `transcriptS3Key` but not inline `transcriptText`.
 */
export async function getAotqTranscriptPlainTextFromS3(key: string): Promise<string | null> {
  const bucket = aotqMediaBucket();
  if (!bucket) return null;
  const client = s3Client();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const raw = await res.Body?.transformToString();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TranscriptJsonPayload;
    const plain = parsed.plainText;
    return typeof plain === "string" && plain.length > 0 ? plain : null;
  } catch {
    return null;
  }
}
