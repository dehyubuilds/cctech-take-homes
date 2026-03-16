import type { User } from "@/lib/domain";
import { ADMIN_EMAIL } from "@/lib/seed-data";
import {
  getSessionUserFromToken,
  signInWithCognito,
  signUpWithCognito,
  confirmSignUpWithCognito,
  resendConfirmationCodeWithCognito,
  forgotPasswordWithCognito,
  confirmForgotPasswordWithCognito,
} from "./cognito-auth";
import type { SessionUser } from "./auth-types";

export type { SessionUser } from "./auth-types";

/** Real only: Cognito for auth. No mocks. */
export function getAuthService() {
  return {
    async getSessionUser(token: string | null): Promise<SessionUser | null> {
      if (!token) return null;
      return getSessionUserFromToken(token);
    },

    async signIn(
      email: string,
      password: string
    ): Promise<{ token: string; user: User } | { error: string }> {
      return signInWithCognito(email, password);
    },

    async signUp(
      email: string,
      password: string
    ): Promise<{ userId: string } | { error: string }> {
      return signUpWithCognito(email, password);
    },

    async confirmSignUp(email: string, code: string): Promise<{ ok: true } | { error: string }> {
      return confirmSignUpWithCognito(email, code);
    },

    async resendConfirmationCode(email: string): Promise<{ ok: true } | { error: string }> {
      return resendConfirmationCodeWithCognito(email);
    },

    async forgotPassword(email: string): Promise<{ ok: true } | { error: string }> {
      return forgotPasswordWithCognito(email);
    },

    async confirmForgotPassword(
      email: string,
      code: string,
      newPassword: string
    ): Promise<{ ok: true } | { error: string }> {
      return confirmForgotPasswordWithCognito(email, code, newPassword);
    },

    signOut(_token: string | null): void {
      /* Cognito: client clears token; no server session to delete */
    },

    isAdmin(session: SessionUser | null): boolean {
      return (
        session?.role === "admin" ||
        session?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
    },
  };
}
