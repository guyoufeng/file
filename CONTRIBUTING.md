# Contributing

感谢参与泉峰AI数据中心管理平台开发。

## 开发环境

推荐环境：

- Windows 11
- Node.js
- pnpm
- Rust
- Tauri CLI
- Visual Studio Build Tools

安装依赖：

```powershell
pnpm install
```

启动开发：

```powershell
pnpm dev
pnpm tauri dev
```

## 分支与提交

- 不直接在 `master` 上开发功能。
- 功能分支建议使用 `feat/<topic>`。
- 每个功能完成后至少执行对应冒烟测试。
- 测试通过后再提交 Git。

提交信息示例：

```text
feat: add rack layout overview
fix: correct u position validation
docs: update ai model configuration guide
test: add smoke tests for rack overview
```

## 代码风格

- 默认使用中文沟通和文档说明。
- 遵守 `AGENTS.md` 中的项目规则。
- 不添加没要求的功能。
- 不做无关重构。
- UI 遵循暗色专业运维控制台风格。

## 测试要求

常用检查：

```powershell
pnpm typecheck
pnpm test
pnpm vitest run
pnpm playwright test
pnpm test:smoke
cargo build --manifest-path src-tauri/Cargo.toml
```

每个功能至少要有一个明确验证方式，例如单元测试、类型检查、页面冒烟测试或手工冒烟检查。

## 冒烟测试

端到端冒烟测试位于 `tests/smoke`。

```powershell
pnpm playwright test
```

该命令会自动启动 Vite 服务并检查核心页面流程。新增用户可见功能时，优先补充对应冒烟测试，尤其是：

- 导航入口
- 机柜总览和搜索定位
- 资产管理
- AI 助手
- 告警、报表、系统设置

## 开发流程建议

1. 先确认需求边界，避免把后续版本能力塞进 v0.1。
2. 涉及逻辑时先写单元测试，涉及页面关键流程时补冒烟测试。
3. 开发完成后至少运行 `pnpm vitest run`、`pnpm build` 和相关冒烟测试。
4. 涉及 Rust/Tauri 命令时运行 `cargo build --manifest-path src-tauri/Cargo.toml`。
5. 提交前检查 `git status --short`，只提交本次任务相关文件。

## Issue / PR 规范

Issue 建议包含：

- 背景
- 期望行为
- 实际行为
- 复现步骤
- 截图或日志

PR 建议包含：

- 修改摘要
- 验证方式
- 影响范围
- 是否涉及数据模型或导入导出格式
