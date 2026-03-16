import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { config } from "@/lib/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";

/** Let the client know if S3 avatar upload is available (no auth required for check). */
export async function GET() {
  return Response.json({ configured: config.avatar.useReal });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!config.avatar.useReal) {
    return NextResponse.json(
      { error: "Avatar upload not configured." },
      { status: 503 }
    );
  }

  const bucket = config.avatar.bucket;
  const region = config.dynamo.region;
  const avatarBaseUrl = config.avatar.baseUrl;

  try {
    const body = await request.json().catch(() => ({}));
    const contentType = (body.contentType as string) || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const key = `avatars/${session.userId}/${Date.now()}.${ext}`;

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
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    const avatarUrl = avatarBaseUrl
      ? `${avatarBaseUrl}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, avatarUrl, key });
  } catch (e) {
    console.error("upload-avatar", e);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
