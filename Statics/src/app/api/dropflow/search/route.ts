import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

/**
 * GET: search beats by creator username (exact) or tag (exact).
 * ?q= — matches creatorUsername or any tag (case-insensitive).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  if (!q) {
    return NextResponse.json({ beats: [] });
  }
  try {
    const res = await docClient.send(
      new ScanCommand({
        TableName: getTable("dropflow_beats"),
        Limit: 50,
        FilterExpression: "creatorUsername = :q OR contains(#tags, :q)",
        ExpressionAttributeNames: { "#tags": "tags" },
        ExpressionAttributeValues: { ":q": q },
      })
    );
    const beats = (res.Items ?? []).sort(
      (a, b) =>
        new Date((b as { createdAt?: string }).createdAt ?? 0).getTime() -
        new Date((a as { createdAt?: string }).createdAt ?? 0).getTime()
    );
    return NextResponse.json({ beats });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
