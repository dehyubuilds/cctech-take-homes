"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function AdminNewAppPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    thumbnailUrl: "",
    priceCents: 0,
    status: "draft" as "active" | "inactive" | "draft",
    shareTitle: "",
    shareDescription: "",
    shareImageUrl: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const token = getStoredToken();
    if (!token) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }
    const slug = slugFromName(form.name);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          slug: slug || "new-product",
          description: form.description,
          thumbnailUrl: form.thumbnailUrl,
          siteUrl: `/app/${slug || "new-product"}`,
          status: form.status,
          priceCents: form.priceCents,
          shareTitle: form.shareTitle || form.name,
          shareDescription: form.shareDescription || form.description,
          shareImageUrl: form.shareImageUrl || form.thumbnailUrl,
          canonicalUrl: `${base}/apps/${slug || "new-product"}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create product");
        setSaving(false);
        return;
      }
      const app = await res.json();
      router.push(`/admin/apps/${app.appId}`);
      router.refresh();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Add product</h1>
      <p className="mt-1 text-gray-400">
        Name, title, description, and thumbnail URL. Slug is generated from name.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-400">Product name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="e.g. Daily March Madness Picks"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Display title (link preview title)</label>
          <input
            type="text"
            value={form.shareTitle}
            onChange={(e) => setForm((f) => ({ ...f, shareTitle: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Defaults to product name if empty"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Description *</label>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="What this product does and what subscribers get"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Thumbnail image URL (static/S3) *</label>
          <input
            type="url"
            required
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="https://... or S3 URL"
          />
          {form.thumbnailUrl && (
            <div className="mt-2 aspect-video w-48 overflow-hidden rounded border border-white/10">
              <img src={form.thumbnailUrl} alt="" width={192} height={108} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Share description (for link previews)</label>
          <input
            type="text"
            value={form.shareDescription}
            onChange={(e) => setForm((f) => ({ ...f, shareDescription: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Defaults to description if empty"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Share image URL (og:image)</label>
          <input
            type="url"
            value={form.shareImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, shareImageUrl: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="https://… or leave blank to use thumbnail"
          />
          <p className="mt-1 text-xs text-gray-500">Used when the app link is shared (e.g. in texts). Use a full URL (https://…) for reliable previews.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Price (cents, 0 = free)</label>
          <input
            type="number"
            min={0}
            value={form.priceCents}
            onChange={(e) => setForm((f) => ({ ...f, priceCents: parseInt(e.target.value, 10) || 0 }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" | "draft" }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create product"}
          </button>
          <Link
            href="/admin/apps"
            className="rounded-lg border border-white/20 px-4 py-2 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
