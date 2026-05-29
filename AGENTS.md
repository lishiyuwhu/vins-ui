# AGENTS.md — vins-ui

## What this repo is

Next.js 15 + React 19 frontend for the **VINS Agent V2** AI image-editing chat UI. It is a single-package project (not a monorepo). The backend is a separate Python/FastAPI service documented in `VINS Agent V2 README.md`; this repo only contains the browser UI.

## Commands

```bash
npm install          # install deps (npm only — no yarn/pnpm)
npm run dev          # dev server
npm run build        # production build (also runs type-check)
npm run start        # serve production build
npm run lint         # Next.js built-in ESLint (no custom .eslintrc)
npx tsc --noEmit     # type-check without building
```

**No test runner exists.** There are no test files or test scripts.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GATEWAY_BASE_URL` | `https://bluepixel.vivo.com.cn` | Backend API gateway URL |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | `"dev-local"` | Build badge in UI (first 7 chars) |

Set these in a `.env.local` (not committed). In dev, all `/api/v1/*` and `/web/*` browser requests are reverse-proxied by Next.js to the gateway — no CORS config needed locally.

## Architecture quirks

- **Entire UI is one file:** `app/page.tsx` (~3,742 lines), a single `"use client"` component. No routing, no component library, no state management library.
- **No UI library / no Tailwind.** All styles are in `app/globals.css` (~4,242 lines) using CSS custom properties and hand-written component classes.
- **`next-env.d.ts` is generated** — do not edit.
- Path alias `@/*` resolves to the repo root (e.g. `@/app/...`).
- `strict: true`, `allowJs: false` — no plain `.js` source files.
- Mobile breakpoints: `≤1100px` (sidebar drawer), `≤760px` (phone layout). The `@media (max-width: 760px)` block is at EOF of `globals.css` so it wins by source order — do not add mobile overrides elsewhere.

## Three workspace modes in the UI

- `"agent"` — multi-turn AI image editing chat (primary feature)
- `"cosplay"` — Cosplay pose style-transfer
- `"style3"` — Style 3.0 transfer

## API proxy (next.config.ts)

Next.js rewrites proxy these paths to the gateway:
- `/web/:path*`
- `/api/v1/:path*`

### Key backend endpoints

| Endpoint | Purpose |
|---|---|
| `POST /web/login` (form-data) | Auth |
| `GET /web/me` | Session check |
| `POST /web/logout` | Sign out |
| `GET /web/conversations` | List DB conversations (`{items, next_cursor, has_more}`) |
| `GET /web/conversations/:id/messages` | Load message history (`{items, ...}`) |
| `POST /web/conversations/:id/rename` | Rename conversation (`{title}`) |
| `POST /web/conversations/:id/delete` | Delete conversation |
| `GET /web/download-image` | Proxied image download |
| `POST /web/style-edit/tasks` | Start style-transfer task |
| `GET /web/style-edit/tasks/:id` | Poll style-transfer task |
| `POST /web/style-edit/transfer` | Style 3.0 transfer |
| `POST /api/v1/agent/conversations` | Create agent session |
| `GET /api/v1/agent/conversations/:id` | Get session + turns |
| `POST /api/v1/agent/conversations/:id/turns` | Submit turn (SSE via fetch+ReadableStream, **not** EventSource) |
| `GET /api/v1/agent/conversations/:id/turns/:tid` | Poll single turn |
| `POST /api/v1/agent/conversations/:id/image` | Bind uploaded image |
| `POST /api/v1/agent/conversations/:id/recommend` | Trigger recommendations |
| `POST /api/v1/agent/upload-file` | Upload image |

All fetch calls use `credentials: "include"` (session cookie auth).

## Sidebar conversation persistence

The sidebar is backed by the gateway DB. On login:
1. `GET /web/conversations` populates the sidebar list (local-only entries stay pinned at the top)
2. Clicking a conversation fires `GET /web/conversations/:id/messages` once (lazy hydration)
3. Any `pending` assistant messages resume turn polling via existing `pollTurnResult`

Key types in `app/page.tsx`:
- `LocalConversation` — state entry; `dbId?: number` present when DB-backed
- `DbConversation`, `DbMessage`, `AssistantContent` — raw gateway shapes

Helper functions (module-level, before the component):
- `fetchConversationsFromDb`, `fetchMessagesFromDb`, `renameConversationOnDb`, `deleteConversationOnDb`
- `localConversationFromDb`, `chatMessagesFromDb`

Rename/delete use `window.prompt` / `window.confirm` (v1). Deferred improvements tracked in `TODO.md`.

## CSS layout rules to know

- `.history-list` is `display: grid; grid-auto-rows: 44px` — row height is locked; changing to `flex` or removing `grid-auto-rows` will cause rows to compress when overflow is present
- `.history-item-wrapper` must **not** have `overflow: hidden` — setting it changes the grid item's block-size resolution and prevents scroll
- Sidebar scroll lives on `.history-list { overflow: hidden auto }` — the panel and main container do not scroll independently

## Android device testing via USB

When the dev server runs on your Mac and you need to test on an Android phone (no shared Wi-Fi needed):

```bash
# 1. Enable USB Debugging on Android (Developer Options)
# 2. Connect phone via USB
# 3. Start dev server
npm run dev

# 4. Forward port over USB (Mac → phone)
adb reverse tcp:3000 tcp:3000

# 5. On phone Chrome, open http://localhost:3000
# 6. For remote DevTools, on Mac Chrome open chrome://inspect/#devices
```

Install adb: `brew install android-platform-tools`

`adb reverse` tunnels the phone's `localhost:3000` to the Mac's `localhost:3000` over USB. The Next.js API proxy on the Mac handles all backend calls — the phone only needs to reach the dev server.

The Android companion project lives at `vins-ui-android/` (sibling repo), which wraps the deployed URL in a WebView APK. See `vins-ui-android/WEBVIEW_APK_GUIDE.md` for details.

## No CI

No `.github/workflows/` directory. No pre-commit hooks.

## Deferred work

See `TODO.md` in the repo root for outstanding items: pagination, optimistic UI with task_id matching, inline rename/delete modals, per-message CRUD, Access Token UI, and more.
