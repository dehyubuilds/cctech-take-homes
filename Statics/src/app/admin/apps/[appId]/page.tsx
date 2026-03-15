"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getStoredToken } from "@/components/AuthProvider";
import type { App } from "@/lib/domain";

export default function AdminAppEditPage() {
  const params = useParams();
  const appId = params.appId as string;
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    thumbnailUrl: "",
    priceCents: 0,
    status: "draft" as App["status"],
    shareTitle: "",
    shareDescription: "",
    shareImageUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    fetch(`/api/admin/apps/${appId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setApp(data);
          setForm({
            name: data.name,
            slug: data.slug,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            priceCents: data.priceCents ?? 0,
            status: data.status,
            shareTitle: data.shareTitle ?? data.name,
            shareDescription: data.shareDescription ?? data.description,
            shareImageUrl: data.shareImageUrl ?? data.thumbnailUrl,
          });
        } else setApp(null);
      })
      .catch(() => setApp(null));
  }, [appId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const token = getStoredToken();
    if (!token || !app) {
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/apps/${appId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description,
          thumbnailUrl: form.thumbnailUrl,
          priceCents: form.priceCents,
          status: form.status,
          shareTitle: form.shareTitle,
          shareDescription: form.shareDescription,
          shareImageUrl: form.shareImageUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setApp(updated);
      setForm((f) => ({
        ...f,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        thumbnailUrl: updated.thumbnailUrl,
        shareTitle: updated.shareTitle,
        shareDescription: updated.shareDescription,
        shareImageUrl: updated.shareImageUrl,
      }));
      setSaving(false);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove this product? Subscriptions will be invalid.")) return;
    setDeleting(true);
    setError("");
    const token = getStoredToken();
    if (!token) {
      setDeleting(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/apps/${appId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push("/admin/apps");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete");
    } catch {
      setError("Something went wrong");
    }
    setDeleting(false);
  };

  if (!app) {
    return (
      <div className="py-8">
        <p className="text-gray-400">Loading…</p>
        <Link href="/admin/apps" className="mt-4 inline-block text-brand hover:underline">
          Back to apps
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Edit product</h1>
      <p className="mt-1 text-gray-400">
        Name, title, description, thumbnail URL. All content is from this form — nothing is hardcoded.
      </p>
      <form onSubmit={handleSave} className="mt-8 max-w-xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-400">Product name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Slug (URL segment)</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-1 text-xs text-gray-500">Public page: /apps/{form.slug || app.slug}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Description *</label>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
          />
          {form.thumbnailUrl && (
            <div className="mt-2 aspect-video w-48 overflow-hidden rounded border border-white/10">
              <img src={form.thumbnailUrl} alt="" width={192} height={108} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Display title (link preview title)</label>
          <input
            type="text"
            value={form.shareTitle}
            onChange={(e) => setForm((f) => ({ ...f, shareTitle: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Share description (og:description)</label>
          <input
            type="text"
            value={form.shareDescription}
            onChange={(e) => setForm((f) => ({ ...f, shareDescription: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400">Share image URL (og:image)</label>
          <input
            type="url"
            value={form.shareImageUrl}
            onChange={(e) => setForm((f) => ({ ...f, shareImageUrl: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
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
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as App["status"] }))}
            className="mt-1 w-full rounded-lg border border-white/10 bg-surface-elevated px-3 py-2 text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive (disabled)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Inactive: app is hidden from the carousel, subscriptions are paused, and a stop entry is written so the backend stops sending.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link
            href="/admin/apps"
            className="rounded-lg border border-white/20 px-4 py-2 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove product"}
          </button>
        </div>
      </form>
    </div>
  );
}
