"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!session || !isAdmin()) {
      router.replace("/login");
      return;
    }
  }, [session, loading, isAdmin, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!isAdmin()) {
    return null;
  }

  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/apps", label: "Apps" },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 xl:max-w-7xl">
      <div className="mb-8 flex items-center gap-6 border-b border-white/10 pb-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium ${
              pathname === link.href ? "text-brand" : "text-gray-400 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
