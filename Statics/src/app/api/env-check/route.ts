import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/** Returns config values in use (all hardcoded). No process.env read. */
export async function GET() {
  return NextResponse.json({
    hardcoded: true,
    configUsed: {
      cognitoUserPoolId: config.cognito.userPoolId,
      cognitoClientId: config.cognito.userPoolWebClientId,
      cognitoRegion: config.cognito.region,
      awsRegion: config.aws.region,
      awsAccessKeyIdSet: !!config.aws.accessKeyId,
      awsSecretAccessKeySet: !!config.aws.secretAccessKey,
    },
  });
}
