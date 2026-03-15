"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";
import type { App } from "@/lib/domain";

export default function AdminAppsPage() {
  const [apps, setApps] = useState<App[]>([]);

  const loadApps = () => {
    const token = getStoredToken();
    if (!token) return;
    fetch("/api/admin/apps", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setApps(data.apps || []))
      .catch(() => setApps([]));
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleDelete = async (app: App) => {
    if (!confirm(`Remove "${app.name}"? This cannot be undone.`)) return;
    const token = getStoredToken();
    if (!token) return;
    const res = await fetch(`/api/admin/apps/${app.appId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) loadApps();
    else alert("Failed to remove product.");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Products</h1>
          <p className="mt-1 text-gray-400">Add, edit, and remove products. Name, title, description, and thumbnail URL are fully editable.</p>
        </div>
        <Link
          href="/admin/apps/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Add product
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-surface-muted">
            <tr>
              <th className="p-3 font-medium text-white">Name</th>
              <th className="p-3 font-medium text-white">Slug</th>
              <th className="p-3 font-medium text-white">Status</th>
              <th className="p-3 font-medium text-white">Price</th>
              <th className="p-3 font-medium text-white">Title</th>
              <th className="p-3 font-medium text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.appId} className="border-b border-white/5">
                <td className="p-3 text-white">{app.name}</td>
                <td className="p-3 text-gray-400">{app.slug}</td>
                <td className="p-3 text-gray-400">{app.status}</td>
                <td className="p-3 text-gray-400">
                  {app.priceCents === 0 ? "Free" : `$${(app.priceCents / 100).toFixed(2)}`}
                </td>
                <td className="p-3 text-gray-400 line-clamp-1">{app.shareTitle}</td>
                <td className="p-3">
                  <Link
                    href={`/admin/apps/${app.appId}`}
                    className="mr-3 text-brand hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(app)}
                    className="text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {apps.length === 0 && (
        <p className="mt-6 text-gray-500">No products yet. Click “Add product” to create one.</p>
      )}
    </div>
  );
}
