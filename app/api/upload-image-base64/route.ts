import { NextRequest, NextResponse } from "next/server";
import { getImageUploadApiUrl } from "@/lib/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(getImageUploadApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({ error: "上传失败" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "图片上传服务不可达" }, { status: 502 });
  }
}
