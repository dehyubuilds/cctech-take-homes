/**
 * Statics domain types.
 * Aligned with DynamoDB-backed entities and Cognito/Twilio integration.
 */

export type Role = "admin" | "user";

export type AppStatus = "active" | "inactive" | "draft";

export type SubscriptionStatus = "active" | "canceled" | "paused";

export type DeliveryChannel = "sms";

export type SmsStatus = "active" | "opted_out" | "pending";

export interface User {
  userId: string;
  email: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  role: Role;
  smsStatus: SmsStatus;
  /** Profile picture URL (e.g. S3); written to Dynamo. */
  avatarUrl?: string;
  /** Internal: pending 2FA code (stored in Dynamo, stripped in API responses). */
  verifyCode?: string;
  verifyCodeExpiresAt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface App {
  appId: string;
  name: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  siteUrl: string;
  status: AppStatus;
  /** Price in cents; 0 = free */
  priceCents: number;
  shareTitle: string;
  shareDescription: string;
  shareImageUrl: string;
  canonicalUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  subscriptionId: string;
  userId: string;
  appId: string;
  deliveryChannel: DeliveryChannel;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SmsEvent {
  eventId: string;
  phoneNumber: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Written to Dynamo when an app is disabled; backend uses this to stop sending for that app. */
export interface SubscriptionStopEntry {
  entryId: string;
  appId: string;
  reason: "app_disabled";
  createdAt: string;
}

export type TwilioInboundAction = "STOP" | "START" | "HELP" | "inbound";
