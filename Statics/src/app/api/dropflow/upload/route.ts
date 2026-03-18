import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";
import { config } from "@/lib/config";

const S3_ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const S3_ACCEPTED_AUDIO = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/webm",
  "audio/opus",
  "audio/x-ms-wma",
];

/** POST: get presigned URL for Dropflow thumbnail or track upload. Body: { type: "thumbnail" | "track", contentType, fileName? }. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const type = (body.type as string)?.toLowerCase();
  const contentType = (body.contentType as string) || "";
  const fileName = (body.fileName as string) || "";

  if (type !== "thumbnail" && type !== "track") {
    return NextResponse.json(
      { error: "type must be thumbnail or track" },
      { status: 400 }
    );
  }

  const isImage = type === "thumbnail" && S3_ACCEPTED_IMAGE.some((t) => contentType.toLowerCase().includes(t));
  const isAudio =
    type === "track" &&
    (contentType.toLowerCase().startsWith("audio/") || S3_ACCEPTED_AUDIO.some((t) => contentType.toLowerCase().includes(t)));
  if (!isImage && !isAudio) {
    return NextResponse.json(
      {
        error:
          type === "thumbnail"
            ? "Thumbnail must be image (jpeg, png, gif, webp)"
            : "Track must be audio (m4a, mp3, wav, ogg, aac, flac, webm, opus, wma)",
      },
      { status: 400 }
    );
  }

  const bucket = config.dropflow.bucket;
  const region = config.dynamo.region;
  const baseUrl = config.dropflow.baseUrl;
  const ts = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const ext =
    type === "thumbnail"
      ? contentType.includes("png")
        ? "png"
        : contentType.includes("gif")
          ? "gif"
          : contentType.includes("webp")
            ? "webp"
            : "jpg"
      : fileName.match(/\.(m4a|mp3|wav|ogg|aac|flac|webm|opus|wma)$/i)?.[1]?.toLowerCase() ||
        (contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "m4a");
  const key =
    type === "thumbnail"
      ? `thumbnails/${ts}-${suffix}.${ext}`
      : `tracks/${ts}-${suffix}.${ext}`;

  try {
    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || (type === "thumbnail" ? "image/jpeg" : "audio/mpeg"),
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
    const fileUrl = baseUrl ? `${baseUrl}/${key}` : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, fileUrl, key });
  } catch (e) {
    console.error("dropflow upload", e);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
