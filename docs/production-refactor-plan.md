# 泉峰AI数据中心运维平台产品化重构方案

## 分析结论

当前项目已经实现 v0.1 核心能力：机柜总览、U 位大图、3D 轻量视图、资产管理、虚拟服务器、进出管理、变更管理、连线管理、告警中心、报表、系统设置、AI 助手、Agent API、SQLite 本地数据源、Tauri/Rust 基础后端和 Hermes-compatible 消息网关入口。

主要技术栈：

- 前端：Vue 3、TypeScript、Vite、Pinia、Naive UI、Three.js、Konva/Pixi 风格 Canvas 视图。
- 后端：Tauri 2、Rust、SQLite、SQLx migrations。
- 开发服务：Vite middleware + Node `node:sqlite` 本地 HTTP API。
- AI：OpenAI-compatible 模型调用、Agent 工具、审计、写入草稿、审批接口。
- 外部网关：Hermes Agent 源码已下载，平台侧提供 `/api/agent/v1/gateway/{provider}` 回调。

重要假设：

- “机房”指数据中心房间或微模块整体。
- “资产”默认指物理资产，虚拟服务器单独管理。
- “Agent 写入”必须保留人工确认或管理员权限边界。
- “Hermes 消息网关”作为独立进程运行，平台只管理配置、回调、审计和会话。

## 当前核心架构问题

1. 页面组件过大  
   `AiChatPanel.vue` 1348 行、`AiAgentSettings.vue` 1279 行、`RackOverviewPage.vue` 1013 行，组件同时承担 UI、业务逻辑、API 调用、状态转换和异常处理。

2. 数据源处于过渡态  
   已有 SQLite/Tauri、本地 HTTP SQLite、浏览器缓存三套路径。短期可用，但权威数据源和同步策略还不够清晰。

3. Vite middleware 承担后端职责过多  
   `vite.config.ts` 同时包含代理、Agent API、权限、审计、Webhook、模型代理，开发服务逻辑和生产后端逻辑混在一起。

4. 错误处理不统一  
   许多模块使用 `try/catch` 静默降级，用户反馈、审计、日志没有统一规范。

5. 配置散落  
   AI 模型、Agent API Key、Webhook、Hermes Gateway、主题、表格列偏好分别存储，缺少统一配置仓库和敏感字段策略。

6. 插件/适配器接口不够产品化  
   已有监控、Agent、Gateway 的概念，但缺少稳定的 `AdapterRegistry`、生命周期和健康检查接口。

7. 测试覆盖多但缺少分层测试矩阵  
   单测和 smoke 已经较多，但需要补 repository/service/controller 分层测试，避免重构时依赖端到端测试兜底。

## 一、目标架构设计

目标采用“前端 Feature Shell + 应用服务层 + 后端 Controller-Service-Repository + Adapter Registry”的结构。

数据流：

```text
Vue Page/Component
  -> Feature Composable / Store
  -> Application Service
  -> API Client / Tauri Command Client
  -> Rust Controller
  -> Domain Service
  -> Repository
  -> SQLite
```

Agent 和外部系统：

```text
AI Assistant / External Agent / Hermes Gateway
  -> Agent Controller
  -> Permission Middleware
  -> Approval Service
  -> Domain Tool Service
  -> Repository
  -> Audit Log
```

推荐目录结构：

```text
src/
  app/
    layout/
    router/
    providers/
    error/
    logging/
  shared/
    ui/
    table/
    http/
    config/
    validation/
  domain/
    rack/
    asset/
    alert/
    access/
    change/
    connection/
    agent/
    gateway/
  application/
    rack/
    asset/
    alert/
    agent/
  infrastructure/
    api/
    tauri/
    persistence/
    gateway/
    monitoring/
  features/
    rack-overview/
    asset-management/
    alert-center/
src-tauri/
  src/
    controllers/
    services/
    repositories/
    middleware/
    adapters/
    db/
local-service/
  server/
  controllers/
  services/
  repositories/
```

依赖规则：

- `features` 只能依赖 `application`、`domain`、`shared`。
- `application` 只能依赖 `domain` 和抽象接口。
- `infrastructure` 实现接口，不被 `domain` 反向依赖。
- Rust 后端所有写入必须经过权限、审批、审计中间件。
- 开发 HTTP 服务只能复用同名 service/repository，不能复制业务规则。

## 二、核心重构准则

- 单一职责：页面只管组合 UI，业务规则放 service，数据读写放 repository。
- 依赖注入：服务构造时传入 repository、logger、permission checker，测试替换 fake。
- 统一错误处理：前端提供 `AppError`、`showErrorToast`；后端统一 `ApiError`。
- 全链路日志：每个请求生成 `traceId`，写入审计和后端日志。
- 配置外部化：`.env`、`config.yaml`、SQLite settings 分层；敏感字段只存密钥引用。
- 类型安全：所有 API DTO 明确类型，禁止页面直接拼后端 payload。
- 测试健壮性：每个 domain service 至少单测，controller 使用契约测试。
- 扩展插件化：监控、Gateway、AI Tool、导出都通过 registry 注册。

## 三、核心接口定义和代码骨架

统一错误：

```ts
export type AppErrorCode =
  | "permission_denied"
  | "validation_failed"
  | "backend_unavailable"
  | "external_adapter_failed";

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}
```

Repository：

```ts
export interface Repository<TRecord, TQuery = unknown> {
  list(query?: TQuery): Promise<TRecord[]>;
  get(id: string): Promise<TRecord | undefined>;
  save(record: TRecord): Promise<TRecord>;
  remove(id: string): Promise<void>;
}
```

Agent 写入审批：

```ts
export interface AgentWriteApprovalService {
  create(input: {
    actor: string;
    module: string;
    action: string;
    summary: string;
    payload: unknown;
  }): Promise<{ id: string; status: "pending" }>;

  decide(input: {
    id: string;
    decisionBy: string;
    status: "approved" | "rejected" | "applied";
    note?: string;
  }): Promise<void>;
}
```

消息网关：

```ts
export interface MessageGatewayAdapter {
  provider: "wechat" | "wecom" | "dingtalk";
  getHealth(): Promise<{ state: "connected" | "disconnected" | "error"; message?: string }>;
  createPairingSession(): Promise<{ qrPayload: string; expiresAt: string }>;
  handleInbound(payload: unknown): Promise<{ sessionId: string; messageId: string }>;
}
```

后端权限中间件：

```rust
pub struct RequestContext {
    pub actor: String,
    pub scopes: Vec<String>,
    pub trace_id: String,
}

pub trait PermissionChecker {
    fn require(&self, ctx: &RequestContext, scope: &str) -> Result<(), ApiError>;
}
```

## 四、目录对照表

| 当前目录/文件 | 问题 | 重构后位置 |
|---|---|---|
| `src/features/ai-assistant/components/AiChatPanel.vue` | UI、Agent runtime、附件、写入草稿混在一起 | `features/ai-assistant/*` + `application/agent/*` |
| `src/features/settings/components/AiAgentSettings.vue` | 配置、网关、记忆、凭据、审计混在一起 | 拆成 `AgentRoleSettings`、`GatewaySettings`、`CredentialSettings` |
| `vite.config.ts` | 开发服务承载生产 API 逻辑 | `local-service/server/*` |
| `src/services/backend/data.ts` | 示例数据、导入导出、本地缓存混合 | `domain/sample-data` + `application/project` |
| `src-tauri/src/commands/assets.rs` | Controller 和 Repository 混合 | `controllers/assets.rs` + `repositories/device_repository.rs` |
| `src/services/persistence/unifiedPersistence.ts` | 同步缓存和后端 API 在一个文件 | `infrastructure/persistence/*` |

## 五、扩展点设计

- 监控适配器：Prometheus、卓豪、Zabbix、夜莺。
- 消息网关：Hermes Weixin、Hermes WeCom、Hermes DingTalk、Webhook。
- AI Tool：资产查询、告警分析、变更录入、进出记录录入、报表生成。
- 导出插件：Excel、PDF、Word、CMDB、厂商巡检模板。
- 权限策略：管理员、普通账号、只读账号、外部 Agent API Key。

## 六、分阶段实施路线图

### 阶段 1：稳定边界和风险止血

操作：

- 抽出表格列定义、分页、筛选、定位、状态映射等纯函数。
- 页面组件不再直接保存复杂偏好。
- 为 `AlertTable`、`AssetTable`、`ChangeManagementPage` 的列管理补契约测试。

验收：

- `pnpm test` 全绿。
- `pnpm run test:smoke` 全绿。
- 页面行为不变化。

### 阶段 2：拆分 AI Assistant

操作：

- `AiChatPanel.vue` 拆成 `ChatHeader`、`MessageList`、`Composer`、`TraceSummary`。
- Agent runtime 移到 `application/agent/agentConversationService.ts`。
- 附件解析、写入草稿、澄清框分别独立。

验收：

- AI 查询平台数据、通用问答、附件提示、定位设备、写入草稿行为一致。

### 阶段 3：统一后端 API 分层

操作：

- `vite.config.ts` 中 API 移到 `local-service/controllers`。
- Node local-service 和 Tauri Rust 共享 DTO 命名。
- 新增 `ApiClient` 统一错误处理和 traceId。

验收：

- `/api/local/v1/collections`、`/api/agent/v1/*` 行为不变。
- Tauri `cargo check` 通过。

### 阶段 4：Rust 后端 Repository 化

操作：

- `assets.rs` 拆成 controller/service/repository。
- 审计写入变成 middleware/service。
- 备份、迁移、审批统一错误类型。

验收：

- 项目导入导出、设备增删改、审计日志功能一致。

### 阶段 5：配置和安全产品化

操作：

- AI 模型、API Key、Gateway、Webhook、凭据统一进入配置服务。
- 敏感字段只存引用或加密值。
- GitHub/演示环境禁止提交 `.local`、密钥、Token。

验收：

- 导出备份默认不含密钥。
- 审计能看到配置变更，但不泄露密钥。

### 阶段 6：生产部署和可观测性

操作：

- 增加健康检查页、后端 trace、日志轮转。
- Hermes Gateway 独立部署脚本化。
- 增加发布 checklist 和回滚文档。

验收：

- 新机器按文档可启动平台、SQLite、Hermes Gateway。
- 出问题能通过日志和审计追踪。

## 七、立即执行优先级

1. 把已经超过 1000 行的组件拆掉。
2. 把 `vite.config.ts` 的 HTTP API 迁入 `local-service/server`。
3. 把 SQLite/Tauri/HTTP 三套数据访问统一成 repository 接口。
4. 给 Agent 写入和 Gateway 接入补权限、审计和审批端到端测试。
5. 做一次安全清理：确认没有密钥、账号密码进入 Git。
