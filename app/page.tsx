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
  current_img_url: string;
  recommendations: Recommendation[];
  turns?: TurnRecord[];
  active_turn_id?: string | null;
};

type AuthState = {
  ok: boolean;
  key_hint?: string;
  internal?: boolean;
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

const demoSuggestions = [
  { title: "电影级青橙色调", subtitle: "Enhance neon lighting", accent: "gradient" },
  { title: "电影级胶片效果", subtitle: "Film-grade film effect", accent: "film" },
  { title: "转换为 3D 效果", subtitle: "Convert to 3D render", accent: "cube" },
  { title: "手动编辑", subtitle: "Custom Edit", accent: "pen" },
];

const AGENT_NAME = "VINS Agent";
const USER_NAME = "用户";
const BACKEND_HINT = "https://bluepixel.vivo.com.cn";
const BACKEND_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80";
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
const COMPOSER_CHECK_ICON =
  "https://www.figma.com/api/mcp/asset/4a2bbb7b-0b17-4ade-885e-24cc17a2dd18";
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

function SuggestionIcon({ accent }: { accent: string }) {
  if (accent === "gradient") {
    return <span className="suggestion-icon suggestion-icon-gradient" />;
  }

  if (accent === "film") {
    return <span className="suggestion-icon suggestion-icon-film" />;
  }

  if (accent === "cube") {
    return <span className="suggestion-icon suggestion-icon-cube" />;
  }

  return <span className="suggestion-icon suggestion-icon-pen">✍</span>;
}

function buildMessagesFromTurns(turns: TurnRecord[], currentImgUrl?: string | null) {
  const items: ChatMessage[] = [
    {
      id: "assistant-welcome",
      role: "assistant",
      label: AGENT_NAME,
      text: "欢迎使用 VINS Agent V2。点击左上角“创建新绘画”即可进入场景绘画，随后可以通过自然语言继续进行多轮图像编辑。",
    },
  ];

  turns.forEach((turn) => {
    if (turn.user_cmd) {
      items.push({
        id: `${turn.turn_id}-user`,
        role: "user",
        label: USER_NAME,
        text: turn.user_cmd,
      });
    }

    if (turn.resolved_cmd) {
      items.push({
        id: `${turn.turn_id}-assistant`,
        role: "assistant",
        label: AGENT_NAME,
        text: turn.resolved_cmd,
        imageUrl: turn.output_img_url ?? undefined,
      });
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
  const [sessionId, setSessionId] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [historyTitle, setHistoryTitle] = useState("");
  const [sessionCounter, setSessionCounter] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    buildMessagesFromTurns([], ""),
  );
  const [userCmd, setUserCmd] = useState("");
  const [statusText, setStatusText] = useState("准备进入场景绘画");
  const [isCreating, setIsCreating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState("");
  const [requestError, setRequestError] = useState("");

  const streamReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingHistoryTitleRef = useRef("");

  useEffect(() => {
    let ignore = false;

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });

        if (!response.ok) {
          if (!ignore) {
            setAuth({ ok: true, internal: true });
            setStatusText("准备进入场景绘画");
          }
          return;
        }

        const payload = (await response.json()) as AuthState;
        if (!ignore) {
          setAuth(payload);
          setStatusText("已接入场景绘画");
        }
      } catch {
        if (!ignore) {
          setAuth({ ok: true, internal: true });
          setStatusText("已接入场景绘画");
        }
      }
    }

    loadAuth();

    return () => {
      ignore = true;
    };
  }, []);

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
        .filter((item) => !dismissedRecommendationIds.includes(item.id))
        .map((item, index) => ({
          title: item.display_text_zh || `推荐 ${index + 1}`,
          subtitle: item.prompt,
          accent: demoSuggestions[index % demoSuggestions.length]?.accent ?? "gradient",
          recId: item.id,
        }));
    }

    if (
      sessionId &&
      uploadedImageUrl &&
      !messages.some((message) => message.role === "user")
    ) {
      return demoSuggestions.slice(0, 3).map((item, index) => ({
        ...item,
        recId: `fallback-${index + 1}`,
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

  const showPendingAgentPreview = useMemo(
    () =>
      Boolean(
        hasUserMessages &&
          uploadedImageUrl &&
          !messages.some((message) => message.role === "assistant" && message.imageUrl),
      ),
    [hasUserMessages, messages, uploadedImageUrl],
  );

  async function refreshSession(id: string) {
    const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as SessionResponse;
    setCurrentImageUrl(
      payload.turns && payload.turns.length > 0
        ? payload.current_img_url
        : uploadedImageUrl || payload.current_img_url,
    );
    setRecommendations(payload.recommendations ?? []);
    setDismissedRecommendationIds(
      payload.turns && payload.turns.length > 0 ? [HIDE_ALL_RECOMMENDATIONS_KEY] : [],
    );
    setActiveTurnId(payload.active_turn_id ?? "");
    setMessages(
      buildMessagesFromTurns(payload.turns ?? [], uploadedImageUrl || payload.current_img_url),
    );
  }

  async function handleQuickCreate(sourceImage: string, title: string) {
    if (isCreating || !sourceImage) return;

    setRequestError("");
    setIsCreating(true);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ img_url: BACKEND_PLACEHOLDER_IMAGE }),
      });

      const payload = (await response.json()) as SessionResponse & { error?: string };
      if (!response.ok) {
        setRequestError(payload.error || "创建会话失败");
        return;
      }

      setSessionId(payload.session_id);
      setHistoryTitle(title);
      setCurrentImageUrl(sourceImage);
      setRecommendations(payload.recommendations ?? []);
      setDismissedRecommendationIds([]);
      setMessages(buildMessagesFromTurns([], sourceImage));
      setStatusText("已进入场景绘画");
    } catch {
      setRequestError("创建会话请求失败，请稍后再试");
    } finally {
      setIsCreating(false);
    }
  }

  function handleCreateEntry() {
    if (isCreating) return;

    const nextIndex = sessionCounter + 1;
    const nextTitle = `图片处理#${nextIndex}`;
    setSessionCounter(nextIndex);
    setHistoryTitle(nextTitle);
    pendingHistoryTitleRef.current = nextTitle;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: { target: HTMLInputElement }) {
    const file = event.target.files?.[0];
    if (!file) {
      if (!sessionId) {
        setHistoryTitle("");
        pendingHistoryTitleRef.current = "";
      }
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedImageUrl(dataUrl);
      setUploadedFileName(file.name);
      setCurrentImageUrl(dataUrl);
      setMessages(buildMessagesFromTurns([], dataUrl));
      setRecommendations([]);
      setDismissedRecommendationIds([]);
      setSessionId("");
      setActiveTurnId("");
      setStatusText("图片上传成功，等待推荐指令");
      await handleQuickCreate(
        dataUrl,
        pendingHistoryTitleRef.current || historyTitle || `图片处理#${sessionCounter || 1}`,
      );
    } catch {
      setRequestError("读取图片失败，请重新上传");
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
          setStatusText("本轮完成");
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
            setActiveTurnId(event.turn_id);
            setStatusText("智能体正在分析图片并生成编辑方案");
            break;
          case "node_start":
            setStatusText(`正在处理：${event.node}`);
            break;
          case "node_complete":
            setStatusText(`已完成：${event.node}`);
            break;
          case "clarify":
            setMessages((prev) => [
              ...prev,
              {
                id: `clarify-${Date.now()}`,
                role: "assistant",
                label: AGENT_NAME,
                text: event.question,
              },
            ]);
            setStatusText("系统需要进一步澄清");
            break;
          case "quality_check":
            setStatusText(event.passed ? "质量检查通过" : "质量检查未通过");
            break;
          case "turn_complete":
            setCurrentImageUrl(event.output_img_url);
            setStatusText("图像编辑完成");
            await refreshSession(session);
            setActiveTurnId("");
            break;
          case "turn_error":
            setRequestError(event.error);
            setStatusText("执行失败");
            setActiveTurnId("");
            break;
        }
      }
    }
  }

  async function handleSend(options?: { selectedRecId?: string; displayText?: string }) {
    if (!sessionId || isStreaming) return;

    const command = options?.displayText || userCmd;
    const selectedRecId = options?.selectedRecId || null;

    if (!command && !selectedRecId) {
      setRequestError("请输入编辑指令或点击推荐语");
      return;
    }

    setIsStreaming(true);
    setRequestError("");

    if (options?.displayText) {
      setDismissedRecommendationIds((prev) =>
        prev.includes(HIDE_ALL_RECOMMENDATIONS_KEY)
          ? prev
          : [
              HIDE_ALL_RECOMMENDATIONS_KEY,
              ...prev,
              ...(selectedRecId ? [selectedRecId] : []),
            ],
      );
    } else if (selectedRecId) {
      setDismissedRecommendationIds((prev) =>
        prev.includes(selectedRecId) ? prev : [...prev, selectedRecId],
      );
    }

    if (command) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-user-${Date.now()}`,
          role: "user",
          label: USER_NAME,
          text: command,
        },
      ]);
    }

    if (!options?.selectedRecId) {
      setUserCmd("");
    }

    try {
      const response = await fetch(`/api/conversations/${sessionId}/turns`, {
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

      await consumeTurnStream(response, sessionId);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "执行失败");
      setStatusText("执行失败");
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
      setActiveTurnId("");
      setIsStreaming(false);
      setStatusText("已发送取消请求");
    } catch {
      setRequestError("取消失败");
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
              <p className="brand-title">Pro Studio</p>
              <p className="brand-subtitle">智能图片处理助手</p>
            </div>
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={handleCreateEntry}
            disabled={isCreating}
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
              {historyTitle ? (
                <button className="history-item is-active history-item-live">
                  <img src={SIDEBAR_CHAT_ICON} alt="" className="history-item-image" />
                  <span className="history-copy">
                    <strong>{historyTitle || "图片处理#1"}</strong>
                    <span>{sessionId ? uploadedPreviewName : "等待上传图片..."}</span>
                  </span>
                  <img src={SIDEBAR_DELETE_ICON} alt="" className="history-item-delete" />
                </button>
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
              <p>{auth?.key_hint || "key-mockui-****"}</p>
              <span>Scene Paint Mode</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-group">
            <h1>Studio Precision</h1>
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

        {!showUploadedPreview && !uploadedImageUrl ? (
          <section className="scene-banner">
            <div className="scene-banner-copy">
              <span className="panel-kicker">SCENE</span>
              <strong>场景绘画</strong>
              <span>{sessionId ? `Scene: ${sessionId.slice(0, 16)}...` : "点击左上角“创建新绘画”即可进入场景绘画"}</span>
            </div>
            <div className="scene-banner-status">
              <span>{statusText}</span>
              {requestError ? <em>{requestError}</em> : null}
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
          {showPendingAgentPreview ? (
            <article className="message">
              <div className="message-label">
                <span>{AGENT_NAME}</span>
              </div>
              <div className="assistant-response assistant-response-preview">
                <div className="assistant-image-frame">
                  <img
                    src={uploadedImageUrl}
                    alt="uploaded reference"
                    className="assistant-image"
                  />
                </div>
              </div>
            </article>
          ) : null}

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
          {visibleSuggestions.length > 0 ? (
            <>
              {showUploadedPreview ? (
                <div className="suggestions-heading">推荐处理指令</div>
              ) : null}
              <div className={showUploadedPreview ? "suggestions suggestions-session" : "suggestions"}>
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
                    disabled={!sessionId || isStreaming}
                  >
                    <div className="suggestion-title">
                      <SuggestionIcon accent={item.accent} />
                      <span>{item.title}</span>
                    </div>
                    <div className="suggestion-subtitle">{item.subtitle}</div>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="composer-glow" />
          <div className="composer">
            <div className="composer-input-shell">
              <input
                className="composer-textarea"
                value={userCmd}
                onChange={(event) => setUserCmd(event.target.value)}
                placeholder={sessionId ? "输入指令继续编辑..." : "请先创建新对话..."}
                disabled={!sessionId || isStreaming}
              />
            </div>

            <div className="composer-toolbar">
              <div className="composer-left">
                <button
                  className="add-button"
                  aria-label="refresh session"
                  onClick={() => void (sessionId ? refreshSession(sessionId) : Promise.resolve())}
                >
                  <img src={COMPOSER_ADD_ICON} alt="" className="add-button-icon" />
                </button>

                <div className="mode-row">
                  <button className="mode-button" type="button">
                    <img src={COMPOSER_WEB_ICON} alt="" className="mode-icon-image mode-icon-web" />
                    <span>web</span>
                    <img src={COMPOSER_CHECK_ICON} alt="" className="mode-check-icon" />
                  </button>
                  <button className="mode-button" type="button">
                    <img
                      src={COMPOSER_THINKING_ICON}
                      alt=""
                      className="mode-icon-image mode-icon-thinking"
                    />
                    <span>Thinking</span>
                    <img src={COMPOSER_CHECK_ICON} alt="" className="mode-check-icon" />
                  </button>
                </div>
              </div>

              <div className="composer-right">
                <button
                  className="send-button"
                  aria-label="send"
                  type="button"
                  onClick={() => void (activeTurnId ? handleCancel() : handleSend())}
                  disabled={!sessionId || isStreaming}
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
    </main>
  );
}
