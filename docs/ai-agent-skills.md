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

后续新增 Skill 时，优先新增“工具函数 + Skill 说明 + 测试”，不要让模型直接访问外部系统或直接生成事实答案。
