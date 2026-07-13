<p align="center">
  <img src="src/assets/logo/PaperPilot_black.svg" alt="PaperPilot" width="220" />
</p>

<h3 align="center">A Full-Lifecycle Academic Paper Management Tool</h3>

<p align="center">
  English &nbsp;·&nbsp; <a href="./README.md">简体中文</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F.svg" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB.svg" />
  <img alt="Status" src="https://img.shields.io/badge/status-alpha-orange.svg" />
</p>

<p align="center">
  <img src="src/assets/about_hero.jpg" alt="PaperPilot Preview" width="720" />
</p>

---

## Introduction

PaperPilot was born from a simple feeling: writing a paper shouldn't be this exhausting.

Topic notes scattered across sticky notes, code versions distinguished by folder names, experiment data stuffed in spreadsheets, LaTeX sources pasted back and forth between editors, post-submission emails drowning in the inbox — none of these steps are hard, yet each one drains your focus. The tools aren't wrong; they're just isolated, turning you into a courier between them.

PaperPilot brings the entire lifecycle of a paper onto a single desktop: **topic selection, code versioning, experiment logging, LaTeX writing, submission tracking, and data export** — each stage independent yet interconnected. It doesn't replace your thinking; it just makes the process smoother — giving researchers their time back for what truly matters.

## Core Features

| Module | Description |
| --- | --- |
| **Project Management** | Create, edit, and archive paper projects; card-based homepage with tag organization |
| **Progress Graph** | Visual progress nodes (topic → coding → experiment → writing → pending submission → submitted), with rejection-resubmission branches |
| **Code Versioning** | Snapshot every code version with auto-generated diffs and AI summaries; compare and trace back by version |
| **Experiment Logging** | Structured logging of parameters, datasets, metrics, and notes; supports table and key-value editing |
| **LaTeX Writing** | Built-in CodeMirror editor, multi-file project management, supports tectonic / pdflatex / xelatex / lualatex compilation, version history and PDF preview |
| **Submission Tracking** | IMAP email auto-fetching, filter relevant emails by paper title, AI-generated review summaries |
| **Data Export** | One-click export of full project data for backup and migration |
| **Settings Center** | Unified management of LLM, email, Git, LaTeX engine/storage, and appearance |

## Tech Stack

- **Runtime**: Electron 33 + Vite 6 + React 19 + TypeScript 5.7
- **UI**: [@lobehub/ui](https://github.com/lobeHub/lobe-ui) + Ant Design 6 + lucide-react
- **Animation**: [motion](https://github.com/motiondivision/motion) (spring physics)
- **Database**: better-sqlite3 (local-first, data never leaves the device)
- **AI**: LangChain + OpenAI-compatible API (DeepSeek by default)
- **Email**: imapflow + mailparser
- **Graph**: @xyflow/react (progress node graph)
- **Editor**: CodeMirror 5 (LaTeX syntax highlighting)
- **State**: Zustand + React Router 7

## Project Structure

```
PaperPilot_3/
├── electron/              # Electron main process
│   ├── index.ts           # Main entry
│   ├── preload.ts         # Preload script (IPC bridge)
│   └── ipc/               # IPC handlers (db/email/git/latex/llm/window)
├── src/                   # Renderer process (React)
│   ├── components/        # Layout & shared components
│   ├── modules/           # Feature modules (domain-organized)
│   │   ├── project-list/  # Homepage project list
│   │   ├── dashboard/     # Project detail & progress graph
│   │   ├── code-manager/  # Code version management
│   │   ├── experiment-manager/  # Experiment logging
│   │   ├── latex-editor/  # LaTeX editor
│   │   ├── submission-manager/ # Submission & email tracking
│   │   ├── data-export/   # Data export
│   │   ├── settings/      # Settings center
│   │   ├── archive/       # Archive
│   │   └── about/         # About
│   ├── stores/            # Zustand state
│   ├── lib/               # Utilities & config
│   └── assets/            # Static assets
├── database/              # DB schema & access layer
├── shared/                # Shared types (main/renderer)
├── scripts/               # Build, icon, seed scripts
├── resources/             # App icon
└── electron-builder.json  # Packaging config
```

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Windows / macOS / Linux

### Install Dependencies

```bash
npm install
```

> The `postinstall` script runs `electron-builder install-app-deps` automatically to compile native modules (better-sqlite3, etc.).

### Development Mode

```bash
npm run dev
```

In dev mode, the LLM config initializes with an empty API key. To pre-fill a DeepSeek key, set an environment variable:

**PowerShell**
```powershell
$env:DEEPSEEK_API_KEY = "your-key-here"; npm run dev
```

**bash / zsh**
```bash
DEEPSEEK_API_KEY=your-key-here npm run dev
```

> In production, the API key is never bundled into the app. Users must enter it under **Settings → LLM Config**.

### Demo Data

To populate demo data and experience the full workflow:

```bash
npm run seed:demo
```

This writes 5 fictional projects (covering accepted, reject-resubmit, pending-revise, in-experiment, and ideation stages) along with corresponding code versions, experiment records, emails, and LaTeX project files.

### Build & Package

```bash
# Compile main + renderer
npm run build

# Package installers (by platform)
npm run dist:win     # Windows x64 + arm64
npm run dist:mac     # macOS x64 + arm64
npm run dist:linux   # Linux x64 + arm64
```

## LaTeX Compilation

PaperPilot supports four LaTeX engines:

| Engine | Type | Notes |
| --- | --- | --- |
| **tectonic** | Bundled | Default engine, no extra install needed (auto-downloads on first use) |
| **pdflatex** | System | Requires a local TeX distribution (e.g. TeX Live / MiKTeX) |
| **xelatex** | System | Supports CJK, requires a local TeX distribution |
| **lualatex** | System | Requires a local TeX distribution |

System engines run 3 passes for cross-references, outputting to a `.build/` subdirectory. Switch engines under **Settings → LaTeX Engine**.

## Data & Privacy

- All data is stored in a local SQLite database and **never uploaded to any server**.
- Emails are fetched directly from your mail server via IMAP; credentials are stored only in the local database.
- LLM calls are made directly from your device, communicating only with the configured LLM provider.

## Development Docs

- [DECISIONS.md](./DECISIONS.md) — Architecture Decision Records (ADR)

## Contributing

Issues and Pull Requests are welcome. The project is currently in alpha; some interfaces may change.

## License

[MIT License](./LICENSE) © 2026 ZhanYiHui06
