import { config } from "@/lib/config";
import { getUserRepository } from "@/lib/repositories";
import type { User } from "@/lib/domain";
import { ADMIN_EMAIL } from "@/lib/seed-data";
import {
  getSessionUserFromToken,
  signInWithCognito,
  signUpWithCognito,
} from "./cognito-auth";
import type { SessionUser } from "./auth-types";

export type { SessionUser } from "./auth-types";

const userRepo = getUserRepository();

/** In-memory sessions only when Cognito is not configured (e.g. local dev). */
const GLOBAL_SESSIONS_KEY = "__staticsMockSessions" as const;
const mockSessions: Map<string, SessionUser> =
  (typeof globalThis !== "undefined" &&
    (globalThis as Record<string, unknown>)[GLOBAL_SESSIONS_KEY]) as
    | Map<string, SessionUser>
    | undefined || new Map<string, SessionUser>();
if (typeof globalThis !== "undefined")
  (globalThis as Record<string, unknown>)[GLOBAL_SESSIONS_KEY] = mockSessions;

export function getAuthService() {
  return {
    async getSessionUser(token: string | null): Promise<SessionUser | null> {
      if (!token) return null;
      if (config.cognito.useReal) {
        return getSessionUserFromToken(token);
      }
      const session = mockSessions.get(token) ?? null;
      if (!session) return null;
      const freshUser = await userRepo.getById(session.userId);
      return freshUser ? { ...session, user: freshUser } : session;
    },

    async signIn(
      email: string,
      password: string
    ): Promise<{ token: string; user: User } | { error: string }> {
      if (config.cognito.useReal) {
        return signInWithCognito(email, password);
      }
      const user = await userRepo.getByEmail(email);
      if (!user) return { error: "User not found" };
      const session: SessionUser = {
        userId: user.userId,
        email: user.email,
        role: user.role,
        user,
      };
      const token = `mock-${user.userId}-${Date.now()}`;
      mockSessions.set(token, session);
      return { token, user };
    },

    async signUp(
      email: string,
      password: string
    ): Promise<{ userId: string } | { error: string }> {
      if (config.cognito.useReal) {
        return signUpWithCognito(email, password);
      }
      const existing = await userRepo.getByEmail(email);
      if (existing) return { error: "Email already registered" };
      const userId = `user-${Date.now()}`;
      const now = new Date().toISOString();
      const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      await userRepo.create({
        userId,
        email: email.toLowerCase(),
        phoneVerified: false,
        role: isAdmin ? "admin" : "user",
        smsStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });
      return { userId };
    },

    signOut(_token: string | null): void {
      if (!config.cognito.useReal && _token) mockSessions.delete(_token);
    },

    isAdmin(session: SessionUser | null): boolean {
      return (
        session?.role === "admin" ||
        session?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
    },
  };
}
