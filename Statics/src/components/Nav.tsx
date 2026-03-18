"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState, useRef, useEffect } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard", protected: true },
  { href: "/profile", label: "Profile", protected: true },
  { href: "/admin", label: "Admin", admin: true },
];

const AUTH_PATH_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/confirm-email"];

function isAuthRoute(pathname: string) {
  return AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, signOut, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLNavElement>(null);

  /** Only show Dashboard / Profile / Sign out after session is validated — not while token exists but API hasn’t replied yet. */
  const isAuthed = !loading && !!session;
  const sessionPending = loading;

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [mobileOpen]);

  const visibleLinks = navLinks.filter((link) => {
    if (link.protected && !isAuthed) return false;
    if (link.admin && !isAdmin()) return false;
    if (pathname === "/dashboard" && link.href === "/dashboard") return false;
    if (pathname === "/profile" && link.href === "/profile") return false;
    return true;
  });

  /** Logo already goes home; avoid “Home | Log in | Home” on login/signup. */
  const desktopPrimaryLinks =
    pathname === "/login" || pathname === "/signup"
      ? visibleLinks.filter((l) => l.href !== "/")
      : visibleLinks;

  const onNavLinkClick = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  const authPage = isAuthRoute(pathname);

  return (
    <nav ref={panelRef} className="sticky top-0 z-50 border-b border-white/10 bg-surface/95 backdrop-blur-md safe-top">
      <div className="mx-auto flex min-h-14 md:min-h-16 max-w-6xl xl:max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:py-0 md:h-16">
        <Link
          href="/"
          className="text-lg md:text-xl font-semibold text-white min-h-[44px] min-w-[44px] flex items-center shrink-0 py-2 -ml-1 px-1 rounded-md hover:text-brand transition-colors"
        >
          Statics
        </Link>

        <div className="hidden md:flex flex-1 flex-wrap items-center justify-end gap-2 min-w-0 sm:min-w-[200px]">
          {desktopPrimaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              className={`text-sm lg:text-base min-h-[44px] min-w-[44px] flex items-center justify-center px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                pathname === link.href
                  ? "text-brand bg-brand-muted"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {desktopPrimaryLinks.length > 0 && (
            <span className="hidden sm:block w-px h-6 bg-white/10 shrink-0" aria-hidden />
          )}
          {sessionPending ? (
            <span className="text-sm text-gray-500 min-h-[44px] flex items-center px-3" aria-live="polite">
              …
            </span>
          ) : isAuthed ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm lg:text-base text-gray-400 hover:text-white min-h-[44px] px-4 py-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
            >
              Sign out
            </button>
          ) : authPage ? (
            pathname === "/signup" ? (
              <Link
                href="/login"
                className="rounded-lg bg-brand min-h-[44px] px-5 py-2.5 flex items-center text-sm lg:text-base font-medium text-white hover:bg-brand-hover transition-colors shrink-0"
              >
                Log in
              </Link>
            ) : pathname === "/login" ? (
              <Link
                href="/signup"
                className="rounded-lg bg-brand min-h-[44px] px-5 py-2.5 flex items-center text-sm lg:text-base font-medium text-white hover:bg-brand-hover transition-colors shrink-0"
              >
                Sign up
              </Link>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/login"
                  className="text-sm lg:text-base text-gray-400 hover:text-white min-h-[44px] px-4 py-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand min-h-[44px] px-5 py-2.5 flex items-center text-sm lg:text-base font-medium text-white hover:bg-brand-hover transition-colors shrink-0"
                >
                  Sign up
                </Link>
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/login"
                className="text-sm lg:text-base text-gray-400 hover:text-white min-h-[44px] px-4 py-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand min-h-[44px] px-5 py-2.5 flex items-center text-sm lg:text-base font-medium text-white hover:bg-brand-hover transition-colors shrink-0"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {sessionPending ? (
            <span className="text-sm text-gray-500 px-1" aria-hidden>
              …
            </span>
          ) : isAuthed ? (
            pathname === "/dashboard" ? (
              <Link href="/profile" prefetch className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2">
                Profile
              </Link>
            ) : (
              <Link href="/dashboard" prefetch className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-2">
                Dashboard
              </Link>
            )
          ) : authPage ? (
            pathname === "/signup" ? (
              <Link href="/login" className="rounded-lg bg-brand px-3 py-2 min-h-[40px] flex items-center text-sm font-medium text-white">
                Log in
              </Link>
            ) : (
              <Link href="/signup" className="rounded-lg bg-brand px-3 py-2 min-h-[40px] flex items-center text-sm font-medium text-white">
                Sign up
              </Link>
            )
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

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-surface-elevated/98 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {visibleLinks.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => onNavLinkClick(link.href)}
              className={`text-sm min-touch flex items-center px-3 py-2.5 rounded-lg text-left w-full ${
                pathname === link.href ? "text-brand bg-brand-muted" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {link.label}
            </button>
          ))}
          {!isAuthed && !sessionPending && pathname !== "/login" && (
            <button
              type="button"
              onClick={() => onNavLinkClick("/login")}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5 text-left w-full"
            >
              Log in
            </button>
          )}
          {!isAuthed && !sessionPending && pathname !== "/signup" && (
            <button
              type="button"
              onClick={() => onNavLinkClick("/signup")}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5 text-left w-full"
            >
              Sign up
            </button>
          )}
          {isAuthed && (
            <button
              type="button"
              onClick={() => {
                signOut();
                setMobileOpen(false);
              }}
              className="text-sm text-gray-400 hover:text-white min-touch flex items-center px-3 py-2.5 rounded-lg hover:bg-white/5 text-left w-full"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
