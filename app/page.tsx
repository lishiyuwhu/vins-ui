"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";

type Recommendation = {
  id: string;
  prompt?: string;
  prompt_en?: string;
  display_text_zh?: string;
};

type TurnRecord = {
  turn_id: string;
  turn_index: number;
  user_cmd?: string | null;
  selected_rec_id?: string | null;
  resolved_cmd?: string | null;
  thinking?: boolean | null;
  use_web_search?: boolean | null;
  skip_intent?: boolean | null;
  result_type?: "execute" | "clarify" | string | null;
  clarify_question?: string | null;
  current_node?: string | null;
  queue_position?: number | null;
  queue_size?: number | null;
  status?: string | null;
  error?: string | null;
  input_img_url?: string | null;
  output_img_url?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
};

type TurnResponse = {
  turn?: TurnRecord;
  error?: string;
};

type SessionResponse = {
  session_id: string;
  original_img_url?: string | null;
  current_img_url?: string | null;
  recommendations: Recommendation[];
  recommendation_status?: string | null;
  recommendation_error?: string | null;
  turns?: TurnRecord[];
  pending_turn_id?: string | null;
  active_turn_id?: string | null;
};

type TurnStartResponse = {
  session_id?: string;
  turn_id?: string;
  status?: "queued" | "running" | string;
  queue_position?: number | null;
  queue_size?: number | null;
  error?: string;
};

type AuthState = {
  ok: boolean;
  username?: string;
  error?: string;
};

type WorkspaceMode = "agent" | "cosplay" | "style3";
type CosplayStatus = "idle" | "uploading" | "queued" | "running" | "succeeded" | "failed";
type Style3Status = "idle" | "uploading" | "queued" | "running" | "succeeded" | "failed";

type CosplayState = {
  inputPreviewUrl: string;
  inputFileName: string;
  uploadedImgUrl: string;
  resultImgUrls: string[];
  status: CosplayStatus;
  taskId: string;
  queuePosition: number | null;
  queueSize: number | null;
  progressStage: string;
  progressPercent: number | null;
  error: string;
};

type Style3State = {
  selectedStyleId: string;
  inputPreviewUrl: string;
  inputFileName: string;
  uploadedImgUrl: string;
  taskId: string;
  resultImgUrl: string;
  queuePosition: number | null;
  queueSize: number | null;
  progressStage: string;
  progressPercent: number | null;
  status: Style3Status;
  error: string;
};

type StyleTaskStartResponse = {
  task_id?: string;
  status?: "queued" | "running" | string;
  queue_position?: number | null;
  queue_size?: number | null;
  message?: string;
  created_at?: string;
};

type StyleTaskPollResponse = {
  status?: "queued" | "running" | "success" | "succeeded" | "completed" | "failed" | string;
  queue_position?: number | null;
  queue_size?: number | null;
  message?: string;
  error?: string;
  progress?: {
    stage?: string;
    percent?: number;
  };
  result?: {
    img_url?: string;
    img_urls?: string[];
    output?: {
      img_url?: string;
      img_urls?: string[];
      image_url?: string;
      images?: string[];
      result_img_url?: string;
    };
  };
};

type ChatMessage =
  | {
      id: string;
      role: "assistant";
      label: string;
      text: string;
      imageUrl?: string;
    }
  | {
      id: string;
      role: "user";
      kind?: "upload" | "command";
      label: string;
      text: string;
      imageUrl?: string;
    };

type LocalConversation = {
  id: string;
  dbId?: number;
  title: string;
  sessionId: string;
  originalImageUrl: string;
  currentImageUrl: string;
  uploadedImageUrl: string;
  uploadedFileName: string;
  recommendations: Recommendation[];
  recommendationStatus: string;
  dismissedRecommendationIds: string[];
  messages: ChatMessage[];
  userCmd: string;
  activeTurnId: string;
  activeTurnStatus: string;
  activeQueuePosition: number | null;
  activeQueueSize: number | null;
  statusText: string;
  requestError: string;
  externalEnabled: boolean;
  thinkingEnabled: boolean;
  hydratedFromDb?: boolean;
  pendingResumeTaskIds?: string[];
};

type DbConversation = {
  id: number;
  session_id: string | null;
  title: string;
  last_message_at: string | null;
  created_at: string;
};

type DbMessageImage = {
  url: string;
  type?: string;
};

type DbMessage = {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content_text: string | null;
  image_urls: DbMessageImage[] | null;
  status: "pending" | "completed" | "failed";
  task_id: string | null;
  error_message: string | null;
  created_at: string;
};

type AssistantContent = {
  resolved_cmd?: string | null;
  clarify_question?: string | null;
  result_type?: "execute" | "clarify" | null;
};

type SidebarIconName =
  | "new"
  | "spark"
  | "more"
  | "chat"
  | "about"
  | "download"
  | "gift"
  | "chevron";

type Style3Style = {
  id: string;
  label: string;
  category: string;
  gradient: string;
  imageUrl?: string;
};

const AGENT_NAME = "VINS Agent";
const USER_NAME = "用户";
const BACKEND_HINT = "https://bluepixel.vivo.com.cn";
const GATEWAY_BASE = process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || "https://bluepixel.vivo.com.cn";
const makeSvgIcon = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const TOPBAR_MESSAGE_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6A3.5 3.5 0 0 1 16.5 16H10l-4.7 3.1A.85.85 0 0 1 4 18.4V6.5Z" stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h8M8 11.5h5" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/></svg>',
);
const TOPBAR_BELL_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" fill="none"><path d="M10 21.5a2.6 2.6 0 0 0 2.5-1.9h-5A2.6 2.6 0 0 0 10 21.5Z" fill="#111827"/><path d="M3.2 9.5a6.8 6.8 0 1 1 13.6 0c0 5.4 1.7 6.6 1.7 6.6H1.5s1.7-1.2 1.7-6.6Z" stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/></svg>',
);
const SEND_BUTTON_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><rect x="5" y="5" width="10" height="10" rx="2.5" fill="#111827"/></svg>',
);
const COMPOSER_ADD_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M8 2.5v11M2.5 8h11" stroke="#111827" stroke-width="2" stroke-linecap="round"/></svg>',
);
const COMPOSER_WEB_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8.5" stroke="#111827" stroke-width="1.8"/><path d="M2.8 11h16.4M11 2.5c2.2 2.2 3.3 5 3.3 8.5s-1.1 6.3-3.3 8.5c-2.2-2.2-3.3-5-3.3-8.5S8.8 4.7 11 2.5Z" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
);
const COMPOSER_THINKING_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 22" fill="none"><path d="M10 2.5A6.5 6.5 0 0 0 6.2 14.3V18h7.6v-3.7A6.5 6.5 0 0 0 10 2.5Z" stroke="#111827" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.4 21h5.2M8 9.2l1.4 1.4L12.7 7" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
);
const COMPOSER_SEND_ICON = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><path d="M3.6 9.45 16.2 3.6a.7.7 0 0 1 .94.84l-3.72 12.38a.7.7 0 0 1-1.22.24l-3-3.82-3.7 2.12a.7.7 0 0 1-1.02-.75l.78-3.86-1.76-.06a.7.7 0 0 1-.25-1.24Z" fill="#111827"/><path d="m8.98 13.13 2.62-3.02" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" opacity=".72"/></svg>',
);
const SIDEBAR_AVATAR = makeSvgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><defs><linearGradient id="g" x1="10" x2="62" y1="62" y2="10" gradientUnits="userSpaceOnUse"><stop stop-color="#7dd3fc"/><stop offset=".55" stop-color="#dbeafe"/><stop offset="1" stop-color="#f8fafc"/></linearGradient></defs><rect width="72" height="72" rx="36" fill="url(#g)"/><path d="M23 43.5 33.6 21h7.8L30.8 43.5H23Zm15.2 7.5 10.6-22.5H56L45.4 51h-7.2Z" fill="#2563eb" opacity=".9"/></svg>',
);
const HIDE_ALL_RECOMMENDATIONS_KEY = "__all__";
const TURN_PROGRESS_COPY = "智能体正在分析图片并在生成中";
const RECOMMENDATION_POLL_INTERVAL_MS = 1500;
const RECOMMENDATION_POLL_MAX_ATTEMPTS = 40;
const TURN_POLL_INTERVAL_MS = 1500;
const TURN_POLL_MAX_ATTEMPTS = 120;
const COSPLAY_POLL_INTERVAL_MS = 2000;
const COSPLAY_POLL_MAX_ATTEMPTS = 150;
const STYLE3_INITIAL_POLL_DELAY_MS = 2000;
const STYLE3_POLL_INTERVAL_MS = 2000;
const STYLE3_POLL_MAX_ATTEMPTS = 150;
const STYLE3_POLL_MAX_CONSECUTIVE_ERRORS = 3;
const STYLE3_STYLES: Style3Style[] = [
  { id: "morning", label: "晨曦", category: "风景", imageUrl: "/style-transfer/morning.png", gradient: "linear-gradient(135deg, #fbbf24 0%, #fb7185 56%, #60a5fa 100%)" },
  { id: "nature", label: "晴空", category: "风景", imageUrl: "/style-transfer/nature.png", gradient: "linear-gradient(135deg, #38bdf8 0%, #86efac 100%)" },
  { id: "sunset", label: "暮霞", category: "风景", imageUrl: "/style-transfer/sunset.png", gradient: "linear-gradient(135deg, #f97316 0%, #db2777 56%, #312e81 100%)" },
  { id: "night", label: "夜幕", category: "风景", imageUrl: "/style-transfer/night.png", gradient: "linear-gradient(135deg, #020617 0%, #1e3a8a 100%)" },
  { id: "water_village", label: "江南", category: "风景", imageUrl: "/style-transfer/water_village.png", gradient: "linear-gradient(135deg, #99f6e4 0%, #60a5fa 100%)" },
  { id: "winter", label: "冬", category: "风景", imageUrl: "/style-transfer/winter.png", gradient: "linear-gradient(135deg, #e0f2fe 0%, #94a3b8 100%)" },
  { id: "chanyi", label: "禅意", category: "旅行", imageUrl: "/style-transfer/chanyi.png", gradient: "linear-gradient(135deg, #d9f99d 0%, #a3a3a3 100%)" },
  { id: "underwater", label: "水下万物", category: "旅行", imageUrl: "/style-transfer/underwater.png", gradient: "linear-gradient(135deg, #0e7490 0%, #172554 100%)" },
  { id: "meng_he", label: "梦核柔光", category: "旅行", imageUrl: "/style-transfer/meng_he.png", gradient: "linear-gradient(135deg, #f0abfc 0%, #93c5fd 100%)" },
  { id: "hk_style", label: "港风", category: "旅行", imageUrl: "/style-transfer/hk_style.png", gradient: "linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #111827 100%)" },
  { id: "tang_style", label: "盛世", category: "旅行", imageUrl: "/style-transfer/tang_style.png", gradient: "linear-gradient(135deg, #f59e0b 0%, #7c2d12 100%)" },
  { id: "fireworks", label: "烟花", category: "旅行", imageUrl: "/style-transfer/fireworks.png", gradient: "linear-gradient(135deg, #0f172a 0%, #7c3aed 52%, #f97316 100%)" },
  { id: "wasteland", label: "废土", category: "旅行", imageUrl: "/style-transfer/wasteland.png", gradient: "linear-gradient(135deg, #713f12 0%, #a8a29e 100%)" },
  { id: "rim_light", label: "氛围阳光", category: "旅行", imageUrl: "/style-transfer/rim_light.png", gradient: "linear-gradient(135deg, #fde68a 0%, #fb923c 100%)" },
  { id: "cosplay_gaoran", label: "高燃", category: "动漫", imageUrl: "/style-transfer/cosplay_gaoran.png", gradient: "linear-gradient(135deg, #991b1b 0%, #f97316 100%)" },
  { id: "cosplay_wuji", label: "无极", category: "动漫", imageUrl: "/style-transfer/cosplay_wuji.png", gradient: "linear-gradient(135deg, #312e81 0%, #0891b2 100%)" },
  { id: "cosplay_ice_snow", label: "冰雪", category: "动漫", imageUrl: "/style-transfer/cosplay_ice_snow.png", gradient: "linear-gradient(135deg, #dbeafe 0%, #38bdf8 100%)" },
  { id: "man_zhan_light", label: "暗调漫展光", category: "动漫", imageUrl: "/style-transfer/man_zhan_light.png", gradient: "linear-gradient(135deg, #111827 0%, #4f46e5 52%, #f472b6 100%)" },
  { id: "stage_light", label: "主舞台", category: "舞台", imageUrl: "/style-transfer/stage_light.png", gradient: "linear-gradient(135deg, #0f172a 0%, #c026d3 100%)" },
  { id: "initial_stage_light", label: "初舞台", category: "舞台", imageUrl: "/style-transfer/initial_stage_light.png", gradient: "linear-gradient(135deg, #1e3a8a 0%, #f9a8d4 100%)" },
  { id: "stage_dage", label: "打歌台", category: "舞台", imageUrl: "/style-transfer/stage_dage.png", gradient: "linear-gradient(135deg, #111827 0%, #22d3ee 52%, #fb7185 100%)" },
  { id: "heavy_rain", label: "雨天", category: "天气", imageUrl: "/style-transfer/heavy_rain.png", gradient: "linear-gradient(135deg, #0f172a 0%, #64748b 58%, #38bdf8 100%)" },
  { id: "polarlights", label: "极光", category: "天气", imageUrl: "/style-transfer/polarlights.png", gradient: "linear-gradient(135deg, #020617 0%, #10b981 48%, #8b5cf6 100%)" },
  { id: "rainbow", label: "彩虹", category: "天气", imageUrl: "/style-transfer/rainbow.png", gradient: "linear-gradient(135deg, #ef4444 0%, #f59e0b 25%, #22c55e 52%, #3b82f6 76%, #8b5cf6 100%)" },
  { id: "blizzard", label: "雪天", category: "天气", imageUrl: "/style-transfer/blizzard.png", gradient: "linear-gradient(135deg, #f8fafc 0%, #bae6fd 48%, #64748b 100%)" },
  { id: "heavy_fog", label: "雾天", category: "天气", imageUrl: "/style-transfer/heavy_fog.png", gradient: "linear-gradient(135deg, #f1f5f9 0%, #94a3b8 58%, #475569 100%)" },
];
const BUILD_COMMIT_SHA =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev-local";

function SidebarIcon({
  name,
  className = "",
}: {
  name: SidebarIconName;
  className?: string;
}) {
  return (
    <svg
      className={`sidebar-line-icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {name === "new" ? (
        <>
          <path d="M12 20h7" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </>
      ) : null}
      {name === "spark" ? (
        <>
          <path d="M5.5 8.5a3.5 3.5 0 0 1 3-3.46" />
          <path d="M18.5 15.5a3.5 3.5 0 0 1-3 3.46" />
          <path d="M4.8 16.2c1.3-3.8 3.6-5.4 7.1-3.8 3.4 1.5 5.7 1 7.3-3.1" />
          <path d="M4.8 16.2 4 11.3l4.4.9" />
          <path d="M19.2 7.8 20 12.7l-4.4-.9" />
        </>
      ) : null}
      {name === "more" ? (
        <>
          <rect width="6" height="6" x="4" y="4" rx="1.7" />
          <rect width="6" height="6" x="14" y="4" rx="1.7" />
          <rect width="6" height="6" x="4" y="14" rx="1.7" />
          <rect width="6" height="6" x="14" y="14" rx="1.7" />
        </>
      ) : null}
      {name === "chat" ? (
        <>
          <path d="M6.6 18.3c-2-1.2-3.1-3-3.1-5.3C3.5 8.1 7 5 12 5s8.5 3.1 8.5 8-3.5 8-8.5 8a10 10 0 0 1-3.2-.5L5 21.5Z" />
          <path d="M8.5 12.5h.01" />
          <path d="M12 12.5h.01" />
          <path d="M15.5 12.5h.01" />
        </>
      ) : null}
      {name === "about" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.8v5.4" />
          <path d="M12 7.6h.01" />
        </>
      ) : null}
      {name === "download" ? (
        <>
          <path d="M12 4v10" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          <path d="M5 15.5V20h14v-4.5" />
        </>
      ) : null}
      {name === "gift" ? (
        <>
          <path d="M4 10h16" />
          <path d="M5.5 10v10h13V10" />
          <path d="M12 10v10" />
          <path d="M4.8 6.8h14.4V10H4.8z" />
          <path d="M12 6.8C10.2 4 7.5 3.6 7 5.2c-.5 1.8 2.1 2.4 5 1.6Z" />
          <path d="M12 6.8c1.8-2.8 4.5-3.2 5-1.6.5 1.8-2.1 2.4-5 1.6Z" />
        </>
      ) : null}
      {name === "chevron" ? <path d="m9 6 6 6-6 6" /> : null}
    </svg>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildImageDownloadHref(imageUrl: string) {
  const params = new URLSearchParams({
    url: imageUrl,
  });

  return `${getGatewayRequestBaseUrl()}/web/download-image?${params.toString()}`;
}

function shouldUseSameOriginGateway() {
  return typeof window !== "undefined";
}

function getGatewayRequestBaseUrl() {
  return shouldUseSameOriginGateway() ? "" : GATEWAY_BASE;
}

async function fetchConversationsFromDb(): Promise<DbConversation[] | null> {
  try {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/web/conversations`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (Array.isArray(payload)) return payload as DbConversation[];
    if (Array.isArray(payload?.items)) return payload.items as DbConversation[];
    if (Array.isArray(payload?.conversations)) return payload.conversations as DbConversation[];
    return null;
  } catch {
    return null;
  }
}

async function fetchMessagesFromDb(dbId: number): Promise<DbMessage[] | null> {
  try {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/web/conversations/${dbId}/messages`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (Array.isArray(payload)) return payload as DbMessage[];
    if (Array.isArray(payload?.items)) return payload.items as DbMessage[];
    if (Array.isArray(payload?.messages)) return payload.messages as DbMessage[];
    return null;
  } catch {
    return null;
  }
}

async function renameConversationOnDb(dbId: number, title: string): Promise<boolean> {
  try {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/web/conversations/${dbId}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function deleteConversationOnDb(dbId: number): Promise<boolean> {
  try {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/web/conversations/${dbId}/delete`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function localConversationFromDb(db: DbConversation): LocalConversation {
  return {
    id: `db-${db.id}`,
    dbId: db.id,
    title: db.title || "未命名对话",
    sessionId: db.session_id ?? "",
    originalImageUrl: "",
    currentImageUrl: "",
    uploadedImageUrl: "",
    uploadedFileName: "",
    recommendations: [],
    recommendationStatus: "idle",
    dismissedRecommendationIds: [HIDE_ALL_RECOMMENDATIONS_KEY],
    messages: [],
    userCmd: "",
    activeTurnId: "",
    activeTurnStatus: "",
    activeQueuePosition: null,
    activeQueueSize: null,
    statusText: "",
    requestError: "",
    externalEnabled: false,
    thinkingEnabled: true,
    hydratedFromDb: false,
  };
}

function pickImageByType(images: DbMessageImage[] | null | undefined, type: "input" | "output"): string | undefined {
  if (!images || images.length === 0) return undefined;
  const typed = images.find((image) => image.type === type);
  if (typed?.url) return typed.url;
  return images[0]?.url;
}

function parseAssistantContent(text: string | null | undefined): AssistantContent | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed as AssistantContent;
    return null;
  } catch {
    return null;
  }
}

function chatMessagesFromDb(items: DbMessage[]): { messages: ChatMessage[]; pendingTaskIds: string[] } {
  const messages: ChatMessage[] = [];
  const pendingTaskIds: string[] = [];

  if (items.length === 0) {
    messages.push({
      id: "assistant-welcome",
      role: "assistant",
      label: AGENT_NAME,
      text: "欢迎使用 VINS Agent。复制粘贴、点击加号上传，或将图片拖入工作区开始。\n随后可以通过自然语言继续进行多轮图像编辑。",
    });
    return { messages, pendingTaskIds };
  }

  for (const item of items) {
    if (item.role === "user") {
      if (item.content_text && /^rec_\d+$/i.test(item.content_text.trim())) {
        continue;
      }
      const inputImage = pickImageByType(item.image_urls, "input");
      const isUpload = Boolean(inputImage) && (!item.content_text || item.content_text.trim() === "");
      messages.push({
        id: `db-msg-${item.id}`,
        role: "user",
        kind: isUpload ? "upload" : "command",
        label: USER_NAME,
        text: isUpload ? "用户上传图片" : (item.content_text ?? ""),
        imageUrl: inputImage,
      });
      continue;
    }

    if (item.role === "assistant") {
      if (item.status === "pending") {
        if (item.task_id) pendingTaskIds.push(item.task_id);
        continue;
      }

      if (item.status === "failed") {
        messages.push({
          id: `db-msg-${item.id}`,
          role: "assistant",
          label: AGENT_NAME,
          text: item.error_message || "处理失败",
        });
        continue;
      }

      const parsed = parseAssistantContent(item.content_text);
      const outputImage = pickImageByType(item.image_urls, "output");
      if (parsed?.result_type === "clarify" && parsed.clarify_question) {
        messages.push({
          id: `db-msg-${item.id}`,
          role: "assistant",
          label: AGENT_NAME,
          text: parsed.clarify_question,
        });
      } else {
        messages.push({
          id: `db-msg-${item.id}`,
          role: "assistant",
          label: AGENT_NAME,
          text: parsed?.resolved_cmd || item.content_text || (outputImage ? "已生成编辑结果" : ""),
          imageUrl: outputImage,
        });
      }
    }
  }

  return { messages, pendingTaskIds };
}

function buildUploadMessage(imageUrl: string): ChatMessage {
  return {
    id: `local-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: "user",
    kind: "upload",
    label: USER_NAME,
    text: "用户上传图片",
    imageUrl,
  };
}

function isUserCommandMessage(message: ChatMessage) {
  return message.role === "user" && message.kind !== "upload";
}

function hasCommandAfterLatestUpload(messages: ChatMessage[]) {
  const latestUploadIndex = messages.findLastIndex(
    (message) => message.role === "user" && message.kind === "upload",
  );
  const messagesToCheck = latestUploadIndex >= 0 ? messages.slice(latestUploadIndex + 1) : messages;

  return messagesToCheck.some(isUserCommandMessage);
}

function ImagePreview({
  src,
  alt,
  className = "",
  canDownload = false,
  onPreview,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  canDownload?: boolean;
  onPreview: (imageUrl: string) => void;
  onLoad?: () => void;
}) {
  return (
    <div className={`assistant-image-frame${className ? ` ${className}` : ""}`}>
      <img
        src={src}
        alt={alt}
        className="assistant-image"
        onClick={() => onPreview(src)}
        onLoad={onLoad}
      />
      {canDownload ? (
        <a href={buildImageDownloadHref(src)} className="assistant-image-download">
          下载
        </a>
      ) : null}
    </div>
  );
}

function buildMessagesFromTurns(turns: TurnRecord[], currentImgUrl?: string | null) {
  const items: ChatMessage[] = [
    {
      id: "assistant-welcome",
      role: "assistant",
      label: AGENT_NAME,
      text: "欢迎使用 VINS Agent。复制粘贴、点击加号上传，或将图片拖入工作区开始。\n随后可以通过自然语言继续进行多轮图像编辑。",
    },
  ];

  let fallbackInputImageUrl = currentImgUrl ?? "";

  turns.forEach((turn) => {
    if (turn.user_cmd) {
      items.push({
        id: `${turn.turn_id}-user`,
        role: "user",
        kind: "command",
        label: USER_NAME,
        text: turn.user_cmd,
        imageUrl: turn.input_img_url || fallbackInputImageUrl || undefined,
      });
    }

    if (turn.result_type === "clarify" && turn.clarify_question) {
      items.push({
        id: `${turn.turn_id}-clarify`,
        role: "assistant",
        label: AGENT_NAME,
        text: turn.clarify_question,
      });
    } else if (turn.resolved_cmd || turn.output_img_url) {
      items.push({
        id: `${turn.turn_id}-assistant`,
        role: "assistant",
        label: AGENT_NAME,
        text: turn.resolved_cmd || "已生成编辑结果",
        imageUrl: turn.output_img_url ?? undefined,
      });
    }

    if (turn.output_img_url) {
      fallbackInputImageUrl = turn.output_img_url;
    }
  });

  return items;
}

function mergeTurnMessage(messages: ChatMessage[], turn: TurnRecord) {
  if (turn.result_type === "clarify" && turn.clarify_question) {
    const id = `${turn.turn_id}-clarify`;
    if (messages.some((message) => message.id === id)) {
      return messages;
    }

    return [
      ...messages,
      {
        id,
        role: "assistant" as const,
        label: AGENT_NAME,
        text: turn.clarify_question,
      },
    ];
  }

  if (!turn.resolved_cmd && !turn.output_img_url) {
    return messages;
  }

  const id = `${turn.turn_id}-assistant`;
  if (messages.some((message) => message.id === id)) {
    return messages.map((message) =>
      message.id === id
        ? {
            ...message,
            text: turn.resolved_cmd || message.text,
            imageUrl: turn.output_img_url || message.imageUrl,
          }
        : message,
    );
  }

  return [
    ...messages,
    {
      id,
      role: "assistant" as const,
      label: AGENT_NAME,
      text: turn.resolved_cmd || "已生成编辑结果",
      imageUrl: turn.output_img_url ?? undefined,
    },
  ];
}

function hasMatchingUserMessage(
  messages: ChatMessage[],
  text: string,
  imageUrl?: string,
) {
  return messages.some(
    (message) =>
      message.role === "user" &&
      message.text === text &&
      (!imageUrl || message.imageUrl === imageUrl),
  );
}

function mergeSessionTurnMessages(
  messages: ChatMessage[],
  turns: TurnRecord[],
  currentImgUrl?: string | null,
) {
  const nextMessages = messages.length > 0 ? [...messages] : buildMessagesFromTurns([], "");
  let fallbackInputImageUrl = currentImgUrl ?? "";
  let shouldAttachNextUserImage = !nextMessages.some((message) => message.role === "user");

  turns.forEach((turn) => {
    const userText = turn.user_cmd?.trim();
    const inputImageUrl = shouldAttachNextUserImage
      ? turn.input_img_url || fallbackInputImageUrl || undefined
      : undefined;

    if (
      userText &&
      !nextMessages.some((message) => message.id === `${turn.turn_id}-user`) &&
      !hasMatchingUserMessage(nextMessages, userText, inputImageUrl)
    ) {
      nextMessages.push({
        id: `${turn.turn_id}-user`,
        role: "user",
        kind: "command",
        label: USER_NAME,
        text: userText,
        imageUrl: inputImageUrl,
      });
    }
    if (userText) {
      shouldAttachNextUserImage = false;
    }

    const mergedMessages = mergeTurnMessage(nextMessages, turn);
    nextMessages.splice(0, nextMessages.length, ...mergedMessages);

    if (turn.output_img_url) {
      fallbackInputImageUrl = turn.output_img_url;
    }
  });

  return nextMessages;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function getFirstImageFile(files: FileList | File[]) {
  return Array.from(files).find((file) => file.type.startsWith("image/")) ?? null;
}

function hasImageTransferData(dataTransfer: DataTransfer) {
  if (getFirstImageFile(dataTransfer.files)) {
    return true;
  }

  return Array.from(dataTransfer.items).some(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  );
}

function getSessionActivityTurnId(session: SessionResponse) {
  return session.pending_turn_id || session.active_turn_id || "";
}

function getQueueProgressPercent(status: string, position: number | null, size: number | null) {
  if (status === "running") {
    return 100;
  }

  if (status !== "queued" || typeof position !== "number" || typeof size !== "number" || size <= 0) {
    return null;
  }

  const completedSlots = Math.max(0, size - Math.max(position, 1) + 1);
  return Math.min(100, Math.max(6, Math.round((completedSlots / size) * 100)));
}

export default function Home() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authRequestError, setAuthRequestError] = useState("");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>("agent");
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionCounter, setSessionCounter] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cosplay, setCosplay] = useState<CosplayState>({
    inputPreviewUrl: "",
    inputFileName: "",
    uploadedImgUrl: "",
    resultImgUrls: [],
    status: "idle",
    taskId: "",
    queuePosition: null,
    queueSize: null,
    progressStage: "",
    progressPercent: null,
    error: "",
  });
  const [style3, setStyle3] = useState<Style3State>({
    selectedStyleId: "",
    inputPreviewUrl: "",
    inputFileName: "",
    uploadedImgUrl: "",
    taskId: "",
    resultImgUrl: "",
    queuePosition: null,
    queueSize: null,
    progressStage: "",
    progressPercent: null,
    status: "idle",
    error: "",
  });
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [modeNoticeVisible, setModeNoticeVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const initializedSessionRef = useRef(false);
  const dbConversationsLoadedRef = useRef(false);
  const hydratingDbConversationsRef = useRef(new Set<string>());
  const pollingTurnRef = useRef("");
  const style3UploadRunRef = useRef("");
  const startedRecommendationSessionsRef = useRef(new Set<string>());
  const modeNoticeTimerRef = useRef<number | null>(null);
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );
  const sessionId = activeConversation?.sessionId ?? "";
  const originalImageUrl = activeConversation?.originalImageUrl ?? "";
  const currentImageUrl = activeConversation?.currentImageUrl ?? "";
  const uploadedImageUrl = activeConversation?.uploadedImageUrl ?? "";
  const uploadedFileName = activeConversation?.uploadedFileName ?? "";
  const recommendations = activeConversation?.recommendations ?? [];
  const recommendationStatus = activeConversation?.recommendationStatus ?? "idle";
  const dismissedRecommendationIds = activeConversation?.dismissedRecommendationIds ?? [];
  const messages = activeConversation?.messages ?? buildMessagesFromTurns([], "");
  const userCmd = activeConversation?.userCmd ?? "";
  const externalEnabled = activeConversation?.externalEnabled ?? false;
  const thinkingEnabled = activeConversation?.thinkingEnabled ?? true;
  const statusText = activeConversation?.statusText ?? "准备进入场景绘画";
  const activeTurnId = activeConversation?.activeTurnId ?? "";
  const activeTurnStatus = activeConversation?.activeTurnStatus ?? "";
  const activeQueuePosition = activeConversation?.activeQueuePosition ?? null;
  const activeQueueSize = activeConversation?.activeQueueSize ?? null;
  const requestError = activeConversation?.requestError ?? "";
  const isAgentWorkspace = activeWorkspace === "agent";
  const isCosplayWorkspace = activeWorkspace === "cosplay";
  const isStyle3Workspace = activeWorkspace === "style3";
  const isCosplayBusy =
    cosplay.status === "uploading" || cosplay.status === "queued" || cosplay.status === "running";
  const isStyle3Busy =
    style3.status === "uploading" || style3.status === "queued" || style3.status === "running";
  const isStyle3ResultView = Boolean(
    style3.inputPreviewUrl &&
      (
        style3.status === "uploading" ||
        style3.status === "queued" ||
        style3.status === "running" ||
        style3.status === "succeeded"
      ),
  );
  const hasBoundImage = Boolean(originalImageUrl);
  const hasActiveTurn = Boolean(activeTurnId);
  const isTurnBusy = isStreaming || hasActiveTurn;
  const canSendMessage = Boolean(auth?.ok && sessionId && hasBoundImage && !isTurnBusy);
  const canUseSendButton = Boolean(
    activeTurnId || (auth?.ok && sessionId && hasBoundImage && !isTurnBusy),
  );
  const sortedConversations = useMemo(
    () => {
      const localOnly = conversations.filter((c) => !c.dbId);
      const dbBacked = conversations.filter((c) => c.dbId);
      return [...localOnly.slice().reverse(), ...dbBacked];
    },
    [conversations],
  );
  const queueProgressPercent = getQueueProgressPercent(
    activeTurnStatus,
    activeQueuePosition,
    activeQueueSize,
  );

  const scrollWorkspaceToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    window.requestAnimationFrame(() => {
      workspace.scrollTo({
        top: workspace.scrollHeight,
        behavior,
      });
    });
  }, []);

  function updateConversation(
    id: string,
    updater: (conversation: LocalConversation) => LocalConversation,
  ) {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === id ? updater(conversation) : conversation,
      ),
    );
  }

  function updateActiveConversation(
    updater: (conversation: LocalConversation) => LocalConversation,
  ) {
    if (!activeConversationId) return;
    updateConversation(activeConversationId, updater);
  }

  function updateConversationBySessionId(
    targetSessionId: string,
    updater: (conversation: LocalConversation) => LocalConversation,
  ) {
    if (!targetSessionId) return;
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.sessionId === targetSessionId ? updater(conversation) : conversation,
      ),
    );
  }

  useEffect(() => {
    let ignore = false;

    async function loadAuth() {
      try {
        const response = await fetch(`${getGatewayRequestBaseUrl()}/web/me`, { cache: "no-store", credentials: "include" });

        if (response.ok) {
          const user = await response.json();
          if (!ignore) {
            setAuth({ ok: true, username: user.username });
          }
        } else if (response.status === 401) {
          if (!ignore) {
            setAuth({ ok: false, error: "未登录" });
          }
        } else {
          if (!ignore) {
            setAuth({ ok: false, error: "登录状态检查失败" });
          }
        }
      } catch {
        if (!ignore) {
          setAuth({ ok: false, error: "登录状态检查失败" });
        }
      }
    }

    loadAuth();

    return () => {
      ignore = true;
    };
  }, []);

  async function createEmptySession(nextTitle: string, nextIndex: number) {
    if (isCreating) return;

    setIsCreating(true);

    try {
      const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("未登录，请先登录");
        }
        const err = await response.json().catch(() => ({ detail: "创建会话失败" }));
        throw new Error(err.detail || "创建会话失败");
      }

      const payload = (await response.json()) as SessionResponse;

      setSessionCounter(nextIndex);
      const localId = `local-${payload.session_id}`;
      const nextConversation: LocalConversation = {
        id: localId,
        title: nextTitle,
        sessionId: payload.session_id,
        originalImageUrl: "",
        currentImageUrl: "",
        uploadedImageUrl: "",
        uploadedFileName: "",
        recommendations: payload.recommendations ?? [],
        recommendationStatus: payload.recommendation_status ?? "idle",
        dismissedRecommendationIds: [],
        messages: buildMessagesFromTurns([], ""),
        userCmd: "",
        activeTurnId: "",
        activeTurnStatus: "",
        activeQueuePosition: null,
        activeQueueSize: null,
        statusText: "空绘画已创建，等待上传图片",
        requestError: "",
        externalEnabled: false,
        thinkingEnabled: true,
      };
      setConversations((prev) => [...prev, nextConversation]);
      setActiveConversationId(localId);
    } catch (error) {
      const localId = `failed-${Date.now()}`;
      setConversations((prev) => [
        ...prev,
        {
          id: localId,
          title: nextTitle,
          sessionId: "",
          originalImageUrl: "",
          currentImageUrl: "",
          uploadedImageUrl: "",
          uploadedFileName: "",
          recommendations: [],
          recommendationStatus: "idle",
          dismissedRecommendationIds: [],
          messages: buildMessagesFromTurns([], ""),
          userCmd: "",
          activeTurnId: "",
          activeTurnStatus: "",
          activeQueuePosition: null,
          activeQueueSize: null,
          statusText: "创建空绘画失败",
          requestError: error instanceof Error ? error.message : "创建会话失败",
          externalEnabled: false,
          thinkingEnabled: true,
        },
      ]);
      setActiveConversationId(localId);
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    if (!auth?.ok || activeWorkspace !== "agent" || isCreating) {
      return;
    }

    if (!dbConversationsLoadedRef.current) {
      return;
    }

    if (initializedSessionRef.current && conversations.length > 0) {
      return;
    }

    initializedSessionRef.current = true;
    if (conversations.length === 0) {
      void createEmptySession("图片处理 #1", 1);
    }
  }, [activeWorkspace, auth?.ok, conversations.length, isCreating]);

  useEffect(() => {
    if (!auth?.ok) {
      return;
    }

    let cancelled = false;
    (async () => {
      const dbs = await fetchConversationsFromDb();
      if (cancelled) return;
      dbConversationsLoadedRef.current = true;
      if (!dbs || dbs.length === 0) {
        return;
      }
      setConversations((prev) => {
        const fromDb = dbs.map((db) => {
          const existing = prev.find((c) => c.id === `db-${db.id}`);
          if (existing) {
            return { ...existing, title: db.title || existing.title, sessionId: db.session_id ?? existing.sessionId };
          }
          return localConversationFromDb(db);
        });
        const localOnly = prev.filter((c) => !c.dbId);
        return [...localOnly, ...fromDb];
      });
      setActiveConversationId((current) => {
        if (current) return current;
        const firstDb = dbs[0];
        return firstDb ? `db-${firstDb.id}` : current;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [auth?.ok]);

  useEffect(() => {
    if (!auth?.ok || !activeConversationId) return;
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv?.dbId || conv.hydratedFromDb) return;
    if (hydratingDbConversationsRef.current.has(conv.id)) return;
    hydratingDbConversationsRef.current.add(conv.id);

    let cancelled = false;
    (async () => {
      const items = await fetchMessagesFromDb(conv.dbId!);
      if (cancelled) {
        hydratingDbConversationsRef.current.delete(conv.id);
        return;
      }
      if (!items) {
        hydratingDbConversationsRef.current.delete(conv.id);
        return;
      }
      const { messages, pendingTaskIds } = chatMessagesFromDb(items);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? {
                ...c,
                messages,
                hydratedFromDb: true,
                pendingResumeTaskIds: pendingTaskIds,
              }
            : c,
        ),
      );
      hydratingDbConversationsRef.current.delete(conv.id);
      if (conv.sessionId) {
        for (const tid of pendingTaskIds) {
          void pollTurnResult(conv.sessionId, tid);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, auth?.ok, conversations]);

  useEffect(() => {
    if (!previewImageUrl) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImageUrl("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImageUrl]);

  useEffect(() => {
    return () => {
      if (modeNoticeTimerRef.current !== null) {
        window.clearTimeout(modeNoticeTimerRef.current);
      }
    };
  }, []);

  function showPendingModeNotice() {
    setModeNoticeVisible(true);
    if (modeNoticeTimerRef.current !== null) {
      window.clearTimeout(modeNoticeTimerRef.current);
    }

    modeNoticeTimerRef.current = window.setTimeout(() => {
      setModeNoticeVisible(false);
      modeNoticeTimerRef.current = null;
    }, 1600);
  }

  const visibleSuggestions = useMemo(() => {
    const hasCommandMessagesForCurrentImage = hasCommandAfterLatestUpload(messages);

    if (
      hasCommandMessagesForCurrentImage ||
      dismissedRecommendationIds.length > 0 ||
      dismissedRecommendationIds.includes(HIDE_ALL_RECOMMENDATIONS_KEY) ||
      isTurnBusy
    ) {
      return [];
    }

    if (sessionId && recommendations.length > 0) {
      return recommendations
        .filter((item) => Boolean(item.display_text_zh?.trim()))
        .slice(0, 3)
        .filter((item) => !dismissedRecommendationIds.includes(item.id))
        .map((item, index) => ({
          index: index + 1,
          title: item.display_text_zh || `推荐 ${index + 1}`,
          recId: item.id,
        }));
    }

    return [];
  }, [
    dismissedRecommendationIds,
    isTurnBusy,
    messages,
    recommendations,
    sessionId,
  ]);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  );
  const activeProgressAfterMessageId = useMemo(() => {
    if (!isTurnBusy) return "";

    return [...messages].reverse().find((message) => message.role === "user")?.id ?? "";
  }, [isTurnBusy, messages]);
  const latestMessageKey = useMemo(() => {
    const latestMessage = messages.at(-1);
    return latestMessage
      ? `${latestMessage.id}:${latestMessage.role}:${latestMessage.imageUrl ?? ""}:${latestMessage.text}`
      : "";
  }, [messages]);

  useEffect(() => {
    if (!hasUserMessages) {
      return;
    }

    scrollWorkspaceToBottom();
  }, [
    activeProgressAfterMessageId,
    activeTurnStatus,
    hasUserMessages,
    latestMessageKey,
    scrollWorkspaceToBottom,
    statusText,
  ]);

  const showUploadedPreview = useMemo(
    () =>
      Boolean(
        sessionId &&
          uploadedImageUrl &&
          !hasUserMessages,
      ),
    [hasUserMessages, sessionId, uploadedImageUrl],
  );

  const uploadedPreviewName = useMemo(() => {
    if (uploadedFileName) {
      return uploadedFileName.toUpperCase();
    }

    if (!uploadedImageUrl) return "VOID_02.PNG";

    return "VOID_02.PNG";
  }, [uploadedFileName, uploadedImageUrl]);
  const uploadedPreviewImageUrl = uploadedImageUrl || originalImageUrl || currentImageUrl;
  const selectedStyle3Style = useMemo(
    () => STYLE3_STYLES.find((style) => style.id === style3.selectedStyleId) ?? null,
    [style3.selectedStyleId],
  );
  const cosplayStatusText =
    cosplay.status === "uploading"
      ? "正在上传图片"
      : cosplay.status === "queued"
        ? "任务排队中"
      : cosplay.status === "running"
        ? "正在生成 cosplay 姿势推荐"
        : cosplay.status === "succeeded"
          ? "cosplay姿势推荐已完成"
          : cosplay.status === "failed"
            ? "处理失败"
            : "等待输入图片";
  const style3StatusText =
    style3.status === "uploading"
      ? "正在上传图片"
      : style3.status === "queued"
        ? "任务排队中"
      : style3.status === "running"
        ? "正在生成风格编辑结果"
      : style3.status === "succeeded"
        ? "风格编辑已完成"
        : style3.status === "failed"
          ? "处理失败"
          : selectedStyle3Style
            ? `已选择 ${selectedStyle3Style.label}，请上传图片`
            : "请先选择风格，再上传图片";
  const style3QueueText = useMemo(() => {
    if (style3.status === "queued") {
      const position = style3.queuePosition;
      const size = style3.queueSize;
      if (typeof position === "number" && typeof size === "number" && size > 0) {
        return `排队 ${position} / ${size}`;
      }
      if (typeof position === "number") {
        return `排队 ${position}`;
      }
    }

    if (style3.status === "running" && typeof style3.progressPercent === "number") {
      return `进度 ${style3.progressPercent}%`;
    }

    return "";
  }, [
    style3.progressPercent,
    style3.queuePosition,
    style3.queueSize,
    style3.status,
  ]);
  const style3ResultPlaceholderText =
    style3.status === "uploading"
      ? "正在上传图片"
      : style3.status === "queued"
        ? style3QueueText || "任务排队中"
      : style3.status === "running"
        ? style3QueueText || "正在生成风格编辑结果"
      : "等待结果图";
  const cosplayQueueText = useMemo(() => {
    if (cosplay.status === "queued") {
      const position = cosplay.queuePosition;
      const size = cosplay.queueSize;
      if (typeof position === "number" && typeof size === "number" && size > 0) {
        return `排队 ${position} / ${size}`;
      }
      if (typeof position === "number") {
        return `排队 ${position}`;
      }
    }

    return "";
  }, [
    cosplay.queuePosition,
    cosplay.queueSize,
    cosplay.status,
  ]);

  async function refreshSession(id: string) {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${id}`, { cache: "no-store", credentials: "include" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as SessionResponse;
    updateConversationBySessionId(id, (conversation) => {
      const activityTurnId = getSessionActivityTurnId(payload);
      const activityTurn = payload.turns?.find((turn) => turn.turn_id === activityTurnId);

      return {
        ...conversation,
        originalImageUrl: payload.original_img_url ?? "",
        currentImageUrl:
          payload.turns && payload.turns.length > 0
            ? payload.current_img_url ?? ""
            : conversation.uploadedImageUrl || payload.current_img_url || "",
        recommendations: payload.recommendations ?? [],
        recommendationStatus: payload.recommendation_status ?? "idle",
        dismissedRecommendationIds:
          payload.turns && payload.turns.length > 0 ? [HIDE_ALL_RECOMMENDATIONS_KEY] : [],
        activeTurnId: activityTurnId,
        activeTurnStatus:
          activityTurn?.status || (payload.pending_turn_id ? "queued" : payload.active_turn_id ? "running" : ""),
        activeQueuePosition: activityTurn?.queue_position ?? null,
        activeQueueSize: activityTurn?.queue_size ?? null,
        messages: mergeSessionTurnMessages(
          conversation.messages,
          payload.turns ?? [],
          conversation.uploadedImageUrl || payload.current_img_url,
        ),
      };
    });

    return payload;
  }

  // Lightweight poll: only updates recommendations and recommendationStatus.
  // Does NOT touch messages, currentImageUrl, dismissedRecommendationIds, or turn state.
  // Use this instead of refreshSession whenever only recommendation data is needed.
  async function refreshRecommendationsOnly(id: string) {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${id}`, { cache: "no-store", credentials: "include" });
    if (!response.ok) return null;
    const payload = (await response.json()) as SessionResponse;
    updateConversationBySessionId(id, (conversation) => ({
      ...conversation,
      recommendations: payload.recommendations ?? [],
      recommendationStatus:
        startedRecommendationSessionsRef.current.has(id) &&
        conversation.recommendationStatus === "running" &&
        (payload.recommendation_status === "idle" || !payload.recommendation_status)
          ? "running"
          : payload.recommendation_status ?? "idle",
    }));
    return payload;
  }

  useEffect(() => {
    if (!sessionId || recommendationStatus !== "running" || !hasBoundImage) {
      return;
    }

    let cancelled = false;

    async function pollRecommendations() {
      for (let attempt = 0; attempt < RECOMMENDATION_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return;

        if (attempt > 0) {
          await wait(RECOMMENDATION_POLL_INTERVAL_MS);
        }

        if (cancelled) return;

        const payload = await refreshRecommendationsOnly(sessionId);
        if (!payload) {
          continue;
        }

        if (payload.recommendation_status === "succeeded") {
          startedRecommendationSessionsRef.current.delete(sessionId);
          updateConversationBySessionId(sessionId, (conversation) => ({
            ...conversation,
            statusText: "已生成推荐指令",
          }));
          return;
        }

        if (payload.recommendation_status === "failed") {
          startedRecommendationSessionsRef.current.delete(sessionId);
          updateConversationBySessionId(sessionId, (conversation) => ({
            ...conversation,
            requestError: payload.recommendation_error || "推荐生成失败",
            statusText: "推荐生成失败",
          }));
          return;
        }
      }

      if (!cancelled) {
        updateConversationBySessionId(sessionId, (conversation) => ({
          ...conversation,
          statusText: "推荐生成时间较长，可稍后刷新会话",
        }));
      }
    }

    void pollRecommendations();

    return () => {
      cancelled = true;
    };
  }, [hasBoundImage, recommendationStatus, sessionId]);

  async function syncAuthState() {
    const response = await fetch(`${getGatewayRequestBaseUrl()}/web/me`, { cache: "no-store", credentials: "include" });

    if (response.ok) {
      const user = await response.json();
      setAuth({ ok: true, username: user.username });
      setAuthRequestError("");
      initializedSessionRef.current = false;
    } else if (response.status === 401) {
      throw new Error("未登录");
    } else {
      const err = await response.json().catch(() => ({ detail: "登录状态检查失败" }));
      throw new Error(err.detail || "登录状态检查失败");
    }
  }

  async function handleLogin() {
    if (!usernameInput || !passwordInput || isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthRequestError("");

    try {
      const formData = new FormData();
      formData.append("username", usernameInput);
      formData.append("password", passwordInput);

      const response = await fetch(`${getGatewayRequestBaseUrl()}/web/login`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const user = await response.json();
        setAuth({ ok: true, username: user.username });
        setAuthRequestError("");
        initializedSessionRef.current = false;
      } else if (response.status === 401) {
        throw new Error("用户名或密码错误");
      } else if (response.status === 429) {
        throw new Error("登录失败次数过多，请稍后再试");
      } else {
        const err = await response.json().catch(() => ({ detail: "登录失败" }));
        throw new Error(err.detail || "登录失败");
      }
    } catch (error) {
      setAuth({ ok: false, error: "登录失败" });
      setAuthRequestError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await fetch(`${getGatewayRequestBaseUrl()}/web/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    initializedSessionRef.current = false;
    dbConversationsLoadedRef.current = false;
    hydratingDbConversationsRef.current.clear();
    setAuth({ ok: false, error: "未登录" });
    setConversations([]);
    setActiveConversationId("");
    setSessionCounter(0);
  }

  async function handleRenameConversation(conversation: LocalConversation) {
    if (!conversation.dbId) return;
    if (typeof window === "undefined") return;
    const next = window.prompt("重命名对话", conversation.title);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === conversation.title) return;
    const ok = await renameConversationOnDb(conversation.dbId, trimmed);
    if (!ok) {
      window.alert("重命名失败，请稍后再试");
      return;
    }
    updateConversation(conversation.id, (c) => ({ ...c, title: trimmed }));
  }

  async function handleDeleteConversation(conversation: LocalConversation) {
    if (!conversation.dbId) return;
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(`确认删除对话「${conversation.title}」？此操作不可撤销。`);
    if (!confirmed) return;
    const ok = await deleteConversationOnDb(conversation.dbId);
    if (!ok) {
      window.alert("删除失败，请稍后再试");
      return;
    }
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== conversation.id);
      if (activeConversationId === conversation.id) {
        const fallback = remaining[0]?.id ?? "";
        setActiveConversationId(fallback);
      }
      return remaining;
    });
  }

  function handleCreateEntry() {
    if (isCreating || isTurnBusy || isUploadingImage || !auth?.ok) return;

    setActiveWorkspace("agent");
    const nextIndex = sessionCounter + 1;
    const nextTitle = `图片处理 #${nextIndex}`;
    void createEmptySession(nextTitle, nextIndex);
  }

  function handleSelectImage() {
    if (isAgentWorkspace && isUploadingImage) {
      return;
    }

    if (isCosplayWorkspace && isCosplayBusy) {
      return;
    }

    if (isStyle3Workspace && isStyle3Busy) {
      return;
    }

    if (!auth?.ok) {
      if (isCosplayWorkspace) {
        setCosplay((prev) => ({
          ...prev,
          status: "failed",
          error: auth === null ? "登录状态检查中，请稍后再试" : "请先登录",
        }));
        return;
      }

      if (isStyle3Workspace) {
        setStyle3((prev) => ({
          ...prev,
          status: "failed",
          error: auth === null ? "登录状态检查中，请稍后再试" : "请先登录",
        }));
        return;
      }

      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "请先登录",
      }));
      return;
    }

    if (isStyle3Workspace && !style3.selectedStyleId) {
      setStyle3((prev) => ({
        ...prev,
        status: "failed",
        error: "请先选择风格，再上传图片",
      }));
      return;
    }

    if (isAgentWorkspace && !sessionId) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "空绘画还未创建完成，请稍后再试",
      }));
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  }

  function handleStyle3Select(styleId: string) {
    if (isStyle3Busy) {
      return;
    }

    style3UploadRunRef.current = "";
    setStyle3({
      selectedStyleId: styleId,
      inputPreviewUrl: "",
      inputFileName: "",
      uploadedImgUrl: "",
      taskId: "",
      resultImgUrl: "",
      queuePosition: null,
      queueSize: null,
      progressStage: "",
      progressPercent: null,
      status: "idle",
      error: "",
    });
  }

  function handleStyle3Reset() {
    if (isStyle3Busy) {
      return;
    }

    style3UploadRunRef.current = "";
    setStyle3({
      selectedStyleId: "",
      inputPreviewUrl: "",
      inputFileName: "",
      uploadedImgUrl: "",
      taskId: "",
      resultImgUrl: "",
      queuePosition: null,
      queueSize: null,
      progressStage: "",
      progressPercent: null,
      status: "idle",
      error: "",
    });
  }

  async function parseGatewayError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    if (response.status === 400) return "不支持的风格类型";
    if (response.status === 401) return "请先登录";
    if (response.status === 404) return "任务不存在或已过期，请重新上传";
    if (response.status === 429) return "服务繁忙，请稍后再试";
    if (response.status === 503) return "服务暂时不可用，请稍后再试";
    if (response.status === 502) return "服务暂时未返回结果图片";
    if (response.status === 504) return "服务处理超时，请稍后重试";
    return fallback;
  }

  function getStyleTaskResultUrls(payload: StyleTaskPollResponse) {
    const candidates = [
      payload.result?.output?.img_urls,
      payload.result?.output?.images,
      payload.result?.img_urls,
      payload.result?.output?.img_url,
      payload.result?.output?.image_url,
      payload.result?.output?.result_img_url,
      payload.result?.img_url,
    ];

    return candidates
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((url): url is string => typeof url === "string" && Boolean(url.trim()));
  }

  function isStyleTaskSuccessStatus(status: string) {
    const normalizedStatus = status.trim().toLowerCase();
    return (
      normalizedStatus === "success" ||
      normalizedStatus === "succeeded" ||
      normalizedStatus === "completed" ||
      normalizedStatus === "done"
    );
  }

  function isStyleTaskInProgressStatus(status: string) {
    const normalizedStatus = status.trim().toLowerCase();
    return (
      normalizedStatus === "" ||
      normalizedStatus === "queued" ||
      normalizedStatus === "running" ||
      normalizedStatus === "pending" ||
      normalizedStatus === "processing" ||
      normalizedStatus === "submitted" ||
      normalizedStatus === "created"
    );
  }

  function isStyleTaskFailureStatus(status: string) {
    const normalizedStatus = status.trim().toLowerCase();
    return (
      normalizedStatus === "failed" ||
      normalizedStatus === "error" ||
      normalizedStatus === "cancelled" ||
      normalizedStatus === "canceled"
    );
  }

  function getStyle3PollingStatus(status: string): Style3Status {
    const normalizedStatus = status.trim().toLowerCase();
    return normalizedStatus === "running" || normalizedStatus === "processing" ? "running" : "queued";
  }

  function isRetryableStyleTaskPollStatus(status: number) {
    return status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;
  }

  function createFinalStyleTaskPollError(message: string) {
    return Object.assign(new Error(message), { final: true });
  }

  function isFinalStyleTaskPollError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "final" in error &&
      (error as { final?: boolean }).final === true
    );
  }

  async function pollCosplayTask(taskId: string) {
    for (let attempt = 0; attempt < COSPLAY_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await wait(COSPLAY_POLL_INTERVAL_MS);
      }

      const response = await fetch(`${getGatewayRequestBaseUrl()}/web/style-edit/tasks/${taskId}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await parseGatewayError(response, "任务查询失败"));
      }

      const payload = (await response.json()) as StyleTaskPollResponse;
      const status = payload.status ?? "";

      const normalizedStatus = status.trim().toLowerCase();

      if (normalizedStatus === "queued" || normalizedStatus === "running") {
        setCosplay((prev) => ({
          ...prev,
          status: normalizedStatus,
          queuePosition: payload.queue_position ?? prev.queuePosition,
          queueSize: payload.queue_size ?? prev.queueSize,
          progressStage: payload.progress?.stage ?? prev.progressStage,
          progressPercent:
            typeof payload.progress?.percent === "number"
              ? payload.progress.percent
              : prev.progressPercent,
          error: "",
        }));
        continue;
      }

      if (isStyleTaskSuccessStatus(status)) {
        const resultImgUrls = getStyleTaskResultUrls(payload);
        if (resultImgUrls.length === 0) {
          throw new Error("Style API 未返回结果图片");
        }

        setCosplay((prev) => ({
          ...prev,
          resultImgUrls,
          status: "succeeded",
          queuePosition: null,
          queueSize: null,
          progressStage: "",
          progressPercent: null,
          error: "",
        }));
        return;
      }

      if (normalizedStatus === "failed") {
        throw new Error(payload.error || payload.message || "cosplay 姿势推荐生成失败");
      }

      throw new Error(payload.message || "未知任务状态");
    }

    throw new Error("任务处理时间较长，请稍后重新上传");
  }

  async function handleCosplayImageUpload(file: File) {
    try {
      if (!auth?.ok) {
        throw new Error("请先登录");
      }

      setCosplay({
        inputPreviewUrl: "",
        inputFileName: file.name,
        uploadedImgUrl: "",
        resultImgUrls: [],
        status: "uploading",
        taskId: "",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        error: "",
      });

      const dataUrl = await readFileAsDataUrl(file);
      setCosplay((prev) => ({
        ...prev,
        inputPreviewUrl: dataUrl,
      }));

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const uploadResponse = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/upload-file`, {
        method: "POST",
        credentials: "include",
        body: uploadFormData,
      });
      if (!uploadResponse.ok) {
        throw new Error(await parseGatewayError(uploadResponse, "图片上传失败"));
      }

      const uploadPayload = (await uploadResponse.json()) as {
        img_url?: string;
      };
      if (!uploadPayload.img_url) {
        throw new Error("图片上传未返回可用 URL");
      }

      setCosplay((prev) => ({
        ...prev,
        uploadedImgUrl: uploadPayload.img_url ?? "",
        status: "queued",
        taskId: "",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        error: "",
      }));

      const styleResponse = await fetch(`${getGatewayRequestBaseUrl()}/web/style-edit/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          style: "cosplay",
          img_url: uploadPayload.img_url,
        }),
      });
      if (!styleResponse.ok) {
        throw new Error(await parseGatewayError(styleResponse, "Cosplay Style 生成失败"));
      }

      const stylePayload = (await styleResponse.json()) as StyleTaskStartResponse;
      if (!stylePayload.task_id) {
        throw new Error("Style API 未返回任务 ID");
      }

      setCosplay((prev) => ({
        ...prev,
        taskId: stylePayload.task_id ?? "",
        status: stylePayload.status === "running" ? "running" : "queued",
        queuePosition: stylePayload.queue_position ?? null,
        queueSize: stylePayload.queue_size ?? null,
        progressStage: "",
        progressPercent: null,
        error: "",
      }));

      await pollCosplayTask(stylePayload.task_id);
    } catch (error) {
      setCosplay((prev) => ({
        ...prev,
        status: "failed",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        error: error instanceof Error ? error.message : "Cosplay Style 生成失败",
      }));
    }
  }

  function isCurrentStyle3Run(runId: string) {
    return style3UploadRunRef.current === runId;
  }

  async function pollStyle3Task(taskId: string, runId: string) {
    await wait(STYLE3_INITIAL_POLL_DELAY_MS);

    let consecutiveErrors = 0;

    for (let attempt = 0; attempt < STYLE3_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await wait(STYLE3_POLL_INTERVAL_MS);
      }

      if (!isCurrentStyle3Run(runId)) {
        return;
      }

      let payload: StyleTaskPollResponse;
      try {
        const response = await fetch(`${getGatewayRequestBaseUrl()}/web/style-edit/tasks/${taskId}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          const message = await parseGatewayError(response, "任务查询失败");
          if (!isRetryableStyleTaskPollStatus(response.status)) {
            throw createFinalStyleTaskPollError(message);
          }

          throw new Error(message);
        }

        payload = (await response.json()) as StyleTaskPollResponse;
        consecutiveErrors = 0;
      } catch (error) {
        if (isFinalStyleTaskPollError(error)) {
          throw error;
        }

        consecutiveErrors += 1;
        const message = error instanceof Error ? error.message : "任务查询失败";
        console.warn("[style3] poll retry", {
          runId,
          taskId,
          attempt: attempt + 1,
          consecutiveErrors,
          message,
        });

        if (consecutiveErrors >= STYLE3_POLL_MAX_CONSECUTIVE_ERRORS) {
          throw new Error(message);
        }

        setStyle3((prev) =>
          isCurrentStyle3Run(runId)
            ? {
                ...prev,
                status: prev.status === "running" ? "running" : "queued",
                error: `任务查询暂时失败，正在重试（${consecutiveErrors}/${STYLE3_POLL_MAX_CONSECUTIVE_ERRORS}）`,
              }
            : prev,
        );
        continue;
      }

      const status = payload.status ?? "";

      const normalizedStatus = status.trim().toLowerCase();
      console.info("[style3] poll status", {
        runId,
        taskId,
        attempt: attempt + 1,
        status: normalizedStatus || "(empty)",
      });

      if (isStyleTaskInProgressStatus(status)) {
        setStyle3((prev) =>
          isCurrentStyle3Run(runId)
            ? {
                ...prev,
                status: getStyle3PollingStatus(status),
                queuePosition: payload.queue_position ?? prev.queuePosition,
                queueSize: payload.queue_size ?? prev.queueSize,
                progressStage: payload.progress?.stage ?? prev.progressStage,
                progressPercent:
                  typeof payload.progress?.percent === "number"
                    ? payload.progress.percent
                    : prev.progressPercent,
                error: "",
              }
            : prev,
        );
        continue;
      }

      if (isStyleTaskSuccessStatus(status)) {
        const resultImgUrls = getStyleTaskResultUrls(payload);
        if (resultImgUrls.length === 0) {
          console.warn("[style3] success without result urls", {
            runId,
            taskId,
            attempt: attempt + 1,
          });
          setStyle3((prev) =>
            isCurrentStyle3Run(runId)
              ? {
                  ...prev,
                  status: "running",
                  queuePosition: payload.queue_position ?? prev.queuePosition,
                  queueSize: payload.queue_size ?? prev.queueSize,
                  progressStage: payload.progress?.stage ?? "waiting_result",
                  progressPercent:
                    typeof payload.progress?.percent === "number"
                      ? payload.progress.percent
                      : prev.progressPercent,
                  error: "任务已完成，正在等待结果图片",
                }
              : prev,
          );
          continue;
        }

        setStyle3((prev) =>
          isCurrentStyle3Run(runId)
            ? {
                ...prev,
                resultImgUrl: resultImgUrls[0],
                status: "succeeded",
                queuePosition: null,
                queueSize: null,
                progressStage: "",
                progressPercent: null,
                error: "",
              }
            : prev,
        );
        return;
      }

      if (isStyleTaskFailureStatus(status)) {
        throw new Error(payload.error || payload.message || "风格编辑生成失败");
      }

      setStyle3((prev) =>
        isCurrentStyle3Run(runId)
          ? {
              ...prev,
              status: "queued",
              queuePosition: payload.queue_position ?? prev.queuePosition,
              queueSize: payload.queue_size ?? prev.queueSize,
              progressStage: normalizedStatus || prev.progressStage,
              progressPercent:
                typeof payload.progress?.percent === "number"
                  ? payload.progress.percent
                  : prev.progressPercent,
              error: payload.message || `等待任务状态更新：${status || "unknown"}`,
            }
          : prev,
      );
    }

    throw new Error("任务处理时间较长，请稍后重新上传");
  }

  async function handleStyle3ImageUpload(file: File, selectedStyleId: string) {
    const runId = `style3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    style3UploadRunRef.current = runId;

    try {
      if (!selectedStyleId) {
        throw new Error("请先选择风格，再上传图片");
      }

      if (!auth?.ok) {
        throw new Error("请先登录");
      }

      console.info("[style3] upload start", {
        runId,
        fileName: file.name,
        styleId: selectedStyleId,
      });

      setStyle3((prev) => ({
        ...prev,
        inputPreviewUrl: "",
        inputFileName: file.name,
        uploadedImgUrl: "",
        taskId: "",
        resultImgUrl: "",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        status: "uploading",
        error: "",
      }));

      const dataUrl = await readFileAsDataUrl(file);
      if (!isCurrentStyle3Run(runId)) {
        return;
      }

      setStyle3((prev) => ({
        ...prev,
        inputPreviewUrl: dataUrl,
      }));

      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const uploadResponse = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/upload-file`, {
        method: "POST",
        credentials: "include",
        body: uploadFormData,
      });
      if (!uploadResponse.ok) {
        throw new Error(await parseGatewayError(uploadResponse, "图片上传失败"));
      }

      const uploadPayload = (await uploadResponse.json()) as {
        img_url?: string;
      };
      if (!uploadPayload.img_url) {
        throw new Error("图片上传未返回可用 URL");
      }
      if (!isCurrentStyle3Run(runId)) {
        return;
      }

      console.info("[style3] upload complete", {
        runId,
        imgUrl: uploadPayload.img_url,
      });

      setStyle3((prev) => ({
        ...prev,
        uploadedImgUrl: uploadPayload.img_url ?? "",
        taskId: "",
        resultImgUrl: "",
        status: "queued",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        error: "",
      }));

      const styleResponse = await fetch(`${getGatewayRequestBaseUrl()}/web/style-edit/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          img_url: uploadPayload.img_url,
          styles: [selectedStyleId],
          remove_pedestrians: false,
          seed: -1,
        }),
      });
      if (!styleResponse.ok) {
        throw new Error(await parseGatewayError(styleResponse, "风格编辑任务启动失败"));
      }

      const stylePayload = (await styleResponse.json()) as StyleTaskStartResponse;
      if (!stylePayload.task_id) {
        throw new Error("Style Transfer API 未返回任务 ID");
      }
      if (!isCurrentStyle3Run(runId)) {
        return;
      }

      console.info("[style3] task submitted", {
        runId,
        taskId: stylePayload.task_id,
        status: stylePayload.status,
      });

      setStyle3((prev) => ({
        ...prev,
        taskId: stylePayload.task_id ?? "",
        status: getStyle3PollingStatus(stylePayload.status ?? ""),
        queuePosition: stylePayload.queue_position ?? null,
        queueSize: stylePayload.queue_size ?? null,
        progressStage: "",
        progressPercent: null,
        error: "",
      }));

      await pollStyle3Task(stylePayload.task_id, runId);
    } catch (error) {
      if (!isCurrentStyle3Run(runId)) {
        return;
      }

      console.warn("[style3] upload failed", {
        runId,
        message: error instanceof Error ? error.message : "风格编辑生成失败",
      });
      setStyle3((prev) => ({
        ...prev,
        status: "failed",
        queuePosition: null,
        queueSize: null,
        progressStage: "",
        progressPercent: null,
        error: error instanceof Error ? error.message : "风格编辑生成失败",
      }));
    }
  }

  async function handleImageFileUpload(file: File) {
    const targetSessionId = sessionId;

    try {
      setIsUploadingImage(true);

      if (!auth?.ok) {
        throw new Error("请先登录");
      }

      if (!targetSessionId) {
        throw new Error("当前没有可用的绘画会话");
      }

      if (isTurnBusy) {
        throw new Error("当前正在执行编辑，请等待完成后再上传图片");
      }

      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "",
        statusText: "正在上传图片",
      }));
      const dataUrl = await readFileAsDataUrl(file);
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      const uploadResponse = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/upload-file`, {
        method: "POST",
        credentials: "include",
        body: uploadFormData,
      });
      if (!uploadResponse.ok) {
        const uploadErr = await uploadResponse.json().catch(() => ({ detail: "上传失败" }));
        throw new Error(uploadErr.detail || "图片上传失败");
      }
      const uploadPayload = (await uploadResponse.json()) as {
        img_url?: string;
      };

      updateActiveConversation((conversation) => ({
        ...conversation,
        uploadedImageUrl: dataUrl,
        uploadedFileName: file.name,
        currentImageUrl: dataUrl,
        originalImageUrl: uploadPayload.img_url ?? "",
        messages: [...conversation.messages, buildUploadMessage(dataUrl)],
        recommendations: [],
        recommendationStatus: "idle",
        dismissedRecommendationIds: [],
        activeTurnId: "",
        activeTurnStatus: "",
        activeQueuePosition: null,
        activeQueueSize: null,
        requestError: "",
        statusText: "正在绑定图片",
      }));

      const bindResponse = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${targetSessionId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ img_url: uploadPayload.img_url }),
      });
      if (!bindResponse.ok) {
        const bindPayload = await bindResponse.json().catch(() => ({ detail: "绑定图片失败" }));
        throw new Error(bindPayload.detail || "绑定图片失败");
      }

      // Kick off recommendation generation; the recommendation polling useEffect
      // will take over from here using refreshRecommendationsOnly (safe, non-destructive).
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        statusText: "图片已绑定，正在启动推荐生成",
      }));
      const recommendResponse = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${targetSessionId}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ img_url: uploadPayload.img_url }),
      });
      if (!recommendResponse.ok) {
        const recommendPayload = await recommendResponse
          .json()
          .catch(() => ({ detail: "推荐任务启动失败" }));
        startedRecommendationSessionsRef.current.delete(targetSessionId);
        updateConversationBySessionId(targetSessionId, (conversation) => ({
          ...conversation,
          recommendationStatus: "failed",
          requestError: recommendPayload.detail || "推荐任务启动失败",
          statusText: "推荐生成失败",
        }));
        return;
      }

      startedRecommendationSessionsRef.current.add(targetSessionId);
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        recommendationStatus: "running",
        statusText: "图片已绑定，正在生成推荐指令",
      }));
    } catch (error) {
      startedRecommendationSessionsRef.current.delete(targetSessionId);
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: error instanceof Error ? error.message : "读取图片失败，请重新上传",
        statusText: "图片处理准备失败",
      }));
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleFileChange(event: { target: HTMLInputElement }) {
    const file = getFirstImageFile(event.target.files ? Array.from(event.target.files) : []);
    if (!file) {
      event.target.value = "";
      return;
    }

    try {
      if (isCosplayWorkspace) {
        await handleCosplayImageUpload(file);
      } else if (isStyle3Workspace) {
        await handleStyle3ImageUpload(file, style3.selectedStyleId);
      } else {
        await handleImageFileUpload(file);
      }
    } finally {
      event.target.value = "";
    }
  }

  function handleWorkspacePaste(event: ClipboardEvent<HTMLElement>) {
    if (isAgentWorkspace && isUploadingImage) {
      return;
    }

    if (isCosplayWorkspace && isCosplayBusy) {
      return;
    }

    if (isStyle3Workspace && isStyle3Busy) {
      return;
    }

    const file = getFirstImageFile(event.clipboardData.files);
    if (!file) {
      return;
    }

    event.preventDefault();
    if (isCosplayWorkspace) {
      void handleCosplayImageUpload(file);
    } else if (isStyle3Workspace) {
      void handleStyle3ImageUpload(file, style3.selectedStyleId);
    } else {
      void handleImageFileUpload(file);
    }
  }

  function handleWorkspaceDragOver(event: DragEvent<HTMLElement>) {
    if (isAgentWorkspace && isUploadingImage) {
      return;
    }

    if (isCosplayWorkspace && isCosplayBusy) {
      return;
    }

    if (isStyle3Workspace && isStyle3Busy) {
      return;
    }

    if (!hasImageTransferData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    if (isStyle3Workspace && !style3.selectedStyleId) {
      event.dataTransfer.dropEffect = "none";
      return;
    }

    event.dataTransfer.dropEffect = "copy";
  }

  function handleWorkspaceDrop(event: DragEvent<HTMLElement>) {
    if (isAgentWorkspace && isUploadingImage) {
      return;
    }

    if (isCosplayWorkspace && isCosplayBusy) {
      return;
    }

    if (isStyle3Workspace && isStyle3Busy) {
      return;
    }

    const file = getFirstImageFile(event.dataTransfer.files);
    if (!file) {
      return;
    }

    event.preventDefault();
    if (isCosplayWorkspace) {
      void handleCosplayImageUpload(file);
    } else if (isStyle3Workspace) {
      void handleStyle3ImageUpload(file, style3.selectedStyleId);
    } else {
      void handleImageFileUpload(file);
    }
  }

  function getTurnStatusText(turn: TurnRecord) {
    if (turn.status === "queued") {
      const position = turn.queue_position ?? null;
      const size = turn.queue_size ?? null;

      if (typeof position === "number" && position > 0 && typeof size === "number" && size > 0) {
        return `任务排队中：第 ${position} 位 / 共 ${size} 个`;
      }

      if (typeof position === "number" && position > 0) {
        return `任务排队中：第 ${position} 位`;
      }

      return "任务已提交，正在等待智能体执行";
    }

    if (turn.status === "running") {
      return "智能体正在处理中";
    }

    if (turn.status === "cancelled") {
      return "任务已取消";
    }

    if (turn.status === "failed") {
      return "执行失败";
    }

    if (turn.result_type === "clarify") {
      return "系统需要进一步澄清";
    }

    return "图像编辑完成";
  }

  async function pollTurnResult(session: string, turnId: string) {
    if (pollingTurnRef.current === turnId) {
      return;
    }

    pollingTurnRef.current = turnId;
    updateConversationBySessionId(session, (conversation) => ({
      ...conversation,
      requestError: "",
      activeTurnId: turnId,
      activeTurnStatus: "queued",
      activeQueuePosition: null,
      activeQueueSize: null,
      statusText: "任务已提交，正在等待智能体执行",
    }));

    try {
      for (let attempt = 0; attempt < TURN_POLL_MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await wait(TURN_POLL_INTERVAL_MS);
        }

        const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${session}/turns/${turnId}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "查询执行结果失败" }));
          throw new Error(err.detail || "查询执行结果失败");
        }

        const payload = (await response.json()) as TurnResponse;

        if (!payload.turn) {
          throw new Error("查询执行结果失败");
        }

        const { turn } = payload;

        if (turn.status === "queued" || turn.status === "running") {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            activeTurnId: turn.turn_id,
            activeTurnStatus: turn.status ?? "",
            activeQueuePosition: turn.queue_position ?? null,
            activeQueueSize: turn.queue_size ?? null,
            statusText: getTurnStatusText(turn),
          }));
          continue;
        }

        await refreshSession(session);

        if (turn.status === "failed") {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            activeTurnId: "",
            activeTurnStatus: "",
            activeQueuePosition: null,
            activeQueueSize: null,
            requestError: turn.error || "图像编辑失败",
            statusText: "执行失败",
          }));
          return;
        }

        if (turn.status === "cancelled") {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            activeTurnId: "",
            activeTurnStatus: "",
            activeQueuePosition: null,
            activeQueueSize: null,
            statusText: "任务已取消",
          }));
          return;
        }

        if (turn.result_type === "clarify") {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            messages: mergeTurnMessage(conversation.messages, turn),
            activeTurnId: "",
            activeTurnStatus: "",
            activeQueuePosition: null,
            activeQueueSize: null,
            statusText: "系统需要进一步澄清",
          }));
          return;
        }

        if (turn.output_img_url) {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            currentImageUrl: turn.output_img_url ?? conversation.currentImageUrl,
            messages: mergeTurnMessage(conversation.messages, turn),
            activeTurnId: "",
            activeTurnStatus: "",
            activeQueuePosition: null,
            activeQueueSize: null,
            requestError: "",
            statusText: "图像编辑完成",
          }));
          return;
        }

        updateConversationBySessionId(session, (conversation) => ({
          ...conversation,
          messages: mergeTurnMessage(conversation.messages, turn),
          activeTurnId: "",
          activeTurnStatus: "",
          activeQueuePosition: null,
          activeQueueSize: null,
          statusText: getTurnStatusText(turn),
        }));
        return;
      }

      throw new Error("结果同步超时，请稍后刷新会话");
    } finally {
      if (pollingTurnRef.current === turnId) {
        pollingTurnRef.current = "";
      }
    }
  }

  useEffect(() => {
    if (!sessionId || !activeTurnId || isStreaming || pollingTurnRef.current === activeTurnId) {
      return;
    }

    void pollTurnResult(sessionId, activeTurnId).catch((error) => {
      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        activeTurnId: "",
        activeTurnStatus: "",
        activeQueuePosition: null,
        activeQueueSize: null,
        requestError: error instanceof Error ? error.message : "查询执行结果失败",
        statusText: "执行失败",
      }));
    });
  }, [activeTurnId, isStreaming, sessionId]);

  async function handleSend(options?: { selectedRecId?: string; displayText?: string }) {
    if (!sessionId || isTurnBusy) return;
    if (!hasBoundImage) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "请先上传图片",
      }));
      return;
    }

    const targetSessionId = sessionId;
    const conversationThinkingEnabled = activeConversation?.thinkingEnabled ?? true;
    const conversationExternalEnabled = activeConversation?.externalEnabled ?? false;

    const typedCommand = userCmd.trim();
    const command = options?.displayText || typedCommand;
    const selectedRecId = options?.selectedRecId || null;

    if (!command && !selectedRecId) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "请输入编辑指令或点击推荐语",
      }));
      return;
    }

    setIsStreaming(true);
    updateConversationBySessionId(targetSessionId, (conversation) => ({
      ...conversation,
      requestError: "",
    }));

    if (options?.displayText) {
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        dismissedRecommendationIds: conversation.dismissedRecommendationIds.includes(
          HIDE_ALL_RECOMMENDATIONS_KEY,
        )
          ? conversation.dismissedRecommendationIds
          : [
              HIDE_ALL_RECOMMENDATIONS_KEY,
              ...conversation.dismissedRecommendationIds,
              ...(selectedRecId ? [selectedRecId] : []),
            ],
      }));
    } else if (selectedRecId) {
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        dismissedRecommendationIds: conversation.dismissedRecommendationIds.includes(selectedRecId)
          ? conversation.dismissedRecommendationIds
          : [...conversation.dismissedRecommendationIds, selectedRecId],
      }));
    }

    if (command) {
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: `local-user-${Date.now()}`,
            role: "user",
            kind: "command",
            label: USER_NAME,
            text: command,
            imageUrl: conversation.messages.some((message) => message.role === "user")
              ? undefined
              : conversation.uploadedImageUrl || conversation.originalImageUrl || undefined,
          },
        ],
      }));
    }

    updateConversationBySessionId(targetSessionId, (conversation) => ({
      ...conversation,
      userCmd: "",
    }));

    try {
      const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${targetSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_cmd: selectedRecId ? null : command,
          selected_rec_id: selectedRecId,
          thinking: conversationThinkingEnabled,
          use_web_search: conversationExternalEnabled,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "请求失败" }));
        throw new Error(err.detail || "执行失败");
      }

      const payload = (await response.json()) as TurnStartResponse;

      if (!payload.turn_id) {
        throw new Error("任务启动失败");
      }

      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        activeTurnId: payload.turn_id ?? "",
        activeTurnStatus: payload.status ?? "",
        activeQueuePosition: payload.queue_position ?? null,
        activeQueueSize: payload.queue_size ?? null,
        statusText:
          payload.status === "queued"
            ? getTurnStatusText({
                turn_id: payload.turn_id ?? "",
                turn_index: 0,
                status: payload.status,
                queue_position: payload.queue_position,
                queue_size: payload.queue_size,
              })
            : "智能体正在分析图片并生成编辑方案",
      }));

      await pollTurnResult(targetSessionId, payload.turn_id);
    } catch (error) {
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        activeTurnId: "",
        activeTurnStatus: "",
        activeQueuePosition: null,
        activeQueueSize: null,
        requestError: error instanceof Error ? error.message : "执行失败",
        statusText: "执行失败",
      }));
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleCancel() {
    if (!sessionId || !activeTurnId) return;

    try {
      const response = await fetch(`${getGatewayRequestBaseUrl()}/api/v1/agent/conversations/${sessionId}/turns/${activeTurnId}/cancel`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "取消失败" }));
        throw new Error(err.detail || "取消失败");
      }

      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        requestError: "",
        statusText: "已发送取消请求",
      }));
    } catch (error) {
      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        requestError: error instanceof Error ? error.message : "取消失败",
      }));
    }
  }

  return (
    <main className="dashboard">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,android/allowCamera"
        className="hidden-file-input"
        onChange={handleFileChange}
      />

      <div
        className={`sidebar-backdrop${sidebarOpen ? " is-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sidebar-main">
          <div className="brand">
            <div className="brand-avatar">
              <img src={SIDEBAR_AVATAR} alt="" className="brand-avatar-image" />
            </div>
            <div>
              <p className="brand-title">Blue Pixel</p>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="侧边栏导航">
            <button
              type="button"
              className="sidebar-nav-item"
              onClick={() => { handleCreateEntry(); setSidebarOpen(false); }}
              disabled={isCreating || isTurnBusy || !auth?.ok}
            >
              <SidebarIcon name="new" />
              <span>{isCreating ? "进入中..." : "新对话"}</span>
              <kbd className="sidebar-shortcut">⌘ K</kbd>
            </button>

            <button
              type="button"
              className={isAgentWorkspace ? "sidebar-nav-item sidebar-nav-item-active" : "sidebar-nav-item"}
              onClick={() => { setActiveWorkspace("agent"); setSidebarOpen(false); }}
            >
              <SidebarIcon name="spark" />
              <span>AI 创作</span>
            </button>

            <button type="button" className="sidebar-nav-item">
              <SidebarIcon name="more" />
              <span>更多</span>
              <SidebarIcon name="chevron" className="sidebar-nav-chevron" />
            </button>

            <button
              type="button"
              className={
                isCosplayWorkspace
                  ? "sidebar-nav-item sidebar-nav-subitem sidebar-nav-item-active"
                  : "sidebar-nav-item sidebar-nav-subitem"
              }
              onClick={() => { setActiveWorkspace("cosplay"); setSidebarOpen(false); }}
            >
              <SidebarIcon name="spark" />
              <span>cosplay 姿势推荐</span>
            </button>

            <button
              type="button"
              className={
                isStyle3Workspace
                  ? "sidebar-nav-item sidebar-nav-subitem sidebar-nav-item-active"
                  : "sidebar-nav-item sidebar-nav-subitem"
              }
              onClick={() => { setActiveWorkspace("style3"); setSidebarOpen(false); }}
            >
              <SidebarIcon name="spark" />
              <span>风格3.0</span>
            </button>
          </nav>

          <section className="history-panel">
            <div className="history-heading">
              历史对话
            </div>

            <div className="history-list">
              {sortedConversations.length > 0 ? (
                sortedConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const hasDbId = conversation.dbId != null;

                  return (
                    <div
                      key={conversation.id}
                      className={
                        isActive
                          ? "history-item-wrapper is-active"
                          : "history-item-wrapper"
                      }
                    >
                      <button
                        type="button"
                        className={
                          isActive ? "history-item is-active history-item-live" : "history-item"
                        }
                        onClick={() => {
                          setActiveWorkspace("agent");
                          setActiveConversationId(conversation.id);
                          setSidebarOpen(false);
                        }}
                      >
                        <span className="history-item-icon">
                          <SidebarIcon name="chat" />
                        </span>
                        <span className="history-copy">
                          <strong>{conversation.title}</strong>
                        </span>
                      </button>
                      {hasDbId ? (
                        <div className="history-item-actions">
                          <button
                            type="button"
                            className="history-action-btn"
                            aria-label="重命名"
                            title="重命名"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRenameConversation(conversation);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="history-action-btn history-action-btn-danger"
                            aria-label="删除"
                            title="删除"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteConversation(conversation);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="history-empty">
                  <span className="history-item-icon">
                    <SidebarIcon name="chat" />
                  </span>
                  <div className="history-empty-copy">
                    <span>还没有对话记录</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-meta">
            <a href={BACKEND_HINT} target="_blank" rel="noreferrer" className="sidebar-meta-about">
              <SidebarIcon name="about" />
              关于
            </a>
            <div className="sidebar-meta-actions" aria-hidden="true">
              <SidebarIcon name="download" />
              <SidebarIcon name="gift" />
            </div>
          </div>
          {auth?.ok ? (
            <div className="sidebar-footer-user">
              <span className="profile-username">{auth.username}</span>
              <button type="button" className="profile-logout" onClick={() => { setSidebarOpen(false); void handleLogout(); }}>
                退出
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <section
        ref={workspaceRef}
        className={isUploadingImage || isCosplayBusy || isStyle3Busy ? "workspace is-uploading-image" : "workspace"}
        onPaste={handleWorkspacePaste}
        onDragOver={handleWorkspaceDragOver}
        onDrop={handleWorkspaceDrop}
      >
        <header className="topbar">
          <div className="topbar-group">
            <button
              type="button"
              className="hamburger"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="打开导航"
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
            <h1>
              {isCosplayWorkspace
                ? "Cosplay Style"
                : isStyle3Workspace
                  ? "Style 3.0"
                  : "BluePixel Studio"}
            </h1>
            <nav className="topnav">
              <a href="#">Gallery</a>
              <button
                type="button"
                className={isAgentWorkspace ? "active" : undefined}
                onClick={() => setActiveWorkspace("agent")}
              >
                Model Lab
              </button>
              <button
                type="button"
                className={isCosplayWorkspace ? "active" : undefined}
                onClick={() => setActiveWorkspace("cosplay")}
              >
                Cos Lab
              </button>
              <button
                type="button"
                className={isStyle3Workspace ? "active" : undefined}
                onClick={() => setActiveWorkspace("style3")}
              >
                Style 3.0
              </button>
            </nav>
          </div>

          <div className="topbar-actions">
            <div className="build-badge" title={`Build commit: ${BUILD_COMMIT_SHA}`}>
              <span className="build-badge-label">Build</span>
              <strong>{BUILD_COMMIT_SHA}</strong>
            </div>

            <div className="topbar-icons" aria-hidden="true">
              <button
                aria-label="messages"
                className="topbar-icon topbar-icon-chat"
              >
                <img src={TOPBAR_MESSAGE_ICON} alt="" className="topbar-icon-image topbar-icon-image-chat" />
              </button>
              <button
                aria-label="notifications"
                className="topbar-icon topbar-icon-bell"
              >
                <img src={TOPBAR_BELL_ICON} alt="" className="topbar-icon-image topbar-icon-image-bell" />
              </button>
            </div>
          </div>
        </header>

        <div className="right-overlay" />

        {!auth?.ok ? (
          <section className="auth-panel">
            <div className="auth-panel-copy">
              <span className="panel-kicker">AUTH</span>
              <strong>登录</strong>
              <span>
                {isCosplayWorkspace
                  ? "输入用户名和密码后即可使用 Cosplay Style。"
                  : isStyle3Workspace
                    ? "输入用户名和密码后即可使用风格3.0。"
                    : "输入用户名和密码后，页面会自动创建一个空绘画会话。"}
              </span>
            </div>
            <form
              className="auth-panel-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleLogin();
              }}
            >
              <input
                className="auth-input"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder="用户名"
              />
              <input
                className="auth-input"
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="密码"
              />
              <button
                type="submit"
                className="auth-submit"
                disabled={isAuthenticating}
              >
                {isAuthenticating ? "登录中..." : "登录"}
              </button>
            </form>
            {authRequestError ? <div className="panel-error">{authRequestError}</div> : null}
          </section>
        ) : null}

        {isCosplayWorkspace ? (
          <section className="cosplay-workspace" aria-label="Cosplay Style 工作区">
            <div className="cosplay-status-row">
              <div className="cosplay-status-copy">
                <span className="panel-kicker">STYLE</span>
                <strong>cosplay姿势推荐</strong>
                <span>{cosplayStatusText}</span>
                {cosplayQueueText ? <span className="cosplay-status-meta">{cosplayQueueText}</span> : null}
              </div>
              {cosplay.error ? <em>{cosplay.error}</em> : null}
            </div>

            {!cosplay.inputPreviewUrl ? (
              <div className="cosplay-welcome">
                欢迎使用 Cosplay 姿势推荐。复制粘贴、点击加号上传，或将图片拖入工作区开始。
                <br />
                系统会基于输入图片生成多张 cosplay 姿势参考图。
              </div>
            ) : null}

            {!cosplay.inputPreviewUrl ? (
              <button
                type="button"
                className="cosplay-upload-target"
                onClick={handleSelectImage}
                disabled={!auth?.ok || isCosplayBusy}
                aria-label="上传图片生成 Cosplay Style"
              >
                <span className="cosplay-upload-plus">+</span>
              </button>
            ) : (
              <div
                className={
                  cosplay.resultImgUrls.length > 0
                    ? "cosplay-image-grid"
                    : "cosplay-image-grid cosplay-image-grid-single"
                }
              >
                <article className="cosplay-image-panel">
                  <div className="cosplay-image-label">
                    <span>INPUT</span>
                    <strong>{cosplay.inputFileName || "IMAGE"}</strong>
                  </div>
                  <ImagePreview
                    src={cosplay.inputPreviewUrl}
                    alt="cosplay input"
                    className="cosplay-image-frame"
                    onPreview={setPreviewImageUrl}
                  />
                </article>

                {cosplay.resultImgUrls.map((resultImgUrl, index) => (
                  <article className="cosplay-image-panel" key={resultImgUrl}>
                    <div className="cosplay-image-label">
                      <span>RESULT {index + 1}</span>
                      <strong>COSPLAY STYLE</strong>
                    </div>
                    <ImagePreview
                      src={resultImgUrl}
                      alt={`cosplay result ${index + 1}`}
                      className="cosplay-image-frame"
                      canDownload
                      onPreview={setPreviewImageUrl}
                    />
                  </article>
                ))}
              </div>
            )}

            {cosplay.inputPreviewUrl ? (
              <div className="cosplay-action-row">
                <button
                  type="button"
                  className="scene-banner-upload"
                  onClick={handleSelectImage}
                  disabled={!auth?.ok || isCosplayBusy}
                >
                  {isCosplayBusy ? "处理中..." : "重新上传"}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {isStyle3Workspace ? (
          <section className="style3-workspace" aria-label="风格3.0 工作区">
            <div className="cosplay-status-row style3-status-row">
              <div className="cosplay-status-copy">
                <span className="panel-kicker">STYLE 3.0</span>
                <strong>风格3.0</strong>
                <span>{style3StatusText}</span>
                {selectedStyle3Style ? (
                  <span className="cosplay-status-meta">当前风格：{selectedStyle3Style.label}</span>
                ) : null}
                {style3QueueText ? <span className="cosplay-status-meta">{style3QueueText}</span> : null}
              </div>
              {style3.error ? <em>{style3.error}</em> : null}
            </div>

            {isStyle3ResultView ? (
              <div className="style3-result-layout">
                <div className="style3-result-summary" aria-label="风格3.0 输入摘要">
                  {selectedStyle3Style ? (
                    <article
                      className="style3-selected-card"
                      style={{ background: selectedStyle3Style.gradient }}
                    >
                      {selectedStyle3Style.imageUrl ? (
                        <img
                          src={selectedStyle3Style.imageUrl}
                          alt=""
                          className="style3-card-image"
                        />
                      ) : null}
                      <span className="style3-card-shine" />
                      <span className="style3-card-check is-visible" aria-hidden="true">✓</span>
                      <span className="style3-card-label">{selectedStyle3Style.label}</span>
                    </article>
                  ) : null}

                  <article className="style3-input-card">
                    <ImagePreview
                      src={style3.inputPreviewUrl}
                      alt="风格3.0 input"
                      className="style3-input-frame"
                      onPreview={setPreviewImageUrl}
                    />
                    <div className="style3-input-overlay">
                      <span>INPUT</span>
                      <strong>{style3.inputFileName || "IMAGE"}</strong>
                    </div>
                  </article>
                </div>

                <section className="style3-result-stage" aria-label="风格3.0 结果图">
                  {style3.resultImgUrl ? (
                    <ImagePreview
                      src={style3.resultImgUrl}
                      alt="风格3.0 result"
                      className="style3-result-frame"
                      canDownload
                      onPreview={setPreviewImageUrl}
                    />
                  ) : (
                    <div className="style3-result-placeholder">
                      <span>{isStyle3Busy ? "PROCESSING" : "RESULT"}</span>
                      <strong>{style3ResultPlaceholderText}</strong>
                    </div>
                  )}
                </section>

                <div className="style3-reset-row">
                  <button
                    type="button"
                    className="scene-banner-upload style3-reset-button"
                    onClick={handleStyle3Reset}
                    disabled={isStyle3Busy}
                  >
                    {isStyle3Busy ? "处理中..." : "重新选择风格"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="style3-grid" aria-label="选择风格3.0 风格">
                  {STYLE3_STYLES.map((style) => {
                    const isSelected = style.id === style3.selectedStyleId;

                    return (
                      <button
                        type="button"
                        key={style.id}
                        className={isSelected ? "style3-card is-selected" : "style3-card"}
                        style={{ background: style.gradient }}
                        onClick={() => handleStyle3Select(style.id)}
                        disabled={isStyle3Busy}
                        aria-pressed={isSelected}
                      >
                        {style.imageUrl ? (
                          <img
                            src={style.imageUrl}
                            alt=""
                            className="style3-card-image"
                          />
                        ) : null}
                        <span className="style3-card-shine" />
                        <span className="style3-card-check" aria-hidden="true">✓</span>
                        <span className="style3-card-category">{style.category}</span>
                        <span className="style3-card-label">{style.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="style3-upload-target"
                  onClick={handleSelectImage}
                  disabled={!auth?.ok || isStyle3Busy}
                  aria-label="上传图片生成风格3.0"
                >
                  <span className="cosplay-upload-plus">+</span>
                </button>

                {style3.inputPreviewUrl ? (
                  <div className="cosplay-image-grid cosplay-image-grid-single style3-input-grid">
                    <article className="cosplay-image-panel">
                      <div className="cosplay-image-label">
                        <span>INPUT</span>
                        <strong>{style3.inputFileName || "IMAGE"}</strong>
                      </div>
                      <ImagePreview
                        src={style3.inputPreviewUrl}
                        alt="风格3.0 input"
                        className="cosplay-image-frame"
                        onPreview={setPreviewImageUrl}
                      />
                    </article>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {isAgentWorkspace && !showUploadedPreview && !uploadedImageUrl ? (
          <section className="scene-banner">
            <div className="scene-banner-copy">
              <span className="panel-kicker">SCENE</span>
              <strong>场景绘画</strong>
              <span>
                {sessionId
                  ? `Scene: ${sessionId.slice(0, 16)}...`
                  : "正在准备空绘画会话"}
              </span>
            </div>
            <div className="scene-banner-status">
              <span>{statusText}</span>
              {requestError ? <em>{requestError}</em> : null}
              {auth?.ok ? (
                <button
                  type="button"
                  className="scene-banner-upload"
                  onClick={handleSelectImage}
                  disabled={!sessionId || isCreating || isTurnBusy || isUploadingImage}
                >
                  上传参考图
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {isAgentWorkspace && showUploadedPreview ? (
          <section className="uploaded-preview-zone">
            <article className="uploaded-preview-card">
              <div className="uploaded-preview-label">
                <span>{USER_NAME}</span>
                <span className="uploaded-preview-dot" />
              </div>
              <ImagePreview
                src={uploadedPreviewImageUrl}
                alt={uploadedPreviewName}
                className="user-image-frame"
                onPreview={setPreviewImageUrl}
              />
            </article>
          </section>
        ) : null}

        {isAgentWorkspace ? (
          <section
            className={
              !showUploadedPreview && !hasUserMessages
                ? "chat-stream chat-stream-empty"
                : "chat-stream"
            }
          >
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isWelcomeMessage = message.id === "assistant-welcome";
            const hideAssistantText =
              !isUser && Boolean(message.imageUrl);

            if (isWelcomeMessage && (showUploadedPreview || hasUserMessages)) {
              return null;
            }

            return (
              <Fragment key={message.id}>
                <article
                  className={
                    isUser
                      ? "message message-user"
                      : isWelcomeMessage
                        ? "message message-welcome"
                      : "message"
                  }
                >
                  {!isWelcomeMessage ? (
                    <div className={isUser ? "message-label message-label-user" : "message-label"}>
                      {!isUser ? <span className="message-dot" /> : null}
                      <span>{message.label}</span>
                      {isUser ? <span className="message-dot user-dot" /> : null}
                    </div>
                  ) : null}

                  {isUser ? (
                    <div className="user-stack">
                      {message.imageUrl ? (
                        <ImagePreview
                          src={message.imageUrl}
                          alt="reference"
                          className="user-image-frame"
                          onPreview={setPreviewImageUrl}
                        />
                      ) : null}

                      <div className="user-bubble">{message.text}</div>
                    </div>
                  ) : (
                    <div
                      className={
                        isWelcomeMessage
                          ? "assistant-response assistant-response-welcome"
                          : "assistant-response"
                      }
                    >
                      {!hideAssistantText ? (
                        <div
                          className={
                            isWelcomeMessage
                              ? "assistant-copy assistant-copy-welcome"
                              : "assistant-copy"
                          }
                        >
                          {message.text}
                        </div>
                      ) : null}
                      {message.imageUrl ? (
                          <ImagePreview
                            src={message.imageUrl}
                            alt="generated result"
                            canDownload
                            onPreview={setPreviewImageUrl}
                            onLoad={() => scrollWorkspaceToBottom("auto")}
                          />
                        ) : null}
                      </div>
                  )}
                </article>

                {message.id === activeProgressAfterMessageId ? (
                  <article className="message">
                    <div className="message-label">
                      <span className="message-dot" />
                      <span>{AGENT_NAME}</span>
                    </div>
                    <div className="progress-ticker" aria-live="polite">
                      <span className="progress-ticker-icon" />
                      <span className="progress-ticker-body">
                        <span className="progress-ticker-copy">
                          {statusText || TURN_PROGRESS_COPY}
                        </span>
                        {activeTurnStatus === "queued" && queueProgressPercent !== null ? (
                          <span className="queue-progress" aria-label="当前排队进度">
                            <span className="queue-progress-track">
                              <span
                                className="queue-progress-fill"
                                style={{ width: `${queueProgressPercent}%` }}
                              />
                            </span>
                            <span className="queue-progress-meta">
                              排队 {activeQueuePosition ?? "-"} / {activeQueueSize ?? "-"}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </article>
                ) : null}
              </Fragment>
            );
          })}
          </section>
        ) : null}

        {isAgentWorkspace ? (
          <section className={showUploadedPreview ? "command-zone command-zone-session" : "command-zone"}>
          {isUploadingImage ? (
            <div className="recommendation-notice upload-notice" aria-live="polite">
              <span className="recommendation-notice-dot upload-notice-dot" />
              <div className="recommendation-notice-copy">
                <strong>正在上传图片</strong>
                <span>请稍候，上传完成后会自动开始绑定并生成推荐。</span>
              </div>
            </div>
          ) : null}

          {hasBoundImage && recommendationStatus === "running" ? (
            <div className="recommendation-notice" aria-live="polite">
              <span className="recommendation-notice-dot" />
              <div className="recommendation-notice-copy">
                <strong>后台正在生成推荐指令</strong>
                <span>你可以直接在下方输入编辑指令，无需等待推荐完成。</span>
              </div>
            </div>
          ) : null}

          {hasBoundImage && recommendationStatus === "failed" ? (
            <div className="recommendation-notice recommendation-notice-error" aria-live="polite">
              <span className="recommendation-notice-dot" />
              <div className="recommendation-notice-copy">
                <strong>推荐生成失败</strong>
                <span>你仍然可以直接输入编辑指令继续操作。</span>
              </div>
            </div>
          ) : null}

          <div className="composer-glow" />
          <div
            className={visibleSuggestions.length > 0 ? "composer composer-with-suggestions" : "composer"}
          >
            {visibleSuggestions.length > 0 ? (
              <div className="composer-suggestions">
                <div className="composer-suggestions-heading">你想先尝试哪一种推荐处理？</div>
                <div className="composer-suggestions-list">
                  {visibleSuggestions.map((item) => (
                    <button
                      key={`${item.title}-${item.recId}`}
                      className="suggestion-card"
                      onClick={() =>
                        void handleSend({
                          selectedRecId:
                            item.recId && !item.recId.startsWith("fallback-")
                              ? item.recId
                              : undefined,
                          displayText: item.title,
                        })
                      }
                      disabled={!auth?.ok || !sessionId || !hasBoundImage || isTurnBusy || isUploadingImage}
                    >
                      <div className="suggestion-title">
                        <span className="suggestion-index">{item.index}.</span>
                        <span>{item.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="composer-input-shell">
              <textarea
                className="composer-textarea"
                value={userCmd}
                onChange={(event) =>
                  updateActiveConversation((conversation) => ({
                    ...conversation,
                    userCmd: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
                    return;
                  }

                  event.preventDefault();

                  if (!canSendMessage || !userCmd.trim()) {
                    return;
                  }

                  void handleSend();
                }}
                placeholder={
                  !auth?.ok
                    ? "请先登录..."
                    : !sessionId
                      ? "正在创建空绘画..."
                      : !hasBoundImage
                        ? "请先上传图片"
                        : visibleSuggestions.length > 0
                          ? "也可以在这里补充你的手动编辑指令..."
                          : "要求后续变更"
                }
                disabled={!canSendMessage}
                rows={1}
                aria-label="message composer"
              />
            </div>

            <div className="composer-toolbar">
              <div className="composer-left">
                <button
                  className="add-button"
                  aria-label="upload image"
                  onClick={handleSelectImage}
                  disabled={isUploadingImage}
                >
                  <img src={COMPOSER_ADD_ICON} alt="" className="add-button-icon" />
                </button>

                <div className="mode-row">
                  <button
                    className={externalEnabled ? "mode-button is-active" : "mode-button"}
                    type="button"
                    aria-pressed={externalEnabled}
                    onClick={() =>
                      updateActiveConversation((conversation) => ({
                        ...conversation,
                        externalEnabled: !conversation.externalEnabled,
                      }))
                    }
                  >
                    <img src={COMPOSER_WEB_ICON} alt="" className="mode-icon-image mode-icon-web" />
                    <span>搜索</span>
                    <span className="mode-toggle-indicator" aria-hidden="true" />
                  </button>
                  <button
                    className={thinkingEnabled ? "mode-button is-active" : "mode-button"}
                    type="button"
                    aria-pressed={thinkingEnabled}
                    onClick={() =>
                      updateActiveConversation((conversation) => ({
                        ...conversation,
                        thinkingEnabled: !conversation.thinkingEnabled,
                      }))
                    }
                  >
                    <img
                      src={COMPOSER_THINKING_ICON}
                      alt=""
                      className="mode-icon-image mode-icon-thinking"
                    />
                    <span>思考</span>
                    <span className="mode-toggle-indicator" aria-hidden="true" />
                  </button>
                  {modeNoticeVisible && (
                    <span
                      className="mode-pending-notice is-visible"
                      role="status"
                      aria-live="polite"
                    >
                      待接入
                    </span>
                  )}
                </div>
              </div>

              <div className="composer-right composer-action">
                <button
                  className="send-button"
                  aria-label="send"
                  type="button"
                  onClick={() => void (activeTurnId ? handleCancel() : handleSend())}
                  disabled={!canUseSendButton}
                >
                  <span className="send-button-shadow" />
                  <span className="send-icon-wrap">
                    <img
                      src={activeTurnId ? SEND_BUTTON_ICON : COMPOSER_SEND_ICON}
                      alt=""
                      className="send-icon-image"
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
          </section>
        ) : null}
      </section>

      {previewImageUrl ? (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setPreviewImageUrl("")}
        >
          <div className="image-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="image-lightbox-close"
              aria-label="close preview"
              onClick={() => setPreviewImageUrl("")}
            >
              ×
            </button>
            <img src={previewImageUrl} alt="preview" className="image-lightbox-image" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
