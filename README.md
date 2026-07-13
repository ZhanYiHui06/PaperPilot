<p align="center">
  <img src="src/assets/logo/PaperPilot_black.svg" alt="PaperPilot" width="220" />
</p>

<h3 align="center">学术论文全生命周期管理工具</h3>

<p align="center">
  <a href="./README_EN.md">English</a> &nbsp;·&nbsp; 简体中文
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

## 简介

PaperPilot 诞生于一个朴素的感受：写一篇论文，本不该这么累。

选题记录散落在便签里，代码版本靠文件夹命名区分，实验数据塞在表格中，LaTeX 源文件在多个编辑器间来回粘贴，投稿后邮件淹没在收件箱——每一步都不难，却每一步都在消耗专注力。工具没有错，只是它们彼此隔离，让人成了工具之间的搬运工。

PaperPilot 试图把论文的完整生命周期收拢到同一个桌面：**选题、代码版本、实验记录、LaTeX 撰写、投稿追踪、数据导出**，各环节既独立成章又彼此关联。它不替代你的思考，只是让过程更顺滑——让研究者把时间还给真正重要的事。

## 核心功能

| 模块 | 说明 |
| --- | --- |
| **项目管理** | 创建、编辑、归档论文项目；卡片式首页与标签化组织 |
| **进度图谱** | 可视化进度节点（选题→编码→实验→撰写→待投稿→已投稿），支持拒稿转投旁生分支 |
| **代码版本管理** | 记录每次代码快照，自动生成 diff 与 AI 摘要，按版本对比回溯 |
| **实验记录** | 结构化登记实验参数、数据集、指标与笔记，支持表格与键值编辑 |
| **LaTeX 撰写** | 内置 CodeMirror 编辑器，多文件工程管理，支持 tectonic / pdflatex / xelatex / lualatex 编译，版本记录与 PDF 预览 |
| **投稿追踪** | IMAP 邮件自动抓取，按论文标题过滤相关邮件，AI 生成审稿意见摘要 |
| **数据导出** | 一键导出项目全量数据，便于备份与迁移 |
| **设置中心** | LLM、邮件、Git、LaTeX 引擎与存储、外观等配置一体化管理 |

## 技术栈

- **运行时**：Electron 33 + Vite 6 + React 19 + TypeScript 5.7
- **UI**：[@lobehub/ui](https://github.com/lobeHub/lobe-ui) + Ant Design 6 + lucide-react
- **动画**：[motion](https://github.com/motiondivision/motion)（spring 物理动画）
- **数据库**：better-sqlite3（本地优先，数据不出设备）
- **AI**：LangChain + OpenAI 兼容接口（默认 DeepSeek）
- **邮件**：imapflow + mailparser
- **图表**：@xyflow/react（进度节点图）
- **编辑器**：CodeMirror 5（LaTeX 语法高亮）
- **状态**：Zustand + React Router 7

## 项目结构

```
PaperPilot_3/
├── electron/              # Electron 主进程
│   ├── index.ts           # 主进程入口
│   ├── preload.ts         # 预加载脚本（IPC 桥）
│   └── ipc/               # IPC 处理器（db/email/git/latex/llm/window）
├── src/                   # 渲染进程（React）
│   ├── components/        # 布局与共享组件
│   ├── modules/           # 功能模块（按领域划分）
│   │   ├── project-list/  # 首页项目列表
│   │   ├── dashboard/     # 项目详情与进度图谱
│   │   ├── code-manager/  # 代码版本管理
│   │   ├── experiment-manager/  # 实验记录
│   │   ├── latex-editor/  # LaTeX 编辑器
│   │   ├── submission-manager/ # 投稿与邮件追踪
│   │   ├── data-export/   # 数据导出
│   │   ├── settings/      # 设置中心
│   │   ├── archive/       # 归档
│   │   └── about/         # 关于
│   ├── stores/            # Zustand 状态
│   ├── lib/               # 工具与配置
│   └── assets/            # 静态资源
├── database/              # 数据库 schema 与访问层
├── shared/                # 主进程/渲染进程共享类型
├── scripts/               # 构建、图标、种子数据脚本
├── resources/             # 应用图标
└── electron-builder.json  # 打包配置
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9
- Windows / macOS / Linux

### 安装依赖

```bash
npm install
```

> 安装时会自动执行 `electron-builder install-app-deps` 以编译原生模块（better-sqlite3 等）。

### 开发模式

```bash
npm run dev
```

启动后，开发模式下 LLM 配置会以空 API Key 初始化。如需预填 DeepSeek Key，可设置环境变量：

**PowerShell**
```powershell
$env:DEEPSEEK_API_KEY = "your-key-here"; npm run dev
```

**bash / zsh**
```bash
DEEPSEEK_API_KEY=your-key-here npm run dev
```

> 生产环境下，API Key 永不会被打包进应用，用户需在「设置 → LLM 配置」中手动填写。

### 示例数据

如需填充演示数据以体验完整工作流：

```bash
npm run seed:demo
```

该脚本会写入 5 个虚构项目（覆盖已录用、拒稿转投、待返修、实验中、选题中等阶段）及对应的代码版本、实验记录、邮件与 LaTeX 工程文件。

### 构建与打包

```bash
# 编译主进程 + 渲染进程
npm run build

# 打包安装包（按平台选择）
npm run dist:win     # Windows x64 + arm64
npm run dist:mac     # macOS x64 + arm64
npm run dist:linux   # Linux x64 + arm64
```

## LaTeX 编译说明

PaperPilot 支持四种 LaTeX 引擎：

| 引擎 | 类型 | 说明 |
| --- | --- | --- |
| **tectonic** | 内置 | 默认引擎，自带无需额外安装（首次使用自动下载） |
| **pdflatex** | 系统 | 需本地安装 TeX 发行版（如 TeX Live / MiKTeX） |
| **xelatex** | 系统 | 支持中文，需本地安装 TeX 发行版 |
| **lualatex** | 系统 | 需本地安装 TeX 发行版 |

系统引擎会执行 3 次编译以处理交叉引用，输出至 `.build/` 子目录。引擎切换在「设置 → LaTeX 引擎」中完成。

## 数据与隐私

- 所有数据存储在本地 SQLite 数据库，**不向任何服务器上传**。
- 邮件通过 IMAP 直接从你的邮箱服务器拉取，凭据仅保存在本地数据库。
- LLM 调用直接从你的设备发起，仅与配置的 LLM 服务商通信。

## 开发文档

- [DECISIONS.md](./DECISIONS.md) — 架构决策记录（ADR）

## 贡献

欢迎提交 Issue 与 Pull Request。目前处于 alpha 阶段，部分接口可能调整。

## 许可证

[MIT License](./LICENSE) © 2026 ZhanYiHui06
