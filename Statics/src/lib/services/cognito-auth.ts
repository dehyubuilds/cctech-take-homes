import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getUserRepository } from "@/lib/repositories";
import type { User } from "@/lib/domain";
import { ADMIN_EMAIL } from "@/lib/seed-data";
import type { SessionUser } from "./auth-types";

const AUTH_LOG = (op: "signIn" | "signUp", msg: string, data?: Record<string, unknown>) => {
  console.log("[Statics Auth] cognito", op, msg, data ?? "");
};

const COGNITO_REGION = "us-east-1";
const COGNITO_USER_POOL_ID = "us-east-1_slQDFliti";
const COGNITO_CLIENT_ID = "4pp9aeol19sug0i4rk8fvddcq1";
const AWS_ACCESS_KEY_ID = "AKIASCPOEM7JYLK5BJFR";
const AWS_SECRET_ACCESS_KEY = "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";

let cognitoClient: CognitoIdentityProviderClient | null = null;

function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({
      region: COGNITO_REGION,
      credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
    });
  }
  return cognitoClient;
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: COGNITO_USER_POOL_ID,
      tokenUse: "id",
      clientId: COGNITO_CLIENT_ID,
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

  try {
    await getCognitoClient().send(
      new AdminGetUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: claims.sub,
      })
    );
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (name === "UserNotFoundException") {
      return null;
    }
    throw err;
  }

  const userRepo = getUserRepository();
  let user = await userRepo.getById(claims.sub);
  if (!user && claims.email) {
    user = await userRepo.getByEmail(claims.email);
  }
  if (!user) {
    const email = (claims.email?.toLowerCase() ?? "").trim() || `unknown-${claims.sub}@statics.local`;
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    user = {
      userId: claims.sub,
      email,
      phoneVerified: false,
      role: isAdmin ? "admin" : "user",
      smsStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
): Promise<{ token: string; user: User } | { error: string; detail?: string }> {
  AUTH_LOG("signIn", "entry", { region: COGNITO_REGION, userPoolId: COGNITO_USER_POOL_ID, clientId: COGNITO_CLIENT_ID });
  try {
    const { AuthenticationResult } = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: COGNITO_CLIENT_ID,
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
    const name = err && typeof err === "object" && "name" in err
      ? (err as { name: string }).name
      : "";
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : "";
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      return { error: "Invalid email or password" };
    }
    if (name === "UserNotConfirmedException") {
      return { error: "Please confirm your email before signing in. Check your inbox for a verification code from Statics." };
    }
    if (name === "InvalidParameterException" && msg.includes("phone number")) {
      return {
        error:
          "This Cognito User Pool is set up for phone-number sign-in. Statics uses email. Use a User Pool with “Email” as the sign-in option ",
      };
    }
    if (name === "InvalidParameterException" && msg.includes("USER_PASSWORD_AUTH")) {
      return {
        error:
          "Enable USER_PASSWORD_AUTH on the app client: AWS Console → Cognito → User Pools → your pool → App integration → App client → Edit → Authentication flows → check “ALLOW_USER_PASSWORD_AUTH” → Save.",
      };
    }
    if (name === "ResourceNotFoundException") {
      return {
        error:
          "Cognito User Pool or App Client not found. The pool and client must exist in the same AWS account as the server credentials.",
      };
    }
    const isCredsError =
      name === "CredentialsError" ||
      name === "UnrecognizedClientException" ||
      name === "InvalidClientTokenId" ||
      msg.includes("security token") ||
      msg.includes("credentials") ||
      (msg.includes("invalid") && msg.includes("token"));
    if (isCredsError) {
      console.error("[Statics Auth] cognito signIn credentials error", { name, msg, err: String(err) });
      return {
        error:
          "Sign-in failed: invalid or missing AWS credentials. Ensure the IAM key is active and in the same account as the Cognito pool.",
      };
    }
    console.error("[Statics Auth] cognito signIn unexpected", { name, msg, err: String(err) });
    const detail = [name, msg].filter(Boolean).join(": ") || String(err);
    return { error: "Sign in failed", detail };
  }
}

export async function signUpWithCognito(
  email: string,
  password: string
): Promise<{ userId: string } | { error: string; detail?: string }> {
  AUTH_LOG("signUp", "entry", { region: COGNITO_REGION, userPoolId: COGNITO_USER_POOL_ID, clientId: COGNITO_CLIENT_ID });
  try {
    const { UserSub } = await getCognitoClient().send(
      new SignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email.trim().toLowerCase() },
          { Name: "preferred_username", Value: email.trim().toLowerCase() },
        ],
      })
    );
    AUTH_LOG("signUp", "Cognito success", { userId: UserSub ?? "" });
    return { userId: UserSub ?? "" };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err
      ? (err as { name: string }).name
      : "";
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : "";
    if (name === "UsernameExistsException") {
      return { error: "Email already registered" };
    }
    if (name === "InvalidPasswordException") {
      return { error: "Password does not meet requirements." };
    }
    if (name === "InvalidParameterException" && msg.includes("password")) {
      return { error: "Password does not meet requirements." };
    }
    if (name === "InvalidParameterException" && msg.includes("phone number")) {
      return {
        error:
          "This Cognito User Pool is set up for phone-number sign-in. Statics uses email. Create a new User Pool in AWS Cognito with “Email” as the sign-in option ",
      };
    }
    if (name === "ResourceNotFoundException") {
      return {
        error:
          "Cognito User Pool or App Client not found. The pool and client must exist in the same AWS account as the server credentials.",
      };
    }
    const isCredsError =
      name === "CredentialsError" ||
      name === "UnrecognizedClientException" ||
      msg.includes("credentials") ||
      msg.includes("Unable to load") ||
      msg.includes("security token") ||
      msg.includes("invalid");
    if (isCredsError) {
      console.error("[Statics Auth] cognito signUp credentials error", { name, msg, err: String(err) });
      return {
        error:
          "Sign up failed: invalid or missing AWS credentials.",
      };
    }
    console.error("[Statics Auth] cognito signUp unexpected", { name, msg, err: String(err) });
    const detail = [name, msg].filter(Boolean).join(": ") || String(err);
    return { error: "Sign up failed. Try again or contact support.", detail };
  }
}

export async function confirmSignUpWithCognito(
  email: string,
  code: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await getCognitoClient().send(
      new ConfirmSignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
      })
    );
    return { ok: true };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
    if (name === "CodeMismatchException") return { error: "Invalid or expired code. Try again or request a new code." };
    if (name === "ExpiredCodeException") return { error: "Code expired. Request a new code below." };
    if (name === "UserNotFoundException") return { error: "No account found for this email." };
    console.error("[Statics Auth] cognito confirmSignUp", { name, msg, err: String(err) });
    return { error: "Confirmation failed. Try again or request a new code." };
  }
}

export async function resendConfirmationCodeWithCognito(email: string): Promise<{ ok: true } | { error: string }> {
  try {
    await getCognitoClient().send(
      new ResendConfirmationCodeCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
      })
    );
    return { ok: true };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
    console.error("[Statics Auth] cognito resendCode", { name, msg, err: String(err) });
    if (name === "UserNotFoundException") return { error: "No account found for this email." };
    if (name === "LimitExceededException") return { error: "Too many attempts. Please try again in a few minutes." };
    if (name === "InvalidParameterException" && /already confirmed/i.test(msg))
      return { error: "This account is already confirmed. Try signing in." };
    if (name === "CodeDeliveryFailureException")
      return { error: "We couldn't send the verification email. Check your email address and spam folder, or try again in a few minutes." };
    if (name === "InvalidParameterException" && /auto verification not turned on/i.test(msg))
      return { error: "Resend is not available for this account. Check your spam for the original code, or try signing in if you already confirmed." };
    if (name === "InvalidParameterException") return { error: msg || "Invalid request. Try signing in if you already confirmed." };
    return { error: msg ? `Could not resend code: ${msg}` : "Could not resend code. Try again later." };
  }
}

export async function forgotPasswordWithCognito(email: string): Promise<{ ok: true } | { error: string }> {
  try {
    await getCognitoClient().send(
      new ForgotPasswordCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
      })
    );
    return { ok: true };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
    console.error("[Statics Auth] cognito forgotPassword", { name, msg, err: String(err) });
    if (name === "UserNotFoundException") return { error: "No account found for this email." };
    if (name === "LimitExceededException") return { error: "Too many attempts. Please try again in a few minutes." };
    if (name === "CodeDeliveryFailureException")
      return { error: "We couldn't send the reset code. Check your email address and spam folder." };
    return { error: msg || "Could not send reset code. Try again later." };
  }
}

export async function confirmForgotPasswordWithCognito(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await getCognitoClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
        Password: newPassword,
      })
    );
    return { ok: true };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
    console.error("[Statics Auth] cognito confirmForgotPassword", { name, msg, err: String(err) });
    if (name === "CodeMismatchException") return { error: "Invalid or expired code. Request a new code." };
    if (name === "ExpiredCodeException") return { error: "Code expired. Please request a new reset code." };
    if (name === "InvalidPasswordException")
      return { error: "Password does not meet requirements (e.g. 8+ chars, upper, lower, number)." };
    if (name === "UserNotFoundException") return { error: "No account found for this email." };
    return { error: msg || "Could not reset password. Try again." };
  }
}
