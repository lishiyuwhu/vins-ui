import { NextRequest, NextResponse } from "next/server";
import { getStoredApiKey, proxyJson } from "@/lib/backend";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.text();
    const response = await proxyJson(`/conversations/${sessionId}/recommend`, {
      method: "POST",
      apiKey,
      headers: { "Content-Type": "application/json" },
      body,
    });

    const payload = await response.json().catch(() => ({ error: "获取推荐失败" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
  }
}
