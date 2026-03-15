"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard", protected: true },
  { href: "/profile", label: "Profile", protected: true },
  { href: "/admin", label: "Admin", admin: true },
];

export function Nav() {
  const pathname = usePathname();
  const { session, signOut, isAdmin } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-surface/95 backdrop-blur safe-top">
      <div className="mx-auto flex h-14 min-h-[44px] max-w-6xl items-center justify-between px-4 gap-3">
        <Link href="/" className="text-lg font-semibold text-white min-touch flex items-center">
          Statics
        </Link>
        <div className="flex items-center gap-2 sm:gap-6">
          {navLinks.map((link) => {
            if (link.protected && !session) return null;
            if (link.admin && !isAdmin()) return null;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm min-touch flex items-center justify-center px-2 ${
                  pathname === link.href
                    ? "text-brand"
                    : "text-gray-400 hover:text-white active:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2"
            >
              Sign out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-brand px-4 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-white hover:bg-brand-hover active:bg-brand-hover"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
