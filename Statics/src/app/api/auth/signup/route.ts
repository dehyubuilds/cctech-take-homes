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
    const result = await auth.signUp(email, password);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ userId: result.userId });
  } catch (e) {
    console.error("signup", e);
    return NextResponse.json(
      { error: "Sign up failed" },
      { status: 500 }
    );
  }
}
