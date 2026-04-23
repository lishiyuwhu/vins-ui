import { NextResponse } from "next/server";
import { API_KEY_COOKIE_NAME, getBackendBaseUrl, getStoredApiKey } from "@/lib/backend";

export async function POST() {
  try {
    const apiKey = await getStoredApiKey();
    const response = await fetch(`${getBackendBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: apiKey
        ? {
            Cookie: `${API_KEY_COOKIE_NAME}=${apiKey}`,
          }
        : undefined,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({ ok: response.ok }));
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.set("set-cookie", setCookie);
    } else {
      nextResponse.cookies.delete(API_KEY_COOKIE_NAME);
    }

    return nextResponse;
  } catch {
    const nextResponse = NextResponse.json({ error: "后端服务不可达" }, { status: 502 });
    nextResponse.cookies.delete(API_KEY_COOKIE_NAME);
    return nextResponse;
  }
}
