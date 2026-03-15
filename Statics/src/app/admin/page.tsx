"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";
import type { App } from "@/lib/domain";

export default function AdminDashboardPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    fetch("/api/admin/apps", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(async (data) => {
        const list = data.apps || [];
        setApps(list);
        const c: Record<string, number> = {};
        for (const app of list) {
          const subRes = await fetch(`/api/admin/apps/${app.appId}/subscribers`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const subData = await subRes.json();
          c[app.appId] = subData.count ?? 0;
        }
        setCounts(c);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Admin</h1>
      <p className="mt-1 text-gray-400">Manage apps, users, and share metadata.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <div
            key={app.appId}
            className="rounded-xl border border-white/10 bg-surface-elevated p-4"
          >
            <h2 className="font-medium text-white">{app.name}</h2>
            <p className="mt-1 text-sm text-gray-400">{app.slug}</p>
            <p className="mt-2 text-sm text-brand">
              {counts[app.appId] ?? 0} subscribers
            </p>
            <Link
              href={`/admin/apps/${app.appId}`}
              className="mt-3 inline-block text-sm text-gray-400 hover:text-white"
            >
              Edit app →
            </Link>
          </div>
        ))}
      </div>
      <Link
        href="/admin/apps"
        className="mt-8 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
      >
        Manage apps
      </Link>
    </div>
  );
}
