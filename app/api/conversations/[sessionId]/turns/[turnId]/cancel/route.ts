import { NextRequest, NextResponse } from "next/server";
import { getStoredApiKey, proxyJson } from "@/lib/backend";

export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ sessionId: string; turnId: string }> },
) {
  try {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { sessionId, turnId } = await params;
    const response = await proxyJson(
      `/conversations/${sessionId}/turns/${turnId}/cancel`,
      {
        method: "POST",
        apiKey,
      },
    );

    const payload = await response.json().catch(() => ({ error: "取消失败" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
  }
}
