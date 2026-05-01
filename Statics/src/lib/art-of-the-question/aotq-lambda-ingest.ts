import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { config } from "@/lib/config";

/**
 * Optional async ingest (yt-dlp / Whisper in a container Lambda). When unset, ingest runs in the API route or EC2 worker.
 */
export function getAotqMediaIngestFunctionName(): string | null {
  const fromConfig = config.artOfTheQuestion.mediaIngestFunctionName?.trim();
  if (fromConfig) return fromConfig;
  return process.env.AOTQ_MEDIA_INGEST_FUNCTION?.trim() || null;
}

export async function invokeAotqMediaIngestAsync(payload: {
  projectId: string;
  sourceId: string;
  userId: string;
  youtubeUrl: string;
  videoId: string;
  tableName: string;
}): Promise<boolean> {
  const fn = getAotqMediaIngestFunctionName();
  if (!fn) return false;
  const client = new LambdaClient({
    region: config.dynamo.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  await client.send(
    new InvokeCommand({
      FunctionName: fn,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(payload), "utf8"),
    })
  );
  return true;
}
