import { NextRequest } from "next/server";
import { handleSendVerifyCode } from "@/lib/send-verify-code-handler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleSendVerifyCode(request);
}
