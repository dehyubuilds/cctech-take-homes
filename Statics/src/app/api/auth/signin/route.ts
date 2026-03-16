import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

const LOG = (msg: string, data?: Record<string, unknown>) => {
  console.log("[Statics Auth] signin", msg, data ?? "");
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      LOG("missing email or password");
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    LOG("attempt", { email: String(email).toLowerCase() });
    const auth = getAuthService();
    const result = await auth.signIn(email, password);
    if ("error" in result) {
      const payload: { error: string; detail?: string } = { error: result.error };
      if ("detail" in result && typeof result.detail === "string") payload.detail = result.detail;
      LOG("result error", payload);
      return NextResponse.json(payload, { status: 401 });
    }
    LOG("success", { userId: result.user.userId });
    const sessionUser = {
      userId: result.user.userId,
      email: result.user.email,
      role: result.user.role,
      user: result.user,
    };
    return NextResponse.json({
      token: result.token,
      ...sessionUser,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign in failed";
    const name = e instanceof Error ? e.name : "";
    console.error("[Statics Auth] signin exception", { name, message, stack: e instanceof Error ? e.stack : undefined });
    return NextResponse.json(
      { error: "Sign in failed" },
      { status: 500 }
    );
  }
}
