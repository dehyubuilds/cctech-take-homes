"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SessionUser } from "@/lib/services";

type AuthContextValue = {
  session: SessionUser | null;
  loading: boolean;
  setSession: (s: SessionUser | null) => void;
  signOut: () => void;
  isAdmin: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "statics-session-token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((s: SessionUser | null) => {
    setSessionState(s);
  }, []);

  const signOut = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    }
    setSessionState(null);
  }, []);

  const isAdmin = useCallback(() => {
    return session?.role === "admin" || session?.email?.toLowerCase() === "dehyu.sinyan@gmail.com";
  }, [session]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem(SESSION_KEY);
        }
        return null;
      })
      .then((data) => {
        if (data?.user) setSessionState(data);
        else setSessionState(null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        setSession,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, token);
}
