import type { App } from "@/lib/domain";
import { seedApps } from "@/lib/seed-data";

const apps = new Map<string, App>(seedApps.map((a) => [a.appId, { ...a }]));
const bySlug = new Map<string, App>(seedApps.map((a) => [a.slug, a]));

export function getMockAppRepository() {
  return {
    async list(status?: App["status"]): Promise<App[]> {
      let list = Array.from(apps.values());
      if (status) list = list.filter((a) => a.status === status);
      return list.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    },
    async getById(appId: string): Promise<App | null> {
      return apps.get(appId) ?? null;
    },
    async getBySlug(slug: string): Promise<App | null> {
      return bySlug.get(slug) ?? null;
    },
    async create(app: App): Promise<App> {
      apps.set(app.appId, app);
      bySlug.set(app.slug, app);
      return app;
    },
    async update(appId: string, patch: Partial<App>): Promise<App | null> {
      const a = apps.get(appId);
      if (!a) return null;
      const updated = { ...a, ...patch, updatedAt: new Date().toISOString() };
      apps.set(appId, updated);
      bySlug.set(updated.slug, updated);
      return updated;
    },
    async delete(appId: string): Promise<boolean> {
      const a = apps.get(appId);
      if (!a) return false;
      apps.delete(appId);
      bySlug.delete(a.slug);
      return true;
    },
  };
}
