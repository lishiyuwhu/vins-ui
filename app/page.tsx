"use client";

import {
  Fragment,
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
  key_hint?: string;
  error?: string;
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
      label: string;
      text: string;
      imageUrl?: string;
    };

type LocalConversation = {
  id: string;
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

const AGENT_NAME = "VINS Agent";
const USER_NAME = "用户";
const BACKEND_HINT = "https://bluepixel.vivo.com.cn";
const IMAGE_UPLOAD_API_URL =
  process.env.NEXT_PUBLIC_IMAGE_UPLOAD_API_URL ||
  "https://bluepixel.vivo.com.cn/api/upload-image";
const TEST_API_KEY = "key-mockui-yZaAbBcCdDeEfFgG";
const TOPBAR_MESSAGE_ICON =
  "https://www.figma.com/api/mcp/asset/5b754da6-8524-4ebd-a517-c5c3445c6d22";
const TOPBAR_BELL_ICON =
  "https://www.figma.com/api/mcp/asset/c731baa3-48ad-4b47-ad88-797929916d7d";
const SEND_BUTTON_ICON =
  "https://www.figma.com/api/mcp/asset/45e01f86-942b-45ad-8f48-c11803f0559e";
const COMPOSER_ADD_ICON =
  "https://www.figma.com/api/mcp/asset/98c1b035-fdbb-4fa6-bbbc-53bedbb60fe7";
const COMPOSER_WEB_ICON =
  "https://www.figma.com/api/mcp/asset/c2e80be1-97dd-4df7-beff-05a58da5bf14";
const COMPOSER_THINKING_ICON =
  "https://www.figma.com/api/mcp/asset/09e5c101-49fb-45a2-b168-8ff4c52353bf";
const COMPOSER_SEND_ICON =
  "https://www.figma.com/api/mcp/asset/f4cd65f9-a4ce-494c-afbd-5c5f2c1e461c";
const SIDEBAR_AVATAR =
  "https://www.figma.com/api/mcp/asset/0448d584-9c63-498d-97e3-6972835894bb";
const HIDE_ALL_RECOMMENDATIONS_KEY = "__all__";
const TURN_PROGRESS_COPY = "智能体正在分析图片并在生成中";
const RECOMMENDATION_POLL_INTERVAL_MS = 1500;
const RECOMMENDATION_POLL_MAX_ATTEMPTS = 40;
const TURN_POLL_INTERVAL_MS = 1500;
const TURN_POLL_MAX_ATTEMPTS = 120;
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

  return `/api/download-image?${params.toString()}`;
}

function buildMessagesFromTurns(turns: TurnRecord[], currentImgUrl?: string | null) {
  const items: ChatMessage[] = [
    {
      id: "assistant-welcome",
      role: "assistant",
      label: AGENT_NAME,
      text: "欢迎使用 VINS Agent。复制粘贴或者点击加号上传图片，随后可以通过自然语言继续进行多轮图像编辑。",
    },
  ];

  let fallbackInputImageUrl = currentImgUrl ?? "";

  turns.forEach((turn) => {
    if (turn.user_cmd) {
      items.push({
        id: `${turn.turn_id}-user`,
        role: "user",
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
  const [apiKeyInput, setApiKeyInput] = useState(TEST_API_KEY);
  const [authRequestError, setAuthRequestError] = useState("");
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionCounter, setSessionCounter] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedSessionRef = useRef(false);
  const pollingTurnRef = useRef("");
  const startedRecommendationSessionsRef = useRef(new Set<string>());
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
  const thinkingEnabled = activeConversation?.thinkingEnabled ?? false;
  const statusText = activeConversation?.statusText ?? "准备进入场景绘画";
  const activeTurnId = activeConversation?.activeTurnId ?? "";
  const activeTurnStatus = activeConversation?.activeTurnStatus ?? "";
  const activeQueuePosition = activeConversation?.activeQueuePosition ?? null;
  const activeQueueSize = activeConversation?.activeQueueSize ?? null;
  const requestError = activeConversation?.requestError ?? "";
  const hasBoundImage = Boolean(originalImageUrl);
  const hasActiveTurn = Boolean(activeTurnId);
  const isTurnBusy = isStreaming || hasActiveTurn;
  const canSendMessage = Boolean(auth?.ok && sessionId && hasBoundImage && !isTurnBusy);
  const canUseSendButton = Boolean(
    activeTurnId || (auth?.ok && sessionId && hasBoundImage && !isTurnBusy),
  );
  const sortedConversations = useMemo(
    () => [...conversations].reverse(),
    [conversations],
  );
  const queueProgressPercent = getQueueProgressPercent(
    activeTurnStatus,
    activeQueuePosition,
    activeQueueSize,
  );

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
        const response = await fetch("/api/auth/me", { cache: "no-store" });

        if (!response.ok) {
          if (!ignore) {
            setAuth({ ok: false, error: "请先输入 API Key 登录" });
          }
          return;
        }

        const payload = (await response.json()) as AuthState;
        if (!ignore) {
          setAuth(payload);
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
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as SessionResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "创建会话失败");
      }

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
        thinkingEnabled: false,
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
          thinkingEnabled: false,
        },
      ]);
      setActiveConversationId(localId);
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    if (!auth?.ok || initializedSessionRef.current) {
      return;
    }

    initializedSessionRef.current = true;
    void createEmptySession("图片处理 #1", 1);
  }, [auth?.ok]);

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

  const visibleSuggestions = useMemo(() => {
    const hasUserMessages = messages.some((message) => message.role === "user");

    if (
      hasUserMessages ||
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
    uploadedImageUrl,
  ]);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  );
  const activeProgressAfterMessageId = useMemo(() => {
    if (!isTurnBusy) return "";

    return [...messages].reverse().find((message) => message.role === "user")?.id ?? "";
  }, [isTurnBusy, messages]);

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

  async function refreshSession(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
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
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
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
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({ ok: false }))) as AuthState;

    if (!response.ok) {
      throw new Error(payload.error || "登录失败");
    }

    setAuth(payload);
    setAuthRequestError("");
    initializedSessionRef.current = false;
  }

  async function handleLogin() {
    if (!apiKeyInput || isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthRequestError("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKeyInput }),
      });

      const payload = await response.json().catch(() => ({ error: "登录失败" }));
      if (!response.ok) {
        throw new Error(payload.error || "登录失败");
      }

      await syncAuthState();
    } catch (error) {
      setAuth({ ok: false, error: "请先输入 API Key 登录" });
      setAuthRequestError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    initializedSessionRef.current = false;
    setAuth({ ok: false, error: "请先输入 API Key 登录" });
    setConversations([]);
    setActiveConversationId("");
    setSessionCounter(0);
  }

  function handleCreateEntry() {
    if (isCreating || isTurnBusy || isUploadingImage || !auth?.ok) return;

    const nextIndex = sessionCounter + 1;
    const nextTitle = `图片处理 #${nextIndex}`;
    void createEmptySession(nextTitle, nextIndex);
  }

  function handleSelectImage() {
    if (isUploadingImage) {
      return;
    }

    if (!auth?.ok) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "请先登录",
      }));
      return;
    }

    if (!sessionId) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "空绘画还未创建完成，请稍后再试",
      }));
      return;
    }

    fileInputRef.current?.click();
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
      const uploadResponse = await fetch(IMAGE_UPLOAD_API_URL, {
        method: "POST",
        body: uploadFormData,
      });
      const uploadPayload = (await uploadResponse.json().catch(() => ({ error: "上传失败" }))) as {
        img_url?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadPayload.img_url) {
        throw new Error(uploadPayload.error || "图片上传失败");
      }

      // Reset to a clean slate: clear prior messages/turns, ready for fresh interaction
      // with the new image. dismissedRecommendationIds=[] lets new recommendations appear.
      updateActiveConversation((conversation) => ({
        ...conversation,
        uploadedImageUrl: dataUrl,
        uploadedFileName: file.name,
        currentImageUrl: dataUrl,
        originalImageUrl: uploadPayload.img_url ?? "",
        messages: buildMessagesFromTurns([], dataUrl),
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

      const bindResponse = await fetch(`/api/conversations/${targetSessionId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ img_url: uploadPayload.img_url }),
      });
      const bindPayload = await bindResponse.json().catch(() => ({ error: "绑定图片失败" }));
      if (!bindResponse.ok) {
        throw new Error(bindPayload.error || "绑定图片失败");
      }

      // Kick off recommendation generation; the recommendation polling useEffect
      // will take over from here using refreshRecommendationsOnly (safe, non-destructive).
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        statusText: "图片已绑定，正在启动推荐生成",
      }));
      const recommendResponse = await fetch(`/api/conversations/${targetSessionId}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ img_url: uploadPayload.img_url }),
      });
      if (!recommendResponse.ok) {
        const recommendPayload = await recommendResponse
          .json()
          .catch(() => ({ error: "推荐任务启动失败" }));
        startedRecommendationSessionsRef.current.delete(targetSessionId);
        updateConversationBySessionId(targetSessionId, (conversation) => ({
          ...conversation,
          recommendationStatus: "failed",
          requestError: recommendPayload.error || "推荐任务启动失败",
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
      await handleImageFileUpload(file);
    } finally {
      event.target.value = "";
    }
  }

  function handleWorkspacePaste(event: ClipboardEvent<HTMLElement>) {
    if (isUploadingImage) {
      return;
    }

    const file = getFirstImageFile(event.clipboardData.files);
    if (!file) {
      return;
    }

    event.preventDefault();
    void handleImageFileUpload(file);
  }

  function handleWorkspaceDragOver(event: DragEvent<HTMLElement>) {
    if (isUploadingImage) {
      return;
    }

    if (!hasImageTransferData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleWorkspaceDrop(event: DragEvent<HTMLElement>) {
    if (isUploadingImage) {
      return;
    }

    const file = getFirstImageFile(event.dataTransfer.files);
    if (!file) {
      return;
    }

    event.preventDefault();
    void handleImageFileUpload(file);
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

        const response = await fetch(`/api/conversations/${session}/turns/${turnId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({
          error: "查询执行结果失败",
        }))) as TurnResponse;

        if (!response.ok || !payload.turn) {
          throw new Error(payload.error || "查询执行结果失败");
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
      const response = await fetch(`/api/conversations/${targetSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_cmd: selectedRecId ? null : command,
          selected_rec_id: selectedRecId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(payload.error || "执行失败");
      }

      const payload = (await response.json().catch(() => ({
        error: "任务启动失败",
      }))) as TurnStartResponse;

      if (!payload.turn_id) {
        throw new Error(payload.error || "任务启动失败");
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
      const response = await fetch(`/api/conversations/${sessionId}/turns/${activeTurnId}/cancel`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({
        ok: false,
        message: "取消失败",
      }))) as { ok?: boolean; message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "取消失败");
      }

      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        requestError: payload.ok ? "" : payload.message || "当前任务暂不支持立即取消",
        statusText: payload.message || (payload.ok ? "已发送取消请求" : "当前任务暂不支持立即取消"),
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
        accept="image/*"
        className="hidden-file-input"
        onChange={handleFileChange}
      />

      <aside className="sidebar">
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
              className="sidebar-nav-item sidebar-nav-item-active"
              onClick={handleCreateEntry}
              disabled={isCreating || isTurnBusy || !auth?.ok}
            >
              <SidebarIcon name="new" />
              <span>{isCreating ? "进入中..." : "新对话"}</span>
              <kbd className="sidebar-shortcut">⌘ K</kbd>
            </button>

            <button type="button" className="sidebar-nav-item">
              <SidebarIcon name="spark" />
              <span>AI 创作</span>
            </button>

            <button type="button" className="sidebar-nav-item">
              <SidebarIcon name="more" />
              <span>更多</span>
              <SidebarIcon name="chevron" className="sidebar-nav-chevron" />
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

                  return (
                    <button
                      key={conversation.id}
                      className={
                        isActive ? "history-item is-active history-item-live" : "history-item"
                      }
                      onClick={() => setActiveConversationId(conversation.id)}
                    >
                      <span className="history-item-icon">
                        <SidebarIcon name="chat" />
                      </span>
                      <span className="history-copy">
                        <strong>{conversation.title}</strong>
                      </span>
                    </button>
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
            <button type="button" className="profile-logout" onClick={() => void handleLogout()}>
              退出
            </button>
          ) : null}
        </div>
      </aside>

      <section
        className={isUploadingImage ? "workspace is-uploading-image" : "workspace"}
        onPaste={handleWorkspacePaste}
        onDragOver={handleWorkspaceDragOver}
        onDrop={handleWorkspaceDrop}
      >
        <header className="topbar">
          <div className="topbar-group">
            <h1>BluePixel Studio</h1>
            <nav className="topnav">
              <a href="#">Gallery</a>
              <a href="#" className="active">
                Model Lab
              </a>
              <a href="#">Community</a>
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
              <strong>连接最新版后端 API</strong>
              <span>输入 API Key 后，页面会自动创建一个空绘画会话。</span>
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
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder="输入 API Key"
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

        {!showUploadedPreview && !uploadedImageUrl ? (
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

        {showUploadedPreview ? (
          <section className="uploaded-preview-zone">
            <article className="uploaded-preview-card">
              <div className="uploaded-preview-label">
                <span>{USER_NAME}</span>
                <span className="uploaded-preview-dot" />
              </div>
              <div className="uploaded-preview-frame">
                <button className="uploaded-preview-close" type="button" aria-label="remove image">
                  ×
                </button>
                <img
                  src={uploadedPreviewImageUrl}
                  alt="uploaded reference"
                  className="uploaded-preview-image"
                />
                <span className="uploaded-preview-name">{uploadedPreviewName}</span>
              </div>
            </article>
          </section>
        ) : null}

        <section className="chat-stream">
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
                        <div className="reference-card">
                          <img
                            src={message.imageUrl}
                            alt="reference"
                            className="reference-image"
                          />
                        </div>
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
                          <div className="assistant-image-frame">
                            <img
                              src={message.imageUrl}
                              alt="generated result"
                              className="assistant-image"
                              onClick={() => setPreviewImageUrl(message.imageUrl ?? "")}
                            />
                            <a
                              href={buildImageDownloadHref(message.imageUrl)}
                              className="assistant-image-download"
                            >
                              下载
                            </a>
                          </div>
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
                    <span>Web</span>
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
                    <span>Thinking</span>
                    <span className="mode-toggle-indicator" aria-hidden="true" />
                  </button>
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
