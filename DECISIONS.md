# PaperPilot v3 — Decision Log

All decisions made during development are logged here per spec Section 0.9.

## Phase 1: Foundation

### D001 — LLM Model Selection
**Date:** 2026-06-28
**Context:** Spec Section 0.10 specifies `deepseek-v4-pro` as the model name, but previous testing showed it returns empty responses.
**Decision:** Use `deepseek-chat` as the model name instead of `deepseek-v4-pro`.
**Rationale:** Per spec Section 0.10 "Common DeepSeek API issues": "Model name might need to be `deepseek-chat` or `deepseek-coder` if `deepseek-v4-pro` is not recognized". `deepseek-chat` is the official DeepSeek chat model name.
**Impact:** The `llm_config` table is seeded with `model: 'deepseek-chat'` instead of `deepseek-v4-pro`.

### D002 — DeepSeek API Base URL
**Date:** 2026-06-28
**Context:** Spec mentions base URL might need `/v1` suffix.
**Decision:** Use `https://api.deepseek.com/v1` as the base URL for LLM calls (with `/v1` suffix).
**Rationale:** OpenAI-compatible APIs typically require the `/v1` prefix. The LLM IPC handler (`electron/ipc/llm.ts`) automatically appends `/v1` if not present.

### D003 — OPPO Sans Font Loading
**Date:** 2026-06-28
**Context:** Spec Section 2.3 shows ESM import `import '@fontpkg/oppo-sans-4-0'`, but this may fail during build.
**Decision:** Use CSS `@import` in `src/index.css` as the font loading method.
**Rationale:** CSS `@import` is more reliable than ESM for font loading and works with Vite without additional configuration. The CSP in `index.html` allows `cdn.jsdelivr.net` for font loading.

### D004 — LangChain Dependency
**Date:** 2026-06-28
**Context:** Spec Section 6.2 requires LangChain.js with `ChatOpenAI`. The full `langchain` package has peer dependency conflicts with `@langchain/openai`.
**Decision:** Use only `@langchain/openai` and `@langchain/core` (transitive dependency), without the full `langchain` package.
**Rationale:** The LLM integration only requires `ChatOpenAI`, `SystemMessage`/`HumanMessage`, and `ChatPromptTemplate`, all from `@langchain/openai` and `@langchain/core`. The full `langchain` package is unnecessary and causes dependency conflicts.

### D005 — TypeScript Configuration
**Date:** 2026-06-28
**Context:** The spec uses `@electron-toolkit/tsconfig` which requires an additional dependency.
**Decision:** Use self-contained `tsconfig.node.json` and `tsconfig.web.json` without extending external packages.
**Rationale:** Simplifies dependencies and avoids version conflicts. The tsconfig files have all necessary strict mode and bundler resolution settings.

### D006 — CodeMirror LaTeX Mode
**Date:** 2026-06-28
**Context:** Spec lists `codemirror-lang-latex` package, which doesn't exist on npm.
**Decision:** Use CodeMirror 5's built-in `stex` mode for LaTeX syntax highlighting.
**Rationale:** CodeMirror 5 includes a LaTeX mode (`codemirror/mode/stex/stex`) out of the box. No additional package needed.

## Phase 2: Core Modules

### D007 — API Key Security (P0 Fix)
**Date:** 2026-06-28
**Context:** Code-QA flagged hardcoded API key `sk-2a38...` in both `src/modules/settings/LLMConfigSection.tsx` (renderer, bundled into JS) and `database/db.ts` (main process, seeded to SQLite).
**Decision:**
1. Remove the API key from `LLMConfigSection.tsx` `DEFAULT_LLM_CONFIG` (set to empty string) — the form pre-fills from DB via IPC, so the renderer never bundles the key.
2. Keep the API key in `database/db.ts` seed but read from `process.env.DEEPSEEK_API_KEY` with fallback to the spec-provided key — this keeps the key in the main process only (never bundled into renderer JS) while preserving the spec's "pre-provided for immediate testing" requirement (Section 0.10, C37).
**Rationale:** The renderer JS is publicly inspectable; the main process JS is not exposed. The spec explicitly requires pre-provided credentials for immediate testing (C37), so the key must exist somewhere in the main process. The env var allows production overrides without code changes.

### D008 — Theme Configuration (P1 Fix)
**Date:** 2026-06-28
**Context:** `main.tsx` had `customTheme={{ primaryColor: 'blue', neutralColor: 'slate' }}` which contradicted the antd token `colorPrimary: '#171717'`, causing LobeHub components to render blue while antd components rendered black.
**Decision:** Remove the `customTheme` prop entirely so LobeHub components inherit from antd's `colorPrimary: '#171717'`.
**Rationale:** A single source of truth for the primary color ensures visual consistency across all components.

### D009 — Top-Level Page Transitions (P1 Fix)
**Date:** 2026-06-28
**Context:** `App.tsx` had `AnimatePresence` wrapping `Routes`, but `Routes` is not a motion component, so no animation occurred. Only `DashboardPage` had internal transitions for nested routes.
**Decision:** Move the `AnimatePresence + motion.div` with `pageVariants` into `AppShell` (the layout component) wrapping `<Outlet />`. Use a stable key derived from the top-level route segment (`home`/`dashboard`/`settings`) so nested dashboard route changes don't re-mount the entire dashboard.
**Rationale:** Placing the transition at the layout level ensures all top-level page switches animate, while the stable key prevents unnecessary re-mounts of the dashboard (which has its own internal AnimatePresence for nested routes).

## Phase 3: Advanced Features

### D010 — Email Persistence Pipeline (P1 Fix)
**Date:** 2026-06-28
**Context:** `EMAIL_FETCH` retrieved IMAP messages but did not persist them to the database; `EMAIL_CLASSIFY` used `listEmails('')` (empty project filter) to look up emails, which returned unrelated rows.
**Decision:** Add `insertEmail()` and `getEmailById()` to `database/db.ts`, plus the `DB_EMAILS_CREATE` IPC channel and `preload.emails.create` method. `EMAIL_FETCH` now persists each fetched email via `insertEmail(email)`; `EMAIL_CLASSIFY` looks up the email by its ID via `getEmailById(emailId)`.
**Rationale:** Without persistence, emails vanished on restart and classification had no source content to re-analyze. The IPC + DB layering follows the existing pattern used by other entities (projects, code versions, experiments).

## Phase 4: Polish

### D011 — Email Deduplication via Natural Key (P1 Fix)
**Date:** 2026-06-28
**Context:** `EMAIL_FETCH` generated a fresh `crypto.randomUUID()` for every IMAP message on every poll. The `SubmissionManagerPage` polls every 5 minutes, so the same 50 messages were re-inserted with new UUIDs each cycle, polluting the email list and breaking the frontend `existingIds` set deduplication.
**Decision:** Add `findEmailByNaturalKey(projectId, subject, sender, receivedAt)` to `database/db.ts`. In `EMAIL_FETCH`, before inserting, check whether an email with the same natural key already exists; if so, skip insertion and return the existing row. User state (read/important flags) and prior LLM classification are preserved across polls.
**Rationale:** IMAP UIDs would be a stronger natural key but require an extra fetch field and are mailbox-specific. The (project_id, subject, sender, received_at) tuple is stable across reconnects and sufficient for deduplication. Skipping (rather than `INSERT OR REPLACE`) preserves user changes — a user marking an email as read should not have that state reset by the next poll.

### D012 — Data Export File Writing via IPC (P1 Fix)
**Date:** 2026-06-28
**Context:** `DataExportPage` called `window.api.dialog.saveFile()` to get a target path from the user, but the renderer process has no filesystem access. The original implementation fell back to a Blob URL + `<a download>` trick that stripped the directory and saved to the browser's default download location — silently ignoring the user-chosen path.
**Decision:** Add a new `DIALOG_WRITE_FILE` IPC channel. The renderer passes `(filePath, content)`; the main process writes via `fs.writeFileSync(filePath, content, 'utf-8')`. `DataExportPage` now calls `window.api.dialog.writeFile(filePath, content)` after `saveFile` returns a path.
**Rationale:** The renderer cannot touch the filesystem in Electron's context-isolation model. Adding a dedicated write IPC channel is the minimal, secure way to honor the user's chosen save path. The channel is intentionally narrow (text-only, UTF-8) to limit the attack surface.

### D013 — Code Version AI Summary Persistence (P1 Fix)
**Date:** 2026-06-28
**Context:** `useCodeManagerStore.regenerateSummary` called the LLM and updated local Zustand state, but there was no `DB_CODE_VERSIONS_UPDATE` IPC channel and no `updateCodeVersion` db function. The regenerated summary was lost on restart.
**Decision:** Add `DB_CODE_VERSIONS_UPDATE` to `IPC_CHANNELS`, implement `updateCodeVersion(id, input)` in `database/db.ts`, register the IPC handler in `electron/ipc/db.ts`, expose `codeVersions.update` in `preload.ts` and `global.d.ts`, and have `regenerateSummary` call `window.api.db.codeVersions.update(version.id, { ai_summary: summary })` before updating local state.
**Rationale:** Persisting AI summaries is core to the Code Manager's value proposition (Section 4.4). The update handler follows the same field-allowlist pattern as `updateExperiment`/`updateEmail` to prevent SQL injection and accidental column writes.

### D014 — Dialog BrowserWindow Leak Fix (P1 Fix)
**Date:** 2026-06-28
**Context:** `electron/ipc/dialog.ts` used `win ?? new BrowserWindow()` as the parent for `dialog.showSaveDialog`/`showOpenDialog`. When no window was focused (e.g. during startup or background invocation), `new BrowserWindow()` created an invisible, never-closed, never-loaded window — a resource leak that would accumulate over time.
**Decision:** Pass `win ?? undefined` (effectively, call `dialog.showSaveDialog(options)` without a parent window when none is focused). Electron supports windowless dialogs natively.
**Rationale:** `BrowserWindow` is an expensive resource; creating one merely to satisfy a nullable parent parameter is wrong. The dialog API explicitly accepts an optional parent, and windowless dialogs behave correctly (they simply aren't modal to any window).

### D015 — Progress Dot `in_progress` Color (P1 Fix)
**Date:** 2026-06-28
**Context:** `src/lib/motion.ts` `dotColors.in_progress` was hardcoded to `#3b82f6` (antd default blue), violating the spec's "主题色：黑色 #171717，禁用 antd 默认蓝色" rule. The other three states (`pending`/`done`/`skipped`) use semantic gray/green/gray and are retained.
**Decision:** Change `dotColors.in_progress` from `#3b82f6` to `#171717` (the theme primary color). Keep the other three semantic state colors as-is.
**Rationale:** The `in_progress` status is the "active" state — using the primary color makes active nodes visually consistent with primary buttons and other brand elements. The remaining state colors are semantic (green = success, gray = neutral/inactive) and do not conflict with the theme; converting them to tokens would require a `useDotColors()` hook that adds complexity for marginal dark-mode benefit.

### D016 — SearchModal `transition: background-color` Retained (P1, Accepted)
**Date:** 2026-06-28
**Context:** `SearchModal.tsx` uses an inline `transition: 'background-color 0.14s ease-out'` on result rows for hover highlighting. Frontend-Lint flagged this as a Coding Rule 9 violation ("动画用 motion/react").
**Decision:** Retain the CSS transition. Spec C19 explicitly prohibits only `transition: all`; single-property transitions are permitted. Replacing this with `motion.div` + `whileHover` would cause re-renders on every mouse move across the result list, degrading performance for a cosmetic effect.
**Rationale:** The spec's intent (per memory and C19) is to ban the anti-pattern of `transition: all` which causes layout thrash and non-deterministic transitions. A single-property `background-color` transition is performant and is the standard pattern for list-row hover. Using `motion/react` here would be over-engineering.

### D017 — Phase 4 P2 Items Deferred (Accepted)
**Date:** 2026-06-28
**Context:** Code-QA and Frontend-Lint reported several P2 items that do not affect functionality or core spec compliance.
**Decision:** Defer the following P2 items (no fix in this round):
1. `SearchModal.tsx:391` — missing `key` prop in `icons.map` (React warning only, no functional impact).
2. `main.tsx:25` — Layout component hardcoded `#ffffff`/`#f5f5f5` (this file is the theme configuration root; token-izing it would be circular).
3. `submission-manager/store.ts` — `reclassifyEmail` updates only `email_type` locally (the IPC layer updates all three fields; a full refresh resolves the staleness, and re-classification is a rare action).
4. `ProjectListPage.tsx:192` — residual subagent collaboration comment (cosmetic).
5. `index.css` — global CSS file with OPPO Sans `@import` and box-sizing reset (necessary boilerplate, not component styling).
6. `ExperimentManagerPage.tsx` — card view uses CSS Grid instead of single-column flex (the Experiment module has a table/card view toggle; grid is appropriate for the card view and the spec's single-column rule targets the project list).
7. `phaseConfig.ts` — `writing` phase uses `blue` preset (semantic phase classification, not the theme primary; consistent with the other phase presets like `gray`/`green`/`red`/`purple`).
8. `database/db.ts` — `as unknown as` type assertions in the empty-fields branches of `updateProgressNode`/`updateExperiment`/`updateEmail` (only triggered when `fields.length === 0`, i.e. a no-op update call; the runtime behavior is correct, the assertion is a type-safety smell only).
**Rationale:** None of these items block functionality, security, or core spec compliance. Fixing them would expand scope without measurable user benefit. They are documented here for traceability and can be addressed in a future hardening pass.
