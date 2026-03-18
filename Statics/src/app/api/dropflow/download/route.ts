import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";

/**
 * GET: Secure download for a completed order.
 * Query: orderId, token. Validates token and expiry, then redirects to beat's originalFileUrl.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const token = searchParams.get("token");

  if (!orderId || !token) {
    return NextResponse.json(
      { error: "Missing orderId or token" },
      { status: 400 }
    );
  }

  try {
    const orderRes = await docClient.send(
      new GetCommand({
        TableName: getTable("dropflow_orders"),
        Key: { orderId },
      })
    );
    const order = orderRes.Item as
      | {
          downloadToken?: string;
          downloadExpiresAt?: string;
          beatId?: string;
        }
      | undefined;

    if (!order || order.downloadToken !== token) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    const expiresAt = order.downloadExpiresAt
      ? new Date(order.downloadExpiresAt).getTime()
      : 0;
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "Download link has expired" }, { status: 410 });
    }

    const beatRes = await docClient.send(
      new GetCommand({
        TableName: getTable("dropflow_beats"),
        Key: { beatId: order.beatId },
      })
    );
    const beat = beatRes.Item as { originalFileUrl?: string } | undefined;
    const url = beat?.originalFileUrl;
    if (!url) {
      return NextResponse.json(
        { error: "Download file not found" },
        { status: 404 }
      );
    }

    return NextResponse.redirect(url, 302);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
