import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;
    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code required" },
        { status: 400 }
      );
    }
    const auth = getAuthService();
    const result = await auth.confirmSignUp(email, code);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Statics Auth] confirm-signup exception", e);
    return NextResponse.json(
      { error: "Confirmation failed" },
      { status: 500 }
    );
  }
}
