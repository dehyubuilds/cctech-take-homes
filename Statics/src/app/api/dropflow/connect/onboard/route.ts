import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";
import { getAuthService } from "@/lib/services";

const USERS_TABLE = () => getTable("dropflow_users");

/**
 * POST: Start Stripe Connect Express onboarding for the current user (seller).
 * Requires auth. Creates or reuses Express account, returns account link URL.
 * Frontend redirects user to url; on return to return_url, payouts are set up.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Sign in to set up payouts." }, { status: 401 });
  }

  if (!config.stripe.secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured. Contact support." },
      { status: 503 }
    );
  }

  const userId = session.userId;
  const email = session.email || session.user?.email || "";
  const baseUrl = request.nextUrl.origin;
  const returnUrl = `${baseUrl}/dropflow/settings?stripe=complete`;
  const refreshUrl = `${baseUrl}/dropflow/settings?stripe=refresh`;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2025-08-27.basil" });

    const existingRes = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE(),
        Key: { userId },
      })
    );
    const existing = (existingRes.Item ?? {}) as {
      username?: string;
      displayName?: string;
      email?: string;
      stripeAccountId?: string;
      createdAt?: string;
      updatedAt?: string;
    };

    let stripeAccountId = existing.stripeAccountId;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;

      const now = new Date().toISOString();
      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE(),
          Item: {
            userId,
            username: existing.username ?? "",
            displayName: existing.displayName ?? "",
            email: (email || existing.email) ?? "",
            stripeAccountId,
            createdAt: existing.createdAt ?? now,
            updatedAt: now,
          },
        })
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (e) {
    console.error("dropflow connect onboard", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start payout setup." },
      { status: 500 }
    );
  }
}
