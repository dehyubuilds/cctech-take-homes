import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";
import { config } from "@/lib/config";
import { renderReceiptLicense } from "@/lib/dropflow-email";

const DOWNLOAD_EXPIRY_DAYS = 7;

/**
 * POST: Stripe webhook. On checkout.session.completed:
 * - create order record (dropflow_orders)
 * - send receipt + license email with download link
 * - track purchase_completed event
 */
export async function POST(request: NextRequest) {
  if (!config.stripe.webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret not set. Set config.stripe.webhookSecret in src/lib/config.ts." },
      { status: 503 }
    );
  }
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: "2025-08-27.basil",
    });
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      config.stripe.webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        payment_intent?: string;
        customer_email?: string | null;
        metadata?: Record<string, string>;
      };
      const metadata = session.metadata ?? {};
      const beatId = metadata.beatId;
      const amountCents = parseInt(metadata.amountCents ?? "0", 10);
      const buyerEmail =
        metadata.buyerEmail?.trim() ||
        session.customer_email?.trim() ||
        "";
      const creatorUserId = metadata.creatorUserId ?? "";

      if (!beatId || !amountCents || !buyerEmail) {
        console.warn("[Dropflow webhook] Missing metadata or email", {
          beatId,
          amountCents,
          buyerEmail: !!buyerEmail,
        });
        return NextResponse.json({ received: true });
      }

      const beatRes = await docClient.send(
        new GetCommand({
          TableName: getTable("dropflow_beats"),
          Key: { beatId },
        })
      );
      const beat = beatRes.Item as
        | {
            userId?: string;
            title?: string;
            creatorUsername?: string;
            originalFileUrl?: string;
          }
        | undefined;
      if (!beat) {
        console.warn("[Dropflow webhook] Beat not found", beatId);
        return NextResponse.json({ received: true });
      }

      const platformFeeCents = Math.round(
        amountCents * (config.dropflow.platformFeePercent ?? 0.05)
      );
      const netPayoutCents = amountCents - platformFeeCents;
      const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const receiptNumber = `DF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${orderId.slice(-8)}`;
      const downloadToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + DOWNLOAD_EXPIRY_DAYS);
      const downloadExpiresAt = expiresAt.toISOString();
      const baseUrl = config.app.baseUrl.replace(/\/$/, "");
      const downloadUrl = `${baseUrl}/api/dropflow/download?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(downloadToken)}`;

      const orderItem = {
        orderId,
        beatId,
        buyerEmail,
        creatorUserId: creatorUserId || beat.userId,
        grossAmountCents: amountCents,
        platformFeeCents,
        netPayoutCents,
        stripePaymentIntentId: session.payment_intent ?? undefined,
        stripeSessionId: session.id,
        receiptNumber,
        downloadToken,
        downloadExpiresAt,
        createdAt: new Date().toISOString(),
      };

      await docClient.send(
        new PutCommand({
          TableName: getTable("dropflow_orders"),
          Item: orderItem,
        })
      );

      const creatorName = beat.creatorUsername ?? "Creator";
      const amountPaid = `$${(amountCents / 100).toFixed(2)}`;
      const html = renderReceiptLicense({
        orderId,
        date: new Date().toISOString().slice(0, 10),
        buyerEmail,
        songTitle: beat.title ?? "Track",
        creatorName,
        amountPaid,
        downloadExpiresAt: downloadExpiresAt.slice(0, 10),
        downloadUrl,
      });

      if (config.resend.apiKey) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(config.resend.apiKey);
          await resend.emails.send({
            from: config.resend.from,
            to: buyerEmail,
            subject: `Receipt & License: ${beat.title ?? "Track"}`,
            html,
          });
        } catch (emailErr) {
          console.error("[Dropflow webhook] Resend send failed", emailErr);
        }
      } else {
        console.log("[Dropflow webhook] Resend API key not set in config; skipping email");
      }

      await docClient.send(
        new PutCommand({
          TableName: getTable("dropflow_events"),
          Item: {
            eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: "purchase_completed",
            beatId,
            userId: creatorUserId || beat.userId,
            timestamp: new Date().toISOString(),
            metadata: { orderId, amountCents },
          },
        })
      );
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Dropflow webhook]", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
