import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }
    const auth = getAuthService();
    const result = await auth.signIn(email, password);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
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
    console.error("signin", e);
    return NextResponse.json(
      { error: "Sign in failed" },
      { status: 500 }
    );
  }
}
