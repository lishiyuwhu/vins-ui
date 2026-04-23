import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl, getStoredApiKey } from "@/lib/backend";

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

    const response = await fetch(
      `${getBackendBaseUrl()}/conversations/${sessionId}/turns`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "执行失败" }));
      return NextResponse.json(payload, { status: response.status });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
  }
}
