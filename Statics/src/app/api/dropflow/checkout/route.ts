import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";
import { getAuthService } from "@/lib/services";

/**
 * POST: create Stripe Checkout session. Pay-what-you-want (min $1).
 * 5% platform fee, rest to creator via Stripe Connect destination charge.
 * Requires sign-in and verified phone (to pay).
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to purchase. You can browse and play previews without an account." },
      { status: 401 }
    );
  }
  if (!session.user.phoneVerified) {
    return NextResponse.json(
      { error: "Verify your phone number in Profile to purchase." },
      { status: 403 }
    );
  }

  if (!config.stripe.secretKey) {
    return NextResponse.json(
      { error: "Stripe not configured. Set config.stripe.secretKey in src/lib/config.ts." },
      { status: 503 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const { beatId, amountCents, buyerEmail, successUrl, cancelUrl } = body;
  const minCents = config.dropflow.minPriceCents ?? 100;
  const amount = Number(amountCents);
  if (!beatId || !amount || amount < minCents) {
    return NextResponse.json(
      { error: `beatId and amountCents required; amountCents >= ${minCents}` },
      { status: 400 }
    );
  }
  const emailForCheckout = (buyerEmail && String(buyerEmail).trim()) || session.email || "";
  if (!emailForCheckout) {
    return NextResponse.json(
      { error: "Buyer email required for receipt." },
      { status: 400 }
    );
  }

  try {
    const beatRes = await docClient.send(
      new GetCommand({
        TableName: getTable("dropflow_beats"),
        Key: { beatId },
      })
    );
    const beat = beatRes.Item as { userId?: string; title?: string; creatorUsername?: string; thumbnailUrl?: string } | undefined;
    if (!beat) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const userRes = await docClient.send(
      new GetCommand({
        TableName: getTable("dropflow_users"),
        Key: { userId: beat.userId ?? "" },
      })
    );
    const creator = userRes.Item as { stripeAccountId?: string; username?: string } | undefined;
    const stripeAccountId = creator?.stripeAccountId;
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: "Creator has not connected Stripe. They need to set up payouts in Dropflow settings." },
        { status: 400 }
      );
    }

    const platformFeeCents = Math.round(amount * (config.dropflow.platformFeePercent ?? 0.05));
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2025-08-27.basil" });

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: beat.title ?? "Track",
              description: `By ${beat.creatorUsername ?? "creator"}`,
              images: beat.thumbnailUrl ? [beat.thumbnailUrl] : undefined,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl ?? `${config.app.baseUrl}/dropflow/b/${beatId}?paid=1`,
      cancel_url: cancelUrl ?? `${config.app.baseUrl}/dropflow/b/${beatId}`,
      customer_email: emailForCheckout,
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        metadata: { beatId, amountCents: String(amount), buyerEmail: emailForCheckout },
        transfer_data: {
          destination: stripeAccountId,
        },
      },
      metadata: {
        beatId,
        amountCents: String(amount),
        buyerEmail: emailForCheckout,
        creatorUserId: beat.userId ?? "",
      },
    });

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
