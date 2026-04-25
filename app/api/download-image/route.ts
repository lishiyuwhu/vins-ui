import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_FILENAME = "vins-result";

export const runtime = "nodejs";

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    return isPrivateIpv4(address);
  }

  if (family === 6) {
    return isPrivateIpv6(address);
  }

  return true;
}

async function assertPublicImageUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid-protocol");
  }

  if (url.username || url.password) {
    throw new Error("invalid-auth");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("private-address");
  }
}

function getSafeFilename(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) {
    return DEFAULT_FILENAME;
  }

  return trimmed.replace(/[\\/:*?"<>|\r\n]+/g, "_");
}

function getFilenameBaseFromUrl(url: URL) {
  const rawPathPart = url.pathname.split("/").filter(Boolean).at(-1) || "";
  let pathPart = rawPathPart;

  try {
    pathPart = decodeURIComponent(rawPathPart);
  } catch {
    pathPart = rawPathPart;
  }

  return getSafeFilename(pathPart);
}

function detectImageType(bytes: Uint8Array, fallbackContentType: string) {
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return { contentType: "image/gif", extension: "gif" };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  if (fallbackContentType.startsWith("image/")) {
    if (fallbackContentType.includes("jpeg")) {
      return { contentType: fallbackContentType, extension: "jpg" };
    }

    if (fallbackContentType.includes("webp")) {
      return { contentType: fallbackContentType, extension: "webp" };
    }

    if (fallbackContentType.includes("gif")) {
      return { contentType: fallbackContentType, extension: "gif" };
    }

    return { contentType: fallbackContentType, extension: "png" };
  }

  return null;
}

function getFilenameWithExtension(filename: string, extension: string) {
  if (/\.[a-z0-9]{2,5}$/i.test(filename)) {
    return filename;
  }

  return `${filename}.${extension}`;
}

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }

  try {
    await assertPublicImageUrl(url);
  } catch {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "图片下载失败" }, { status: 502 });
    }

    const fallbackContentType = response.headers.get("content-type") || "";
    const imageBytes = await response.arrayBuffer();
    const imageType = detectImageType(new Uint8Array(imageBytes), fallbackContentType);
    if (!imageType) {
      return NextResponse.json({ error: "下载目标不是图片" }, { status: 415 });
    }

    const filenameBase = getFilenameBaseFromUrl(url);
    const filename = getFilenameWithExtension(filenameBase, imageType.extension);

    return new NextResponse(imageBytes, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": imageType.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "图片下载服务不可达" }, { status: 502 });
  }
}
