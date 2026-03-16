import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const auth = getAuthService();
    const result = await auth.forgotPassword(email);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Statics Auth] forgot-password exception", e);
    return NextResponse.json(
      { error: "Could not send reset code" },
      { status: 500 }
    );
  }
}
