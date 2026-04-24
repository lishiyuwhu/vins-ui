"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Recommendation = {
  id: string;
  prompt: string;
  display_text_zh?: string;
};

type TurnRecord = {
  turn_id: string;
  turn_index: number;
  user_cmd?: string | null;
  resolved_cmd?: string | null;
  status?: string | null;
  input_img_url?: string | null;
  output_img_url?: string | null;
  finished_at?: string | null;
};

type SessionResponse = {
  session_id: string;
  original_img_url?: string | null;
  current_img_url?: string | null;
  recommendations: Recommendation[];
  recommendation_status?: string | null;
  recommendation_error?: string | null;
  turns?: TurnRecord[];
  active_turn_id?: string | null;
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
  statusText: string;
  requestError: string;
  externalEnabled: boolean;
  thinkingEnabled: boolean;
};

const AGENT_NAME = "VINS Agent";
const USER_NAME = "用户";
const BACKEND_HINT = "https://bluepixel.vivo.com.cn";
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
const SIDEBAR_NEW_ICON =
  "https://www.figma.com/api/mcp/asset/4676ecbe-79a6-4947-977e-96196770c3d2";
const SIDEBAR_HISTORY_ICON =
  "https://www.figma.com/api/mcp/asset/f0d5c7c3-778b-40d1-8059-7272263af11e";
const SIDEBAR_CHAT_ICON =
  "https://www.figma.com/api/mcp/asset/642ef86f-98fa-44ef-a997-e9a9978042e0";
const SIDEBAR_DELETE_ICON =
  "https://www.figma.com/api/mcp/asset/0eee08d7-db1b-4a89-9d4b-c1ea3d222ef9";
const SIDEBAR_HELP_ICON =
  "https://www.figma.com/api/mcp/asset/ad53aa73-dfaf-4dff-ba11-3a6ea6571dd8";
const SIDEBAR_STATUS_ICON =
  "https://www.figma.com/api/mcp/asset/09877dee-a9e3-42a6-a6f9-c973dd1c734c";
const SIDEBAR_AVATAR =
  "https://www.figma.com/api/mcp/asset/0448d584-9c63-498d-97e3-6972835894bb";
const SIDEBAR_EMPTY_ICON =
  "https://www.figma.com/api/mcp/asset/127372b4-8f72-4c4e-8a4a-64c766f4f8af";
const HIDE_ALL_RECOMMENDATIONS_KEY = "__all__";
const RECOMMENDATION_POLL_INTERVAL_MS = 1500;
const RECOMMENDATION_POLL_MAX_ATTEMPTS = 40;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

    if (turn.resolved_cmd || turn.output_img_url) {
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
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
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedSessionRef = useRef(false);
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
  const requestError = activeConversation?.requestError ?? "";
  const hasBoundImage = Boolean(originalImageUrl);
  const sortedConversations = useMemo(
    () => [...conversations].reverse(),
    [conversations],
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
      isStreaming
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
    isStreaming,
    messages,
    recommendations,
    sessionId,
    uploadedImageUrl,
  ]);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  );

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

  async function refreshSession(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as SessionResponse;
    updateConversationBySessionId(id, (conversation) => ({
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
      activeTurnId: payload.active_turn_id ?? "",
      messages: buildMessagesFromTurns(
        payload.turns ?? [],
        conversation.uploadedImageUrl || payload.current_img_url,
      ),
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

        const payload = await refreshSession(sessionId);
        if (!payload) {
          continue;
        }

        if (payload.recommendation_status === "succeeded") {
          updateConversationBySessionId(sessionId, (conversation) => ({
            ...conversation,
            statusText: "已生成推荐指令",
          }));
          return;
        }

        if (payload.recommendation_status === "failed") {
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
    if (isCreating || isStreaming || !auth?.ok) return;

    const nextIndex = sessionCounter + 1;
    const nextTitle = `图片处理 #${nextIndex}`;
    void createEmptySession(nextTitle, nextIndex);
  }

  function handleSelectImage() {
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

  async function handleFileChange(event: { target: HTMLInputElement }) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const targetSessionId = sessionId;

    try {
      if (!targetSessionId) {
        throw new Error("当前没有可用的绘画会话");
      }

      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: "",
        statusText: "正在上传图片",
      }));
      const dataUrl = await readFileAsDataUrl(file);
      const uploadResponse = await fetch("/api/upload-image-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      const uploadPayload = (await uploadResponse.json().catch(() => ({ error: "上传失败" }))) as {
        img_url?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadPayload.img_url) {
        throw new Error(uploadPayload.error || "图片上传失败");
      }

      updateActiveConversation((conversation) => ({
        ...conversation,
        uploadedImageUrl: dataUrl,
        uploadedFileName: file.name,
        currentImageUrl: dataUrl,
        originalImageUrl: uploadPayload.img_url ?? "",
        messages: buildMessagesFromTurns([], dataUrl),
        recommendations: [],
        recommendationStatus: "running",
        dismissedRecommendationIds: [],
        activeTurnId: "",
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

      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        statusText: "正在生成推荐指令",
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
        updateActiveConversation((conversation) => ({
          ...conversation,
          recommendationStatus: "failed",
          requestError: recommendPayload.error || "推荐任务启动失败",
        }));
      }

      const refreshedSession = await refreshSession(targetSessionId);
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        statusText:
          refreshedSession?.recommendation_status === "succeeded"
            ? "已生成推荐指令"
            : refreshedSession?.recommendation_status === "failed"
              ? "推荐生成失败"
              : "图片已绑定，正在生成推荐指令",
      }));
    } catch (error) {
      updateActiveConversation((conversation) => ({
        ...conversation,
        requestError: error instanceof Error ? error.message : "读取图片失败，请重新上传",
        statusText: "图片处理准备失败",
      }));
    } finally {
      event.target.value = "";
    }
  }

  async function consumeTurnStream(response: Response, session: string) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("流式响应不可用");
    }

    streamReaderRef.current = reader;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk
          .split("\n")
          .find((item) => item.trim().startsWith("data: "));
        if (!line) continue;

        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          updateConversationBySessionId(session, (conversation) => ({
            ...conversation,
            statusText: "本轮完成",
          }));
          continue;
        }

        const event = JSON.parse(payload) as
          | { type: "turn_start"; turn_id: string }
          | { type: "node_start"; node: string }
          | { type: "node_complete"; node: string }
          | { type: "clarify"; question: string }
          | { type: "quality_check"; passed: boolean }
          | { type: "turn_complete"; turn_id: string; output_img_url: string }
          | { type: "turn_error"; error: string };

        switch (event.type) {
          case "turn_start":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              activeTurnId: event.turn_id,
              statusText: "智能体正在分析图片并生成编辑方案",
            }));
            break;
          case "node_start":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              statusText: `正在处理：${event.node}`,
            }));
            break;
          case "node_complete":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              statusText: `已完成：${event.node}`,
            }));
            break;
          case "clarify":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              messages: [
                ...conversation.messages,
                {
                  id: `clarify-${Date.now()}`,
                  role: "assistant",
                  label: AGENT_NAME,
                  text: event.question,
                },
              ],
              statusText: "系统需要进一步澄清",
            }));
            break;
          case "quality_check":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              statusText: event.passed ? "质量检查通过" : "质量检查未通过",
            }));
            break;
          case "turn_complete":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              currentImageUrl: event.output_img_url,
              statusText: "图像编辑完成",
            }));
            await refreshSession(session);
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              activeTurnId: "",
            }));
            break;
          case "turn_error":
            updateConversationBySessionId(session, (conversation) => ({
              ...conversation,
              requestError: event.error,
              statusText: "执行失败",
              activeTurnId: "",
            }));
            break;
        }
      }
    }
  }

  async function handleSend(options?: { selectedRecId?: string; displayText?: string }) {
    if (!sessionId || isStreaming) return;
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
            imageUrl: conversation.currentImageUrl || conversation.uploadedImageUrl || undefined,
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

      await consumeTurnStream(response, targetSessionId);
    } catch (error) {
      updateConversationBySessionId(targetSessionId, (conversation) => ({
        ...conversation,
        requestError: error instanceof Error ? error.message : "执行失败",
        statusText: "执行失败",
      }));
    } finally {
      streamReaderRef.current = null;
      setIsStreaming(false);
    }
  }

  async function handleCancel() {
    if (!sessionId || !activeTurnId) return;

    try {
      await fetch(`/api/conversations/${sessionId}/turns/${activeTurnId}/cancel`, {
        method: "POST",
      });
      streamReaderRef.current?.cancel().catch(() => undefined);
      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        activeTurnId: "",
        statusText: "已发送取消请求",
      }));
      setIsStreaming(false);
    } catch {
      updateConversationBySessionId(sessionId, (conversation) => ({
        ...conversation,
        requestError: "取消失败",
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
            <div>
              <p className="brand-title">BluePixel</p>
              <p className="brand-subtitle">智能图片处理助手</p>
            </div>
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={handleCreateEntry}
            disabled={isCreating || isStreaming || !auth?.ok}
          >
            <img src={SIDEBAR_NEW_ICON} alt="" className="primary-action-icon" />
            {isCreating ? "进入中..." : "创建新绘画"}
          </button>

          <section className="history-panel">
            <div className="history-heading">
              <img src={SIDEBAR_HISTORY_ICON} alt="" className="history-heading-image" />
              历史对话
            </div>

            <div className="history-list">
              {sortedConversations.length > 0 ? (
                sortedConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const previewName = conversation.uploadedFileName
                    ? conversation.uploadedFileName.toUpperCase()
                    : "等待上传图片...";

                  return (
                    <button
                      key={conversation.id}
                      className={
                        isActive ? "history-item is-active history-item-live" : "history-item"
                      }
                      onClick={() => setActiveConversationId(conversation.id)}
                    >
                      <img src={SIDEBAR_CHAT_ICON} alt="" className="history-item-image" />
                      <span className="history-copy">
                        <strong>{conversation.title}</strong>
                        <span>
                          {conversation.originalImageUrl ? previewName : "等待上传图片..."}
                        </span>
                      </span>
                      <img src={SIDEBAR_DELETE_ICON} alt="" className="history-item-delete" />
                    </button>
                  );
                })
              ) : (
                <div className="history-empty">
                  <img src={SIDEBAR_EMPTY_ICON} alt="" className="history-empty-icon" />
                  <div className="history-empty-copy">
                    <span>还没有对话记录</span>
                    <span>点击上方按钮开始</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-meta">
            <a href={BACKEND_HINT} target="_blank" rel="noreferrer" className="sidebar-meta-link">
              <img src={SIDEBAR_HELP_ICON} alt="" className="sidebar-meta-icon" />
              HELP
            </a>
            <a href="#" className="sidebar-meta-link">
              <img src={SIDEBAR_STATUS_ICON} alt="" className="sidebar-meta-icon sidebar-meta-icon-status" />
              STATUS
            </a>
          </div>

          <div className="profile">
            <div className="profile-avatar">
              <img src={SIDEBAR_AVATAR} alt="" className="profile-avatar-image" />
            </div>
            <div>
              <p>{auth?.ok ? auth.key_hint : "未登录"}</p>
              <span>Scene Paint Mode</span>
            </div>
            {auth?.ok ? (
              <button type="button" className="profile-logout" onClick={() => void handleLogout()}>
                退出
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <section className="workspace">
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
                  disabled={!sessionId || isCreating || isStreaming}
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
                  src={currentImageUrl}
                  alt="uploaded reference"
                  className="uploaded-preview-image"
                />
                <span className="uploaded-preview-name">{uploadedPreviewName}</span>
              </div>
            </article>
          </section>
        ) : null}

        <section className="chat-stream">
          {isStreaming ? (
            <article className="message">
              <div className="message-label">
                <span className="message-dot" />
                <span>{AGENT_NAME}</span>
              </div>
              <div className="progress-ticker" aria-live="polite">
                <span className="progress-ticker-icon" />
                <div className="progress-ticker-track">
                  <div className="progress-ticker-copy">
                    <span>{statusText}</span>
                    <span>{statusText}</span>
                    <span>{statusText}</span>
                  </div>
                </div>
              </div>
            </article>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const isWelcomeMessage = message.id === "assistant-welcome";
            const hideAssistantText =
              !isUser &&
              Boolean(message.imageUrl) &&
              /^Apply the recommended style from rec_/i.test(message.text);

            if (isWelcomeMessage && (showUploadedPreview || hasUserMessages)) {
              return null;
            }

            return (
              <article
                key={message.id}
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
                            href={message.imageUrl}
                            download={uploadedPreviewName}
                            target="_blank"
                            rel="noreferrer"
                            className="assistant-image-download"
                          >
                            下载
                          </a>
                        </div>
                      ) : null}
                    </div>
                )}
              </article>
            );
          })}
        </section>

        <section className={showUploadedPreview ? "command-zone command-zone-session" : "command-zone"}>
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
                      disabled={!auth?.ok || !sessionId || !hasBoundImage || isStreaming}
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
                disabled={!auth?.ok || !sessionId || !hasBoundImage || isStreaming}
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
                  disabled={!auth?.ok || !sessionId || !hasBoundImage || isStreaming}
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
