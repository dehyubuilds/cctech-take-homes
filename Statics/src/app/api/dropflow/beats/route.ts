import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { config } from "@/lib/config";
import {
  DROPFLOW_BEAT_CATALOG_PK,
  beatGsiAttributes,
} from "@/lib/dropflow-beats-gsi";

const BEATS_TABLE = () => getTable("dropflow_beats");

type BeatItem = {
  beatId?: string;
  creatorUsername?: string;
  tags?: string[];
  createdAt?: string;
  gpkCatalog?: string;
  [key: string]: unknown;
}

async function scanAllBeats(): Promise<BeatItem[]> {
  const all: BeatItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(
      new ScanCommand({
        TableName: BEATS_TABLE(),
        ExclusiveStartKey: startKey,
      })
    );
    all.push(...((res.Items ?? []) as BeatItem[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return all;
}

function isGsiUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("does not have the specified index") ||
    msg.includes("Invalid index") ||
    (msg.includes("ValidationException") && msg.includes("index"))
  );
}

/** All beats in global upload order (oldest or newest first per ScanIndexForward). */
async function queryCatalogOrdered(sortDesc: boolean): Promise<BeatItem[]> {
  const items: BeatItem[] = [];
  let lek: Record<string, unknown> | undefined;
  try {
    do {
      const res = await docClient.send(
        new QueryCommand({
          TableName: BEATS_TABLE(),
          IndexName: "catalog-by-date",
          KeyConditionExpression: "gpkCatalog = :pk",
          ExpressionAttributeValues: { ":pk": DROPFLOW_BEAT_CATALOG_PK },
          ScanIndexForward: !sortDesc,
          ExclusiveStartKey: lek,
        })
      );
      items.push(...((res.Items ?? []) as BeatItem[]));
      lek = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lek);
    return items;
  } catch (e) {
    if (isGsiUnavailable(e)) {
      console.warn("[dropflow/beats] catalog-by-date GSI missing; using Scan");
      const raw = await scanAllBeats();
      raw.sort((a, b) => {
        const ta = new Date(a.createdAt ?? 0).getTime();
        const tb = new Date(b.createdAt ?? 0).getTime();
        return sortDesc ? tb - ta : ta - tb;
      });
      return raw;
    }
    throw e;
  }
}

/** Beats for one creator in upload order. */
async function queryCreatorOrdered(
  creatorUsername: string,
  sortDesc: boolean
): Promise<BeatItem[]> {
  const items: BeatItem[] = [];
  let lek: Record<string, unknown> | undefined;
  try {
    do {
      const res = await docClient.send(
        new QueryCommand({
          TableName: BEATS_TABLE(),
          IndexName: "creator-by-date",
          KeyConditionExpression: "creatorUsername = :u",
          ExpressionAttributeValues: { ":u": creatorUsername },
          ScanIndexForward: !sortDesc,
          ExclusiveStartKey: lek,
        })
      );
      items.push(...((res.Items ?? []) as BeatItem[]));
      lek = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lek);
    return items;
  } catch (e) {
    if (isGsiUnavailable(e)) {
      console.warn("[dropflow/beats] creator-by-date GSI missing; using Scan");
      const raw = await scanAllBeats();
      const f = raw.filter(
        (it) => (it.creatorUsername ?? "").toLowerCase() === creatorUsername
      );
      f.sort((a, b) => {
        const ta = new Date(a.createdAt ?? 0).getTime();
        const tb = new Date(b.createdAt ?? 0).getTime();
        return sortDesc ? tb - ta : ta - tb;
      });
      return f;
    }
    throw e;
  }
}

/**
 * GET: list beats with optional filters and pagination.
 *
 * Uses GSIs when present: catalog-by-date (global listing), creator-by-date (exact username).
 * Substring username / tag filters run in memory on the queried set.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const exactUsername = (searchParams.get("username") ?? "").trim().toLowerCase();
  const usernameContains = (searchParams.get("usernameContains") ?? "").trim().toLowerCase();
  const tagFilter = (searchParams.get("tag") ?? "").trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "12", 10) || 12));
  const sortDesc = searchParams.get("sort") === "desc";

  try {
    let pool: BeatItem[];

    const useCreatorGsi = Boolean(exactUsername && !usernameContains);

    if (useCreatorGsi) {
      pool = await queryCreatorOrdered(exactUsername, sortDesc);
      if (tagFilter) {
        pool = pool.filter((item) => {
          const tags = (item.tags ?? []).map((t) => String(t).toLowerCase());
          return tags.some((t) => t.includes(tagFilter));
        });
      }
    } else {
      pool = await queryCatalogOrdered(sortDesc);
      if (exactUsername) {
        pool = pool.filter(
          (it) => (it.creatorUsername ?? "").toLowerCase() === exactUsername
        );
      }
      if (usernameContains) {
        pool = pool.filter((it) =>
          (it.creatorUsername ?? "").toLowerCase().includes(usernameContains)
        );
      }
      if (tagFilter) {
        pool = pool.filter((item) => {
          const tags = (item.tags ?? []).map((t) => String(t).toLowerCase());
          return tags.some((t) => t.includes(tagFilter));
        });
      }
    }

    const total = pool.length;
    const start = (page - 1) * pageSize;
    const beats = pool.slice(start, start + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      beats,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** POST: create beat. Requires creatorUsername (creator's chosen username). Tags optional for search. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const creatorUsername = (body.creatorUsername ?? body.username ?? "").toString().trim().toLowerCase();
  if (!creatorUsername) {
    return NextResponse.json(
      { error: "creatorUsername required (creator's searchable username)" },
      { status: 400 }
    );
  }
  const beatId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
  const rawTrackKey = (body.originalS3Key ?? "").toString().trim();
  const originalS3Key =
    rawTrackKey.startsWith("tracks/") && !rawTrackKey.includes("..") && rawTrackKey.length <= 500
      ? rawTrackKey
      : "";

  const gsi = beatGsiAttributes(now, beatId, creatorUsername);

  const item = {
    beatId,
    userId: body.userId ?? "user-unknown",
    creatorUsername,
    title: body.title ?? "Untitled",
    description: body.description ?? "",
    tags,
    thumbnailUrl: body.thumbnailUrl ?? "",
    originalFileUrl: body.originalFileUrl ?? "",
    previewFileUrl: "",
    previewStartSecond: Number.isFinite(Number(body.previewStartSecond)) ? Number(body.previewStartSecond) : 0,
    minimumPriceCents: 100,
    createdAt: now,
    updatedAt: now,
    ...gsi,
  };
  try {
    await docClient.send(
      new PutCommand({ TableName: BEATS_TABLE(), Item: item })
    );
    const lambdaName = config.dropflow.previewLambdaName;
    const originalFileUrl = (item.originalFileUrl as string) || "";
    if (lambdaName && originalFileUrl) {
      try {
        const lambda = new LambdaClient({
          region: config.dynamo.region,
          credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          },
        });
        await lambda.send(
          new InvokeCommand({
            FunctionName: lambdaName,
            InvocationType: "Event",
            Payload: JSON.stringify({
              beatId: item.beatId,
              originalFileUrl,
              ...(originalS3Key ? { originalS3Key } : {}),
              bucket: config.dropflow.bucket,
              baseUrl: config.dropflow.baseUrl,
              tableName: BEATS_TABLE(),
              region: config.dynamo.region,
              durationSec: config.dropflow.previewDurationSeconds ?? 15,
            }),
          })
        );
      } catch (invokeErr) {
        console.error("[dropflow/beats] Lambda invoke failed", invokeErr);
      }
    }
    return NextResponse.json({ beat: item });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
