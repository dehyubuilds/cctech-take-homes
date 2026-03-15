import type { User, App, Subscription } from "./domain";

export const ADMIN_EMAIL = "dehyu.sinyan@gmail.com";

export const seedUsers: User[] = [
  {
    userId: "user-admin-1",
    email: ADMIN_EMAIL,
    phoneNumber: "+15551234000",
    phoneVerified: true,
    role: "admin",
    smsStatus: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    userId: "user-2",
    email: "alice@example.com",
    phoneNumber: "+15551234001",
    phoneVerified: true,
    role: "user",
    smsStatus: "active",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
  },
  {
    userId: "user-3",
    email: "bob@example.com",
    phoneNumber: undefined,
    phoneVerified: false,
    role: "user",
    smsStatus: "pending",
    createdAt: "2025-01-03T00:00:00Z",
    updatedAt: "2025-01-03T00:00:00Z",
  },
];

export const seedApps: App[] = [
  {
    appId: "app-march-madness",
    name: "Daily March Madness Picks",
    slug: "daily-march-madness-picks",
    description:
      "Get daily SMS picks for March Madness: game analysis, betting edges, and short explanations. One text per day during the tournament.",
    thumbnailUrl: "https://placehold.co/400x225/1a1a1a/6366f1?text=March+Madness",
    siteUrl: "/app/daily-march-madness-picks",
    status: "active",
    priceCents: 0,
    shareTitle: "Daily March Madness Picks | Statics",
    shareDescription:
      "Daily SMS picks for March Madness: game analysis and betting edges.",
    shareImageUrl: "https://placehold.co/1200x630/1a1a1a/6366f1?text=Daily+March+Madness+Picks",
    canonicalUrl: "https://statics.example.com/apps/daily-march-madness-picks",
    createdBy: "user-admin-1",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

export const seedSubscriptions: Subscription[] = [
  {
    subscriptionId: "sub-1",
    userId: "user-2",
    appId: "app-march-madness",
    deliveryChannel: "sms",
    status: "active",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
  },
];
