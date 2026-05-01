import { NextResponse } from "next/server";
import { getAotqRepository } from "@/lib/repositories/aotq-repository";

export async function GET() {
  try {
    const rows = await getAotqRepository().listPublishedCatalog();
    return NextResponse.json({ interviews: rows });
  } catch {
    return NextResponse.json({ interviews: [], error: "Catalog unavailable" }, { status: 503 });
  }
}
