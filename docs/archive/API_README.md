# VINS Agent V2 — 多轮对话图像编辑服务

基于 **DialogueManager** 架构的多轮对话 AI 图像编辑系统。用户可以通过自然语言与系统进行多轮交互，逐步描述编辑意图；系统判断意图是否明确，不足时主动追问，明确后调用底层 Jarvis 编辑管线执行图像编辑，并以流式方式实时返回执行进度。

---

## 目录

- [主要功能](#主要功能)
- [系统架构](#系统架构)
- [目录结构](#目录结构)
- [部署](#部署)
- [认证](#认证)
- [API 参考](#api-参考)
- [SSE 流式事件格式](#sse-流式事件格式)
- [Gradio 前端测试](#gradio-前端测试)
- [自定义前端接入](#自定义前端接入)

---

## 主要功能

| 功能 | 说明 |
|------|------|
| **多轮对话管理** | 每个会话维护完整的消息历史，支持上下文感知的多轮编辑 |
| **智能澄清** | DialogueManager 通过 LLM 判断用户意图是否足够明确，不足时返回追问，明确后直接执行 |
| **推荐语** | 会话创建后可异步触发推荐语生成；等待期间用户仍可直接输入自定义指令开始编辑 |
| **流式进度** | 以 OpenAI stream 格式（`data: <JSON>\n\n`）实时推送节点执行进度 |
| **并发控制** | 同一会话同一时刻只允许一个 execute turn 在执行，不同会话可并发 |
| **会话生命周期** | 会话 TTL 1 小时，最多同时存在 100 个会话，自动 LRU 清理 |
| **取消支持** | 可对正在执行的 turn 发送取消请求 |

---

## 系统架构

```
用户请求
   │
   ▼
FastAPI (port 8001)
   │
   ├── POST /conversations              → 创建空会话
   ├── POST /conversations/{id}/image   → 绑定输入图片
   ├── POST /conversations/{id}/recommend → 异步触发推荐语生成
   ├── GET  /conversations/{id}         → 查询会话状态
   ├── POST /conversations/{id}/turns   → 执行一轮（SSE 流式返回）
   └── POST /conversations/{id}/turns/{tid}/cancel
          │
          ▼
   ConversationController
          │
          ├── DialogueManager (LLM) → 判断 clarify / execute
          │
          └── execute 路径
                 │
                 ▼
          graph_runner.py (异步队列桥接)
                 │
                 ▼
          vins_agent_toolbased / jarvis_graph
          START → [intent?] → polish → planner → executor → END
                 │
                 ▼
          QualityChecker (占位，始终通过)
```

`graph_runner.py` 在模块导入时自动将 `vins_agent_toolbased/` 加入 `sys.path`，无需手动配置 `PYTHONPATH`。

---

## 目录结构

```
vins_agent_v2/
├── .env.example                      # 配置模板，复制为 .env 后填写真实值
├── pyproject.toml                    # uv 项目依赖清单
├── uv.lock                           # 锁定依赖版本（已生成）
├── run_conversation_ui.py            # Gradio 测试前端（可独立运行）
│
├── agent/
│   ├── conversation_state.py         # ConversationSession / TurnRecord 数据模型
│   ├── dialogue_manager.py           # clarify / execute 决策（调用 LLM）
│   ├── graph_runner.py               # 包装 toolbased Jarvis Graph 为流式生成器
│   └── quality_checker.py            # 质量检查（当前为占位实现）
│
├── config/
│   └── settings.py                   # pydantic-settings，读取 .env 配置
│
└── deploy/
    ├── app.py                        # FastAPI 应用，注册路由、CORS 中间件
    ├── run.py                        # uvicorn 启动入口
    ├── routers/
    │   └── conversation.py           # 6 个 REST 路由
    ├── schemas/
    │   └── conversation.py           # 请求/响应/流式事件 Pydantic 模型
    └── services/
        └── conversation_controller.py  # 核心控制器：会话存储、调度、流式输出
```

与 V2 同级的依赖目录：

```
vins_agent/                           # 仓库根目录
├── vins_agent_v2/                    # 本项目
└── vins_agent_toolbased/             # 必须存在的兄弟目录（Jarvis 编辑管线）
```

新增认证相关文件：

```
vins_agent_v2/
├── config/
│   └── settings.py                   # 新增字段：VALID_API_KEYS / API_KEY_COOKIE_NAME / API_KEY_COOKIE_MAX_AGE
├── deploy/
│   ├── middleware/
│   │   └── auth.py                   # 新增：require_api_key Depends + AuthMiddleware（备用）
│   ├── routers/
│   │   └── auth.py                   # 新增：POST /auth/verify / GET /auth/me / POST /auth/logout
│   └── schemas/
│       └── auth.py                   # 新增：VerifyRequest / VerifyResponse / MeResponse / LogoutResponse
```

---

## 部署

### 前置条件

- Python 3.10+
- [uv](https://github.com/astral-sh/uv)（包管理器）
- 已克隆完整仓库，`vins_agent_v2/` 和 `vins_agent_toolbased/` 位于同一父目录下
- 处于 Vivo 内网（私有 pip 索引 + 内部模型/图像服务地址均在内网）

### 第一步：安装依赖

```bash
cd vins_agent_v2
uv sync
```

`uv sync` 会自动创建 `.venv` 并安装所有依赖（包括 `ai-camera-l-server` 等内部包）。依赖版本由 `uv.lock` 锁定，可复现构建。

### 第二步：配置环境变量

```bash
cp .env.example .env
```

按实际环境编辑 `.env`，最少需要填写以下字段：

```dotenv
# DialogueManager 使用的 LLM（OpenAI 兼容接口）
OPENAI_BASE_URL=http://10.x.x.x:xxxxx/v1
OPENAI_API_KEY=EMPTY
OPENAI_MODEL=/path/to/your/model

# toolbased intent/polish 节点使用的 LLM（Anthropic 兼容接口）
ANTHROPIC_BASE_URL=https://api.minimaxi.com/v1
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_MODEL=MiniMax-M2.5

# 图像编辑服务
FAST_IMAGE_EDIT_API_URL=http://...
SLOW_IMAGE_EDIT_API_URL=http://...
IMAGE_UPLOAD_API_URL=http://...
PROMPT_RECOMMEND_API_URL=http://...

# 对象存储（图像上传）
GAIA_HOST=...
GAIA_AK=...
GAIA_SK=...
GAIA_BUCKET=...

# V2 服务端口（默认 8001，toolbased 占用 4343）
DEPLOY_PORT=8001
```

> **说明：** 若 `vins_agent_v2/.env` 不存在，`settings.py` 会自动 fallback 读取 `vins_agent_toolbased/.env`，因此两个项目可共用一份配置。

### 第三步：启动服务

进入 `vins_agent_v2/` 目录后启动：

```bash
# 进入 vins_agent_v2 目录
cd vins_agent_v2

# 方式一：使用 uv（推荐，自动激活 .venv）
uv run python -m deploy.run

# 方式二：激活 .venv 后直接运行
source .venv/bin/activate
python -m deploy.run
```

启动参数：

```bash
# 指定 host / port（优先级高于 .env 中的 DEPLOY_HOST / DEPLOY_PORT）
python -m deploy.run --host 0.0.0.0 --port 8001

# 开发模式（代码修改后自动重载）
python -m deploy.run --reload
```

服务启动后访问健康检查接口确认正常：

```bash
curl http://localhost:8001/api/v1/health
# {"status":"ok","service":"vins-agent-v2"}
```

---

## 认证

### 整体设计

采用 **API Key + HttpOnly Cookie** 方案。用户首次输入 API Key，后端（BFF 层）校验后将其写入 HttpOnly Cookie；后续所有业务请求自动携带 Cookie，浏览器 JavaScript 不可读取 Cookie 中的 Key。

```
用户浏览器
  │
  │ POST /api/v1/auth/verify  {"api_key": "key-alice-xxx"}
  ▼
vins_agent_v2 后端
  │
  │ 对比 VALID_API_KEYS 环境变量（本地校验，不请求外部服务）
  ▼
校验通过
  │
  │ Set-Cookie: aic_api_key=key-alice-xxx; HttpOnly; Secure; SameSite=Lax
  ▼
浏览器（后续请求自动携带 Cookie）
```

后续业务请求：

```
浏览器
  │ GET /api/v1/conversations/xxx    （自动携带 HttpOnly Cookie）
  ▼
vins_agent_v2 后端（require_api_key Depends）
  │ 从 Cookie 中读取 api_key 并校验
  ▼
业务逻辑处理
```

### 环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VALID_API_KEYS` | 有效 Key 列表，逗号分隔；**为空时关闭鉴权（仅限本地开发）** | `""` |
| `API_KEY_COOKIE_NAME` | HttpOnly Cookie 名称 | `aic_api_key` |
| `API_KEY_COOKIE_MAX_AGE` | Cookie 有效期（秒） | `2592000`（30 天） |

Key 格式建议：

```
key-<用户标识>-<随机字符>
# 示例
key-alice-xKj9mNpQrStUvWx
key-bob-yZaAbBcCdDeEfFgG
```

**吊销 Key**：从 `VALID_API_KEYS` 中删除对应 Key，重启服务即生效。
**新增 Key**：在 `VALID_API_KEYS` 末尾追加，重启服务即生效。

### 认证 API

#### POST /api/v1/auth/verify — 验证 API Key

验证 API Key 并写入 HttpOnly Cookie。

**请求体：**

```json
{
  "api_key": "key-alice-xKj9mNpQrStUvWx"
}
```

**响应（200）：**

```json
{
  "ok": true
}
```

同时 Set-Cookie：

```
Set-Cookie: aic_api_key=key-alice-xKj9mNpQrStUvWx; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

**错误：**

| 状态码 | 原因 |
|--------|------|
| `401` | api_key 不在 VALID_API_KEYS 中 |
| `422` | api_key 字段为空 |

---

#### GET /api/v1/auth/me — 检查登录态

检查当前 Cookie 是否有效，返回脱敏的 Key 标识。常用于页面初始化时判断用户是否已登录。

**请求：** 无请求体，浏览器自动携带 HttpOnly Cookie。

**响应（200）：**

```json
{
  "ok": true,
  "key_hint": "key-alice-****"
}
```

**错误：**

| 状态码 | 原因 |
|--------|------|
| `401` | Cookie 不存在（未登录） |
| `401` | Key 已从 VALID_API_KEYS 中吊销（自动清除旧 Cookie） |

---

#### POST /api/v1/auth/logout — 登出

清除 HttpOnly Cookie，实现登出。

**请求：** 无请求体。

**响应（200）：**

```json
{
  "ok": true
}
```

同时 Set-Cookie：

```
Set-Cookie: aic_api_key=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

---

### 业务接口鉴权

所有 `/api/v1/conversations/*` 路由均通过 `require_api_key` Depends 施加鉴权：

- **浏览器调用**：通过 HttpOnly Cookie 自动鉴权（无需手动传 Key）
- **非浏览器调用**（Gradio / curl / 测试脚本）：在请求头中传 `Authorization: Bearer <api_key>`

示例（curl）：

```bash
# 方式 1：Cookie（通过浏览器登录后 Cookie 自动携带）
curl -b "aic_api_key=key-alice-xxx" http://localhost:8001/api/v1/conversations

# 方式 2：Authorization 头（非浏览器调用方）
curl -H "Authorization: Bearer key-alice-xxx" http://localhost:8001/api/v1/conversations
```

**VALID_API_KEYS 为空时**（开发模式），所有业务接口直接放行，无需鉴权。

---

## API 参考

所有接口的路径前缀均为 `/api/v1`。

### POST /api/v1/conversations — 创建会话

创建一个新的空会话，不绑定图片，也不自动拉取推荐语。

**请求体：**

```json
{}
```

**响应（201）：**

```json
{
  "session_id": "3f4a1b2c...",
  "current_img_url": null,
  "recommendations": [],
  "recommendation_status": "idle",
  "recommendation_error": null
}
```

---

### POST /api/v1/conversations/{session_id}/image — 绑定会话图片

将输入图片绑定到指定会话，作为后续 turns 的输入图。

**请求体：**

```json
{
  "img_url": "https://example.com/photo.jpg"
}
```

**响应（200）：**

```json
{
  "session_id": "3f4a1b2c...",
  "original_img_url": "https://example.com/photo.jpg",
  "current_img_url": "https://example.com/photo.jpg"
}
```

---

### POST /api/v1/conversations/{session_id}/recommend — 异步触发推荐语生成

基于当前会话已绑定的图片启动一个异步推荐语任务。接口会立即返回，不等待推荐语生成完成。
推荐语结果通过 `GET /api/v1/conversations/{session_id}` 轮询获取。
推荐语生成过程中，用户仍可直接调用 `/turns` 提交自定义 prompt。

**请求体：**

```json
{
  "img_url": "https://example.com/photo.jpg"
}
```

**响应（202）：**

```json
{
  "status": "running",
  "recommendations": [],
  "error": null
}
```

**错误：**

- `404` — 会话不存在或已过期
- `422` — 当前会话尚未绑定输入图片
- `409` — 请求中的 `img_url` 与当前会话绑定图片不一致

---

### GET /api/v1/conversations/{session_id} — 查询会话

获取会话当前状态，包括历史 turn 记录。

**响应（200）：**

```json
{
  "session_id": "3f4a1b2c...",
  "original_img_url": "https://example.com/photo.jpg",
  "current_img_url": "https://example.com/edited.jpg",
  "active_turn_id": null,
  "recommendation_status": "succeeded",
  "recommendation_error": null,
  "recommendations": [...],
  "turns": [
    {
      "turn_id": "t_abc123",
      "turn_index": 0,
      "user_cmd": "把天空换成夜景",
      "resolved_cmd": "Replace the sky with a night scene featuring stars",
      "skip_intent": false,
      "status": "succeeded",
      "input_img_url": "https://...",
      "output_img_url": "https://...",
      "finished_at": "2026-04-14T10:00:00Z"
    }
  ]
}
```

**错误：** `404` — 会话不存在或已过期。

---

### POST /api/v1/conversations/{session_id}/turns — 执行一轮（流式）

发起一轮对话，以 SSE 格式实时返回执行进度。`user_cmd` 和 `selected_rec_id` 至少提供一个。
执行前必须已通过 `/image` 绑定输入图片。

**请求体：**

```json
{
  "user_cmd": "把天空换成夜景",
  "selected_rec_id": null
}
```

或使用推荐语：

```json
{
  "user_cmd": null,
  "selected_rec_id": "rec_001"
}
```

**响应：** `Content-Type: text/event-stream`，事件格式见 [SSE 流式事件格式](#sse-流式事件格式)。

**错误：**

- `404` — 会话不存在或已过期
- `422` — 当前会话尚未绑定输入图片，或 `user_cmd` / `selected_rec_id` 都未提供

---

### POST /api/v1/conversations/{session_id}/turns/{turn_id}/cancel — 取消 turn

对正在执行的 turn 发送取消请求。

**响应（200）：**

```json
{
  "ok": true,
  "message": "turn cancelled"
}
```

---

## SSE 流式事件格式

每条事件的格式为：

```
data: {"type": "<event_type>", ...fields}\n\n
```

流结束时固定发送：

```
data: [DONE]\n\n
```

### execute 路径（正常执行）

| 顺序 | `type` | 字段 | 说明 |
|------|--------|------|------|
| 1 | `turn_start` | `turn_id: str` | turn 开始执行 |
| 2..N | `node_start` | `node: str` | 某个 graph 节点开始（intent / polish / planner / executor）|
| 2..N | `node_complete` | `node: str` | 该节点执行完毕 |
| N+1 | `quality_check` | `passed: bool` | 质量检查结果 |
| N+2 | `turn_complete` | `turn_id: str`, `output_img_url: str` | 编辑完成，含输出图像 URL |
| 末尾 | `[DONE]` | — | 流结束标志 |

### clarify 路径（需追问）

| `type` | 字段 | 说明 |
|--------|------|------|
| `clarify` | `question: str` | 系统追问内容 |
| `[DONE]` | — | 流结束 |

### 错误

| `type` | 字段 | 说明 |
|--------|------|------|
| `turn_error` | `error: str` | 错误信息 |
| `[DONE]` | — | 流结束 |

### 完整示例

```
data: {"type":"turn_start","turn_id":"t_abc123"}

data: {"type":"node_start","node":"intent"}

data: {"type":"node_complete","node":"intent"}

data: {"type":"node_start","node":"polish"}

data: {"type":"node_complete","node":"polish"}

data: {"type":"node_start","node":"planner"}

data: {"type":"node_complete","node":"planner"}

data: {"type":"node_start","node":"executor"}

data: {"type":"node_complete","node":"executor"}

data: {"type":"quality_check","passed":true}

data: {"type":"turn_complete","turn_id":"t_abc123","output_img_url":"https://..."}

data: [DONE]
```

---

## Gradio 前端测试

V2 内置了一个 Gradio 测试前端，可在本地快速验证服务是否正常。

### 启动方式

确保 V2 服务（端口 8001）已启动，然后进入 `vins_agent_v2/` 目录，在另一个终端执行：

```bash
# 进入 vins_agent_v2 目录
cd vins_agent_v2
uv run python run_conversation_ui.py

# 连接自定义服务地址
uv run python run_conversation_ui.py --server http://localhost:8001

# 指定 Gradio 端口（默认 7860）
uv run python run_conversation_ui.py --port 7860

# 生成公网临时分享链接
uv run python run_conversation_ui.py --share
```

浏览器打开 `http://localhost:7860` 即可使用。

### 界面说明

```
┌──────────────────────────────────────────────────────┐
│  图片 URL: [___________________] [创建会话] [绑定图片] │
│                                  [获取推荐]           │
├──────────────────────────────────────────────────────┤
│  推荐：[黄金夕阳] [夜景星空] [复古胶片] [人像美肤]      │  ← 获取推荐后显示
├──────────────────────────────────────────────────────┤
│                                                      │
│   用户: 把天空换成夜景                                  │
│   AI:  [生成的图像缩略图]                               │
│   用户: 再加一些星星                                    │
│   AI:  [生成的图像缩略图]                               │
│                                                      │
├──────────────────────────────────────────────────────┤
│  状态: ✅ 图像生成 完成                                 │
├──────────────────────────────────────────────────────┤
│  编辑指令: [___________________________] [发送] [取消] │
└──────────────────────────────────────────────────────┘
```

**操作流程：**

1. 点击**创建会话**，先获得空会话 ID
2. 在顶部输入框粘贴图片 URL，点击**绑定图片**
3. 二选一：
   - 点击**获取推荐**异步启动推荐任务；等待期间也可以直接输入 prompt，稍后再刷新推荐结果
   - 直接在底部输入框输入自定义指令并点击**发送**
4. 状态栏实时显示节点执行进度；编辑完成后，结果图像出现在对话框中
5. 继续输入新指令进行下一轮编辑；系统会基于上下文理解多轮意图

---

## 自定义前端接入

以下是一个使用浏览器原生 `fetch` + `ReadableStream` 接入流式 API 的最简示例：

```javascript
// 1. 创建会话
const { session_id } = await fetch('/api/v1/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
}).then(r => r.json());

// 2. 绑定图片
await fetch(`/api/v1/conversations/${session_id}/image`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ img_url: 'https://example.com/photo.jpg' }),
});

// 3A. 可选：异步启动推荐语生成
await fetch(`/api/v1/conversations/${session_id}/recommend`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ img_url: 'https://example.com/photo.jpg' }),
}).then(r => r.json());

// 3B. 推荐语生成期间，也可以直接执行一轮自定义编辑
const response = await fetch(`/api/v1/conversations/${session_id}/turns`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_cmd: '把天空换成夜景' }),
});

// 3C. 之后通过查询会话状态获取推荐语
const conversation = await fetch(`/api/v1/conversations/${session_id}`).then(r => r.json());
if (conversation.recommendation_status === 'succeeded') {
  console.log(conversation.recommendations);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();  // 保留不完整的最后一行

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') break;

    const event = JSON.parse(payload);

    switch (event.type) {
      case 'turn_start':
        console.log('开始执行 turn:', event.turn_id);
        break;
      case 'node_start':
        console.log('节点开始:', event.node);
        break;
      case 'node_complete':
        console.log('节点完成:', event.node);
        break;
      case 'clarify':
        // 系统需要追问，展示问题并等待用户回答
        showClarifyQuestion(event.question);
        break;
      case 'quality_check':
        console.log('质量检查:', event.passed ? '通过' : '未通过');
        break;
      case 'turn_complete':
        // 编辑完成，更新图像
        updateImage(event.output_img_url);
        break;
      case 'turn_error':
        console.error('执行失败:', event.error);
        break;
    }
  }
}

// 4. 继续下一轮（系统会自动感知多轮上下文）
await fetch(`/api/v1/conversations/${session_id}/turns`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_cmd: '再加一些星星' }),
});
```

> **注意：** 请使用 `fetch` + `ReadableStream` 而非 `EventSource`，因为流式接口使用 `POST` 方法，`EventSource` 仅支持 `GET`。

---

## 节点名称说明

| `node` 值 | 含义 |
|-----------|------|
| `intent` | 意图识别（首轮自由输入时执行）|
| `polish` | 指令润色（将意图转化为结构化编辑 Prompt）|
| `planner` | 编辑规划（拆解编辑步骤）|
| `executor` | 图像生成（调用图像编辑服务，可能循环多次）|
