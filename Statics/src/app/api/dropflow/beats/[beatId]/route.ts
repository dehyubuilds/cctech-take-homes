import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const BEATS_TABLE = () => getTable("dropflow_beats");

/** GET: single beat by beatId. Public. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ beatId: string }> }
) {
  const { beatId } = await params;
  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: BEATS_TABLE(),
        Key: { beatId },
      })
    );
    if (!res.Item) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    return NextResponse.json(res.Item);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** DELETE: remove a beat. Body: { userId }. Only the beat owner (matching userId) can delete. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ beatId: string }> }
) {
  const { beatId } = await params;
  let body: { userId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const userId = (body.userId ?? "").toString().trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  try {
    const getRes = await docClient.send(
      new GetCommand({ TableName: BEATS_TABLE(), Key: { beatId } })
    );
    const item = getRes.Item as { userId?: string } | undefined;
    if (!item) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
    if (item.userId !== userId) {
      return NextResponse.json({ error: "You can only remove your own tracks" }, { status: 403 });
    }
    await docClient.send(
      new DeleteCommand({ TableName: BEATS_TABLE(), Key: { beatId } })
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
