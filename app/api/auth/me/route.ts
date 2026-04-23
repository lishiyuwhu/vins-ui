import { NextResponse } from "next/server";
import { getStoredApiKey } from "@/lib/backend";

export async function GET() {
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const parts = apiKey.split("-");
  const keyHint =
    parts.length >= 2 ? `${parts[0]}-${parts[1]}-****` : `${apiKey.slice(0, 8)}****`;

  return NextResponse.json({
    ok: true,
    key_hint: keyHint,
  });
}
