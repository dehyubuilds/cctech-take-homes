import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const EVENT_TYPES = [
  "beat_viewed",
  "preview_played",
  "purchase_started",
  "purchase_completed",
  "download_completed",
  "collection_viewed",
] as const;

/** POST: track event. Body: { type, beatId?, userId?, referrer?, metadata? }. Public. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const type = body.type as string;
  if (!type || !EVENT_TYPES.includes(type as (typeof EVENT_TYPES)[number])) {
    return NextResponse.json(
      { error: "Invalid or missing event type" },
      { status: 400 }
    );
  }
  const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const item = {
    eventId,
    type,
    beatId: body.beatId ?? undefined,
    userId: body.userId ?? undefined,
    timestamp: new Date().toISOString(),
    referrer: body.referrer ?? undefined,
    metadata: body.metadata ?? undefined,
  };
  try {
    await docClient.send(
      new PutCommand({
        TableName: getTable("dropflow_events"),
        Item: item,
      })
    );
    return NextResponse.json({ ok: true, eventId });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
