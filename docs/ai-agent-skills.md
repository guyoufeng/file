# 泉峰AI数据中心管理平台 AI Agent 与 Skill 设计

## Agent 角色

本地模型在平台中扮演“泉峰AI数据中心管理平台的本地智能运维助手”。

核心原则：

- 只基于平台工具返回的资产、机柜、机房、告警、审计数据回答。
- 可以解释、总结、排序和给出巡检建议，但不能编造资产位置、IP、责任人、告警和配置。
- 第一版只读，不执行新增、修改、删除或外部系统操作。
- 回答要适合数据中心运维和值班场景，优先明确位置、影响、责任人和建议动作。

## 当前 Skill

### 资产定位

用途：根据 IP、计算机名、资产信息查询服务器位置和用途。

规则：

- 位置必须来自平台工具查询结果。
- 回答中优先包含机房、机柜、U 位、业务 IP、责任人。

### 机柜盘点

用途：按机柜或机房汇总设备清单、用途、责任人和容量信息。

规则：

- 清单类回答保留关键字段。
- 设备过多时先总结重点，再提示可继续追问。

### 告警分析

用途：查询活动告警、单设备告警详情和机柜告警排行。

规则：

- 区分严重、警告、提示级别。
- 建议优先处理严重告警和告警集中的机柜。

## 后续扩展方向

### 卓豪监控 Skill

用途：让 AI 学会通过卓豪 API 查询主机状态、硬件告警、事件历史和可用性。

建议工具：

- `zoho_list_hosts`
- `zoho_get_host_health`
- `zoho_list_alerts`
- `zoho_get_event_history`

### Prometheus Skill

用途：让 AI 查询 CPU、内存、磁盘、网络、温度、在线状态等指标。

建议工具：

- `prom_query_instant`
- `prom_query_range`
- `prom_get_host_metrics`
- `prom_detect_abnormal_metrics`

### 变更与审计 Skill

用途：让 AI 关联资产变更、AI 查询记录、未来 AI 修改记录和告警变化。

建议工具：

- `audit_search_logs`
- `change_list_device_records`
- `change_compare_before_after`

## 实现位置

- Agent 角色与当前 Skill：`src/services/ai/agentProfile.ts`
- 工具查询：`src/services/ai/aiTools.ts`
- 模型编排：`src/services/ai/aiAssistant.ts`
- 只读 Agent API 工具清单：`src/services/agent/apiManifest.ts`
- 只读 Agent API 客户端：`src/services/agent/apiClient.ts`
- Agent 执行轨迹：`src/services/ai/agentEvents.ts`

后续新增 Skill 时，优先新增“工具函数 + Skill 说明 + 测试”，不要让模型直接访问外部系统或直接生成事实答案。

## 只读 Agent API 接入

第一版外部 Agent 只允许读取平台数据，不允许写入、删除或修改设备信息。平台提供 OpenAPI 描述和工具清单，外部 Agent 应先读取工具清单，再按查询目标选择接口。

基础地址：

```text
http://<平台地址>/api/agent/v1
```

常用入口：

```text
GET /api/agent/v1/health
GET /api/agent/v1/tools
GET /api/agent/v1/openapi.json
GET /api/agent/v1/devices?q=cnsmffluxdb1
GET /api/agent/v1/alerts?status=unconfirmed
GET /api/agent/v1/audit-logs?q=AI助手
```

如果系统设置中启用了只读访问令牌，外部 Agent 必须携带 Bearer Token：

```bash
curl -H "Authorization: Bearer <readonly-token>" "http://127.0.0.1:5200/api/agent/v1/devices?q=cnsmffluxdb1"
```

权限约束：

- 令牌只用于只读查询。
- OpenAPI 中声明 `readonlyAgentToken` 安全方案。
- 禁止通过只读 API 新增、修改、删除平台数据。
- 外部 Agent 的查询和平台内部 AI 助手查询都应进入审计日志。

## 可追溯 Agent 轨迹

平台内部 AI 助手按“小型 Agent”方式执行一次查询，保留可公开追溯的步骤：

1. Agent 启动
2. 接收问题
3. 权限校验，只读模式下禁止写操作
4. 工具选择
5. 工具调用开始
6. 工具调用完成
7. 模型基于工具结果总结
8. 写入审计
9. 本轮结束

轨迹记录的是“实际做了什么、调用了哪个工具、数据来自哪里、结果摘要是什么”。不要保存或展示模型内部不可验证的隐藏思维原文。

## Pi Agent 融合方案

Pi Agent 的核心价值不是某个界面，而是运行机制：Agent Loop、工具协议、事件流、会话、Skill、队列和可观测性。泉峰平台采用其中适合 DCIM 场景的部分，形成平台内置 Agent Runtime。

### 15 步实施路线

1. 研读 Pi Agent 核心循环、工具协议、事件、会话和审计思路。
2. 抽象泉峰平台 Agent 边界：只读、工具事实、模型总结、全程审计。
3. 定义平台 Agent 工具协议和工具注册表。
4. 实现平台只读工具执行器，复用现有资产、告警、审计、虚拟服务器查询。
5. 实现工具选择器：模型优先，规则兜底。
6. 实现小型 Agent Loop：接收问题、校验、选工具、执行、总结、审计。
7. 升级 Agent 事件流，记录每一步可追溯执行事实。
8. 将 AI 助手切到 Agent Loop，不再散落调用工具。
9. 补充 Agent 审计日志元数据和查询可见性。
10. 系统设置展示 Agent 能力、API Token、外部调用示例。
11. 补单元测试覆盖 Agent 工具选择、执行、失败回退。
12. 补浏览器冒烟测试覆盖 Agent 查询和设置页。
13. 更新文档，写清 Pi 风格融合方案。
14. 运行全量验证并修复发现的问题。
15. 提交代码并整理后续开发建议。

### 当前已落地的 Agent Runtime

实现位置：

- 工具注册表：`src/services/ai/agentToolRegistry.ts`
- Agent Runtime：`src/services/ai/agentRuntime.ts`
- 事件轨迹：`src/services/ai/agentEvents.ts`
- 工具审计：`src/services/ai/agentAudit.ts`
- AI 助手接入：`src/features/ai-assistant/components/AiChatPanel.vue`

一次查询的运行过程：

```text
用户问题
  ↓
Agent Runtime
  ↓
权限校验：只读模式
  ↓
模型工具选择：只输出工具 JSON
  ↓
平台工具执行：从真实资产、机柜、告警、审计数据查询
  ↓
模型总结：只能基于工具结果回答
  ↓
审计记录：问题、工具、计划来源、数据源、结果摘要、事件数量
  ↓
界面展示：回答、定位按钮、Agent 轨迹
```

### 当前工具

- `locate_device`：定位设备所在机房、机柜和 U 位。
- `search_devices`：查询资产详情、责任人、用途、业务 IP、带外 IP、硬件配置。
- `list_rack_devices`：查询机柜设备清单。
- `list_room_devices`：查询机房设备概览。
- `list_alert_devices`：查询告警、故障和处理状态。
- `search_virtual_servers`：查询虚拟服务器和宿主关系。
- `search_audit_logs`：查询审计日志和历史操作。
- `summarize_room_status`：汇总平台运行概览。

### 与 Pi Agent 的对应关系

```text
Pi Agent Tool            → 泉峰平台 Agent 工具注册表
Pi Agent Loop            → runQfAiAgent()
Pi Agent EventStream     → AiAgentEvent[]
Pi Harness Skill         → qfDcimSkills + 后续监控/CMDB/MCP Skill
Pi Observability Trace   → Agent 轨迹 + AI 工具审计日志
Pi Session               → AI 助手本地会话
Pi beforeToolCall Hook   → 只读权限校验
Pi afterToolCall Hook    → 工具审计与结果摘要
```

### 后续增强

- 多轮工具调用：一个问题可以先查设备，再查告警，再查审计记录。
- 工具流式更新：执行长耗时查询时实时显示阶段结果。
- Skill 文件化：将卓豪、Prometheus、CMDB、ZStack MCP 的调用规范沉淀为可维护 Skill。
- Agent 记忆：保留最近查询上下文，但敏感字段需要脱敏。
- 外部 Agent 写入模式：未来单独加权限、审批、回滚和详细审计后再开放。
