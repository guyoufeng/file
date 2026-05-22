# 泉峰AI数据中心管理平台

泉峰AI数据中心管理平台是一个本地优先、开源、可扩展的 AI 数据中心机柜资产与运维管理平台。

v0.1 的重点是先交付一个可运行、可演示、可日常使用的基础版本：专业 2D 机柜图、设备资产管理、Excel 导入、AI 查询、基础告警、审计日志、数据备份，以及轻量 3D 展示。

## v0.1 核心范围

- 多数据中心/机房管理：529数据中心、99数据中心、308数据中心、杭州数据中心、越南C7数据中心。
- 2D 机柜图：布局总览、U位大图、搜索定位、状态高亮。
- 资产管理：设备列表、新增、编辑、删除确认、详情查看。
- Excel 导入：固定模板、导入预览、错误/警告校验、重复设备跳过。
- AI 助手：只读查询设备位置、用途、责任人、机柜设备清单和告警状态。
- AI 审计：记录 AI 查询历史，支持后续外部 Agent 和 AI 修改审计扩展。
- 告警中心：手动/模拟告警、筛选、定位设备、机柜图高亮。
- 报表中心：设备、机柜、状态、告警、维保和容量基础统计。
- 数据管理：SQLite 本地保存、JSON 项目导入导出、备份和示例数据恢复。
- 3D 轻量视图：机柜阵列、编号、告警高亮、点击机柜查看详情。

## 技术栈

- 桌面端：Tauri 2
- 前端：Vue 3 + TypeScript + Vite
- 路由：Vue Router
- 状态管理：Pinia
- UI：Naive UI
- 2D 机柜图：Konva.js
- 3D 展示：Three.js
- 数据库：SQLite
- Rust 数据库层：sqlx
- Excel：SheetJS
- AI：AI Gateway + Provider Adapter，优先支持 OpenAI Compatible API

## 快速开始

开发环境准备：

```powershell
pnpm install
pnpm dev
pnpm tauri dev
```

常用检查：

```powershell
pnpm typecheck
pnpm test
pnpm test:smoke
cargo build --manifest-path src-tauri/Cargo.toml
```

## AI 模型配置

v0.1 支持多个模型配置，但同一时间只启用一个默认模型。优先支持公司 GPUStack 上的 `qwen3.6-35b`，同时预留 DeepSeek、Gemini、Ollama、vLLM、OpenAI Compatible 等供应商适配器。

外部模型可能接触内网资产信息。生产使用时应优先使用公司内网模型，或开启脱敏策略。

## Excel 导入模板

v0.1 采用固定 Excel 模板：

- `机柜清单`
- `设备清单`

设备清单使用 `设备大类 + 设备子类型`。为了兼容早期模板，导入器可以识别旧字段 `设备类型`，但系统内部会拆分为大类和子类型。

## 开源协议

本项目采用 Apache License 2.0。
