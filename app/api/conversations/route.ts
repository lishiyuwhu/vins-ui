import { NextRequest, NextResponse } from "next/server";
import { getStoredApiKey, proxyJson } from "@/lib/backend";

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const response = await proxyJson("/conversations", {
      method: "POST",
      apiKey,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({ error: "创建失败" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
  }
}
