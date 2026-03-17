"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState, useRef, useEffect } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard", protected: true },
  { href: "/profile", label: "Profile", protected: true },
  { href: "/admin", label: "Admin", admin: true },
];

export function Nav() {
  const pathname = usePathname();
  const { session, loading, signOut, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [mobileOpen]);

  const visibleLinks = navLinks.filter((link) => {
    if (link.protected && !session) return false;
    if (link.admin && !isAdmin()) return false;
    // When on dashboard show Profile (not Dashboard); when on profile show Dashboard (not Profile)
    if (pathname === "/dashboard" && link.href === "/dashboard") return false;
    if (pathname === "/profile" && link.href === "/profile") return false;
    return true;
  });

  // While auth is loading, treat as logged-in for nav so we never flash Sign up / Log in
  const showLoggedOutAuth = !loading && !session;

  return (
    <nav ref={panelRef} className="sticky top-0 z-50 border-b border-white/10 bg-surface/95 backdrop-blur-md safe-top">
      <div className="mx-auto flex h-14 min-h-[44px] max-w-6xl items-center justify-between px-4 gap-4">
        <Link href="/" className="text-lg font-semibold text-white min-touch flex items-center shrink-0">
          Statics
        </Link>

        {/* Desktop: links + auth inline */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm min-touch flex items-center px-3 py-2 rounded-md transition-colors ${
                pathname === link.href
                  ? "text-brand bg-brand-muted"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
          {loading ? null : session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
            >
              Sign out
            </button>
          ) : showLoggedOutAuth ? pathname === "/signup" ? (
            <>
              <Link
                href="/login"
                className="rounded-lg bg-brand px-4 py-2.5 min-h-[40px] flex items-center text-sm font-medium text-white hover:bg-brand-hover transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              >
                Home
              </Link>
            </>
          ) : pathname === "/login" ? (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-4 py-2.5 min-h-[40px] flex items-center text-sm font-medium text-white hover:bg-brand-hover transition-colors"
              >
                Sign up
              </Link>
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              >
                Home
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-4 py-2.5 min-h-[40px] flex items-center text-sm font-medium text-white hover:bg-brand-hover transition-colors"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </div>

        {/* Mobile: hamburger + slide-out */}
        <div className="flex md:hidden items-center gap-2">
          {loading ? null : session ? (
            pathname === "/dashboard" ? (
              <Link
                href="/profile"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2"
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2"
              >
                Dashboard
              </Link>
            )
          ) : showLoggedOutAuth ? pathname === "/signup" ? (
            <Link
              href="/login"
              className="rounded-lg bg-brand px-3 py-2 min-h-[40px] flex items-center text-sm font-medium text-white"
            >
              Log in
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-3 py-2 min-h-[40px] flex items-center text-sm font-medium text-white"
            >
              Sign up
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="min-touch flex flex-col justify-center gap-1.5 p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-expanded={mobileOpen}
            aria-label="Menu"
          >
            <span className={`w-5 h-0.5 bg-current rounded-full transition-transform ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`w-5 h-0.5 bg-current rounded-full transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`w-5 h-0.5 bg-current rounded-full transition-transform ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-surface-elevated/98 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`text-sm min-touch flex items-center px-3 py-2.5 rounded-lg ${
                pathname === link.href ? "text-brand bg-brand-muted" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {showLoggedOutAuth && pathname !== "/login" && (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5"
            >
              Log in
            </Link>
          )}
          {showLoggedOutAuth && pathname !== "/signup" && (
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5"
            >
              Sign up
            </Link>
          )}
          {!loading && session && (
            <button
              type="button"
              onClick={() => {
                signOut();
                setMobileOpen(false);
              }}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5 text-left"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
