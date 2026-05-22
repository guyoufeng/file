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
pnpm test:smoke
cargo build --manifest-path src-tauri/Cargo.toml
```

每个功能至少要有一个明确验证方式，例如单元测试、类型检查、页面冒烟测试或手工冒烟检查。

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
