import type { Subscription, SubscriptionStopEntry } from "@/lib/domain";
import { seedSubscriptions } from "@/lib/seed-data";

const subs = new Map<string, Subscription>(
  seedSubscriptions.map((s) => [s.subscriptionId, { ...s }])
);

/** Entries written when an app is disabled; backend checks this to stop sending. */
const subscriptionStopEntries = new Map<string, SubscriptionStopEntry>();

function byUserApp(userId: string, appId: string): Subscription | undefined {
  return Array.from(subs.values()).find(
    (s) => s.userId === userId && s.appId === appId && s.status === "active"
  );
}

export function getMockSubscriptionRepository() {
  return {
    async getByUserAndApp(
      userId: string,
      appId: string
    ): Promise<Subscription | null> {
      return byUserApp(userId, appId) ?? null;
    },
    async listByUser(userId: string): Promise<Subscription[]> {
      return Array.from(subs.values()).filter((s) => s.userId === userId);
    },
    async listByApp(appId: string): Promise<Subscription[]> {
      return Array.from(subs.values()).filter(
        (s) => s.appId === appId && s.status === "active"
      );
    },
    /** All subscriptions for an app (any status). Used when disabling an app. */
    async listByAppAll(appId: string): Promise<Subscription[]> {
      return Array.from(subs.values()).filter((s) => s.appId === appId);
    },
    async create(sub: Subscription): Promise<Subscription> {
      subs.set(sub.subscriptionId, sub);
      return sub;
    },
    async update(
      subscriptionId: string,
      patch: Partial<Subscription>
    ): Promise<Subscription | null> {
      const s = subs.get(subscriptionId);
      if (!s) return null;
      const updated = { ...s, ...patch, updatedAt: new Date().toISOString() };
      subs.set(subscriptionId, updated);
      return updated;
    },
    async cancel(subscriptionId: string): Promise<boolean> {
      const s = subs.get(subscriptionId);
      if (!s) return false;
      s.status = "canceled";
      s.updatedAt = new Date().toISOString();
      return true;
    },
    /** When app is disabled: pause all its subscriptions and return count. */
    async pauseAllForApp(appId: string): Promise<number> {
      const list = Array.from(subs.values()).filter(
        (s) => s.appId === appId && s.status === "active"
      );
      const now = new Date().toISOString();
      for (const s of list) {
        subs.set(s.subscriptionId, { ...s, status: "paused", updatedAt: now });
      }
      return list.length;
    },
    /** Write a Dynamo entry that subscriptions for this app should be stopped (app disabled). */
    async writeSubscriptionStopEntry(appId: string): Promise<SubscriptionStopEntry> {
      const now = new Date().toISOString();
      const entry: SubscriptionStopEntry = {
        entryId: `stop-${appId}-${Date.now()}`,
        appId,
        reason: "app_disabled",
        createdAt: now,
      };
      subscriptionStopEntries.set(entry.entryId, entry);
      return entry;
    },
    /** Check if there is a stop entry for this app (backend: do not send for this app). */
    async hasSubscriptionStopEntry(appId: string): Promise<boolean> {
      return Array.from(subscriptionStopEntries.values()).some(
        (e) => e.appId === appId && e.reason === "app_disabled"
      );
    },
  };
}
