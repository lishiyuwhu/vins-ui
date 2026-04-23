import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(`${getBackendBaseUrl()}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({ ok: false }));
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.set("set-cookie", setCookie);
    }

    return nextResponse;
  } catch {
    return NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
  }
}
