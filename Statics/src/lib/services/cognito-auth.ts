import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { config } from "@/lib/config";
import { getUserRepository } from "@/lib/repositories";
import type { User } from "@/lib/domain";
import { ADMIN_EMAIL } from "@/lib/seed-data";
import type { SessionUser } from "./auth-types";

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.cognito.region,
});

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.cognito.userPoolId,
      tokenUse: "id",
      clientId: config.cognito.userPoolWebClientId,
    });
  }
  return verifier;
}

export async function verifyCognitoToken(token: string): Promise<{ sub: string; email?: string } | null> {
  try {
    const payload = await getVerifier().verify(token);
    const sub = payload.sub as string;
    const email = (payload.email as string) ?? (payload["cognito:username"] as string) ?? "";
    return { sub, email: email || undefined };
  } catch {
    return null;
  }
}

export async function getSessionUserFromToken(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const claims = await verifyCognitoToken(token);
  if (!claims) return null;

  const userRepo = getUserRepository();
  let user = await userRepo.getById(claims.sub);
  if (!user && claims.email) {
    user = await userRepo.getByEmail(claims.email);
  }
  if (!user) {
    const now = new Date().toISOString();
    const email = claims.email?.toLowerCase() ?? "";
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    user = {
      userId: claims.sub,
      email: email || `unknown-${claims.sub}@statics.local`,
      phoneVerified: false,
      role: isAdmin ? "admin" : "user",
      smsStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await userRepo.create(user);
  }

  return {
    userId: user.userId,
    email: user.email,
    role: user.role,
    user,
  };
}

export async function signInWithCognito(
  email: string,
  password: string
): Promise<{ token: string; user: User } | { error: string }> {
  try {
    const { AuthenticationResult } = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: config.cognito.userPoolWebClientId,
        AuthParameters: {
          USERNAME: email.trim().toLowerCase(),
          PASSWORD: password,
        },
      })
    );

    const idToken = AuthenticationResult?.IdToken;
    if (!idToken) return { error: "Sign in failed" };

    const session = await getSessionUserFromToken(idToken);
    if (!session) return { error: "Could not load user" };

    return { token: idToken, user: session.user };
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "name" in err
      ? (err as { name: string }).name
      : "SignInFailed";
    if (message === "NotAuthorizedException" || message === "UserNotFoundException") {
      return { error: "Invalid email or password" };
    }
    if (message === "UserNotConfirmedException") {
      return { error: "Please confirm your email before signing in." };
    }
    console.error("Cognito signIn", err);
    return { error: "Sign in failed" };
  }
}

export async function signUpWithCognito(
  email: string,
  password: string
): Promise<{ userId: string } | { error: string }> {
  try {
    const { UserSub } = await cognitoClient.send(
      new SignUpCommand({
        ClientId: config.cognito.userPoolWebClientId,
        Username: email.trim().toLowerCase(),
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email.trim().toLowerCase() },
          { Name: "preferred_username", Value: email.trim().toLowerCase() },
        ],
      })
    );
    return { userId: UserSub ?? "" };
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "name" in err
      ? (err as { name: string }).name
      : "";
    if (message === "UsernameExistsException") {
      return { error: "Email already registered" };
    }
    if (message === "InvalidPasswordException") {
      return { error: "Password does not meet requirements." };
    }
    console.error("Cognito signUp", err);
    return { error: "Sign up failed" };
  }
}
