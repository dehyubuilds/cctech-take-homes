import { NextRequest, NextResponse } from "next/server";
import { docClient, getTable } from "@/lib/dynamodb";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";

const USERS_TABLE = () => getTable("dropflow_users");

/** GET: get creator profile by userId. ?userId=xxx. Add ?checkStripe=1 to resolve Stripe onboarding status (slower). */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const checkStripe = request.nextUrl.searchParams.get("checkStripe") === "1";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE(),
        Key: { userId },
      })
    );
    if (!res.Item) return NextResponse.json({ profile: null });
    const profile = res.Item as Record<string, unknown> & { stripeAccountId?: string };
    let stripeOnboardingComplete = false;
    if (checkStripe && profile.stripeAccountId && config.stripe.secretKey) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2025-08-27.basil" });
        const account = await stripe.accounts.retrieve(profile.stripeAccountId);
        stripeOnboardingComplete = account.details_submitted === true;
      } catch {
        // leave false if Stripe call fails (e.g. invalid account)
      }
    }
    return NextResponse.json({
      profile: { ...profile, stripeOnboardingComplete },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dropflow/me GET]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT: set creator username. Body: { userId, username, displayName? }. Saves to DynamoDB dropflow_users. */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId ?? "";
  const rawUsername = (body.username ?? "").toString().trim();
  if (!userId || !rawUsername) {
    return NextResponse.json(
      { error: "userId and username required" },
      { status: 400 }
    );
  }
  const username = rawUsername.toLowerCase().replace(/\s+/g, "");
  if (username.length < 2) {
    return NextResponse.json(
      { error: "Username must be at least 2 characters" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const existing = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE(),
      Key: { userId },
    })
  );
  const prev = (existing.Item ?? {}) as Record<string, unknown>;
  const prevUsername = (prev.username as string) ?? "";
  const isChangingUsername = prevUsername !== username;
  if (isChangingUsername) {
    const scanRes = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE(),
        FilterExpression: "#u = :username",
        ExpressionAttributeNames: { "#u": "username" },
        ExpressionAttributeValues: { ":username": username },
      })
    );
    const takenByOther = (scanRes.Items ?? []).some(
      (item) => (item as { userId?: string }).userId !== userId
    );
    if (takenByOther) {
      return NextResponse.json(
        { error: "That username is already taken. Choose another." },
        { status: 409 }
      );
    }
  }
  const item = {
    userId,
    username,
    displayName: body.displayName ?? prev.displayName ?? rawUsername,
    email: prev.email ?? body.email ?? "",
    stripeAccountId: prev.stripeAccountId,
    createdAt: (prev.createdAt as string) ?? now,
    updatedAt: now,
  };
  try {
    await docClient.send(
      new PutCommand({ TableName: USERS_TABLE(), Item: item })
    );
    return NextResponse.json({ profile: item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dropflow/me PUT]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
