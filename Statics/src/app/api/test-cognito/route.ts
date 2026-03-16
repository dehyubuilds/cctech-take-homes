import { NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Minimal test: call Cognito with literals only. No config, no shared code.
 * GET /api/test-cognito → calls InitiateAuth with wrong password.
 * If result is "NotAuthorized" = Cognito is reachable (good). If "ResourceNotFound" = credentials/pool wrong in this env.
 */
export async function GET() {
  const client = new CognitoIdentityProviderClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: "AKIASCPOEM7JYLK5BJFR",
      secretAccessKey: "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",
    },
  });
  try {
    await client.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: "4pp9aeol19sug0i4rk8fvddcq1",
        AuthParameters: {
          USERNAME: "dehyu.sinyan@gmail.com",
          PASSWORD: "WrongPasswordToTest",
        },
      })
    );
    return NextResponse.json({ result: "unexpected-success" });
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
    return NextResponse.json(
      { result: name === "NotAuthorizedException" ? "cognito-reachable" : "error", name, message: msg },
      { status: 200 }
    );
  }
}
