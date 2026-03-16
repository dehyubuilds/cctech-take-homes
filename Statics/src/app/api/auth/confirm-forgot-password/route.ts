import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "Email, verification code, and new password required" },
        { status: 400 }
      );
    }
    const auth = getAuthService();
    const result = await auth.confirmForgotPassword(email, code, newPassword);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Statics Auth] confirm-forgot-password exception", e);
    return NextResponse.json(
      { error: "Could not reset password" },
      { status: 500 }
    );
  }
}
