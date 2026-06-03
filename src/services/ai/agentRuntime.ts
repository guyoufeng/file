import type {
  Alert,
  AiModelConfig,
  AuditLog,
  Device,
  Rack,
  Room,
} from "../../types/domain";
import type { AiMessageInput } from "../../types/ai";
import {
  loadVirtualServers,
  type VirtualServer,
} from "../../features/virtual-server-management/virtualServers";
import {
  getAccessRecords,
  type AccessRecord,
} from "../../features/access-management/accessRecords";
import {
  getChangeEvents,
  type ChangeEvent,
} from "../../features/change-management/changeEvents";
import {
  getConnectionRecords,
  type ManagedConnection,
} from "../../features/connection-manager/connections";
import { getLocalAiAuditLogs } from "../backend/ai";
import { getProviderAdapter } from "./aiGateway";
import { runDeterministicAiQuery, type AiToolResult, type AiToolName } from "./aiTools";
import { buildAiAgentEvents, type AiAgentEvent } from "./agentEvents";
import { buildSkillPrompt } from "./agentProfile";
import {
  buildCapabilityPrompt,
  getAiAgentCapabilitySettings,
  type AiAgentCapabilitySettings,
} from "./agentCapabilities";
import {
  formatQfAgentToolCatalog,
  isQfAgentToolName,
  qfAgentTools,
} from "./agentToolRegistry";
import { formatAgentMemoryPrompt } from "./agentMemory";
import { formatCustomAgentSkillPrompt } from "./agentCustomSkills";
import { getAgentRoleDefinition } from "./agentIdentity";
import { formatCredentialCatalogForAgent } from "./agentCredentials";
import { formatKnowledgePrompt } from "./agentKnowledgeBase";
import { formatAgentToolIntegrationPrompt } from "./agentToolIntegrations";
import {
  formatAttachmentsForAgentPrompt,
  type AgentAttachmentSummary,
} from "./agentAttachments";
import {
  executeWithAgentRetry,
  getAgentReliabilitySettings,
  shouldRequireHumanApproval,
} from "./agentReliability";

export interface QfAgentRequest {
  question: string;
  configs: AiModelConfig[];
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  virtualServers?: VirtualServer[];
  accessRecords?: AccessRecord[];
  changeEvents?: ChangeEvent[];
  connectionRecords?: ManagedConnection[];
  auditLogs?: AuditLog[];
  capabilities?: AiAgentCapabilitySettings;
  dataSource: string;
  memories?: string[];
  attachments?: AgentAttachmentSummary[];
}

export interface QfAgentPlan {
  toolName: AiToolName;
  reason: string;
  planner: "model" | "deterministic";
}

export interface QfAgentRunResult extends AiToolResult {
  usedModel?: string;
  fallbackReason?: string;
  plan: QfAgentPlan;
  events: AiAgentEvent[];
}

function getEnabledConfig(configs: AiModelConfig[]) {
  return configs.find((config) => config.enabled) ?? configs[0];
}

async function chatWithReliability(
  configs: AiModelConfig[],
  primaryConfig: AiModelConfig,
  messages: AiMessageInput[],
) {
  const settings = getAgentReliabilitySettings();
  const candidates = [
    primaryConfig,
    ...configs.filter((config) => config.id !== primaryConfig.id),
  ]
    .filter((config) => config.enabled || config.id === primaryConfig.id)
    .map((config) => ({
      label: config.model,
      run: async () => {
        const answer = await getProviderAdapter(config).chat(config, messages);
        if (!answer?.trim()) throw new Error("模型返回为空");
        return answer;
      },
    }));
  const result = await executeWithAgentRetry(candidates, settings);
  return {
    answer: result.value,
    usedModel: result.usedCandidate,
    retrySummary: result.attempts
      .filter((attempt) => attempt.status === "failed")
      .map((attempt) => `${attempt.candidate} 第${attempt.attempt}次失败：${attempt.message}`)
      .join("；"),
  };
}

function extractJsonObject(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("模型工具选择结果不是有效 JSON");
  return JSON.parse(match[0]) as unknown;
}

function buildPlannerPrompt(question: string) {
  return [
    "你是泉峰AI数据中心管理平台的小型 Agent 工具选择器。",
    "你只能选择一个只读工具，不能执行新增、修改、删除。",
    "可用工具：",
    formatQfAgentToolCatalog(),
    "",
    `用户问题：${question}`,
    "",
    "只输出 JSON，不要输出解释文字。格式：",
    '{"toolName":"search_devices","reason":"选择这个工具的可公开理由"}',
  ].join("\n");
}

function buildSummaryPrompt(question: string, toolResult: AiToolResult) {
  return [
    `用户问题：${question}`,
    "",
    `已执行工具：${toolResult.toolName}`,
    "工具查询结果：",
    toolResult.answer,
    "",
    "请基于工具结果用专业运维口吻回答。不能添加工具结果中不存在的资产、IP、责任人、位置或告警事实。",
    "",
    formatKnowledgePrompt(question),
  ].join("\n");
}

function isGeneralMaintenanceAdviceQuestion(question: string) {
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(question)) return false;
  if (/机柜|u位|位置|在哪|责任人|用途|资产编号|固定资产|sn|SN|序列号|带外ip|业务ip|计算机名/.test(question)) {
    return false;
  }
  return /怎么|如何|维修|维护|处理|排查|巡检|检查|关注|上架|注意什么|注意事项|阈值|多少|几度|温度|湿度|合适|推荐|参考|最佳|建议|方案|步骤|原因|原理|解释/.test(question);
}

function isPlatformQuestion(question: string, rooms: Room[], racks: Rack[]) {
  const normalized = question.toLowerCase();
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(question)) return true;
  if (isGeneralMaintenanceAdviceQuestion(question)) return false;
  if (/机房|机柜|服务器|设备|资产|告警|报警|异常|故障|责任人|用途|业务ip|带外ip|u位|位置|在哪|计算机名|固定资产|编号|sn|SN|序列号|维保|硬件配置|操作系统|负责人|负责|查询|查下|查看|看下|搜索|虚拟机|虚拟服务器|云主机|宿主|审计|操作记录|历史记录|导入记录|查询记录|接口|端口|接线|连线|交换机|线缆|变更|上架|下架|容量|巡检|维修建议|进出|进入|离开|访客|维修记录|入场|出场/.test(question)) {
    return true;
  }
  if (rooms.some((room) => normalized.includes(room.name.toLowerCase()))) return true;
  if (racks.some((rack) => normalized.includes(rack.name.toLowerCase()))) return true;
  return false;
}

function isModelIdentityQuestion(question: string) {
  return /哪个模型|什么模型|当前模型|使用的模型|用的模型|模型名称|大模型|qwen|deepseek|gemini|gpustack/i.test(
    question,
  );
}

function buildModelIdentityAnswer(config: AiModelConfig | undefined) {
  if (!config) return "当前没有启用 AI 模型配置，所以只能使用平台本地只读工具回答资产、机柜、告警等问题。";
  return [
    `当前启用模型：${config.model}`,
    `配置名称：${config.name}`,
    `供应商/协议：${config.provider}`,
    `Base URL：${config.baseUrl}`,
    "说明：平台事实类问题会先调用只读工具查询真实数据，通用运维问题会交给当前模型回答。",
  ].join("\n");
}

function buildModelFailureAnswer(config: AiModelConfig, question: string) {
  const normalized = question.toLowerCase();
  const advice = (() => {
    if (/温度|几度|多少度|湿度/.test(question)) {
      return [
        "机房温度建议优先控制在 22-26 摄氏度，常见可接受范围可参考 18-27 摄氏度。",
        "相对湿度建议保持在 40%-60% 左右，避免过低导致静电风险，过高导致凝露和腐蚀风险。",
        "实际值还要结合冷热通道、机柜进风口温度、设备厂商要求和动环监控告警阈值一起确认。",
      ];
    }
    if (/ecc|内存|dimm|memory/.test(normalized)) {
      return [
        "先确认告警来源、DIMM 槽位、错误计数和是否持续增长，保留 BMC/系统日志截图。",
        "如果是可纠正 ECC 偶发告警，建议观察趋势并安排巡检；如果频繁增长或出现不可纠正错误，应优先迁移业务并窗口期更换同规格内存。",
        "更换后复查硬件日志、系统日志和监控曲线，确认告警恢复并补录维修记录。",
      ];
    }
    if (/能.*做|帮忙|功能|事情/.test(question)) {
      return [
        "我可以帮助查询服务器位置、业务 IP、带外 IP、用途、责任人、机柜、告警、审计记录、虚拟服务器和进出维修记录。",
        "也可以围绕数据中心运维给出巡检、硬件故障排查、告警处理、变更记录整理和报告草稿建议。",
        "涉及平台真实数据时，我会优先调用只读工具查询，不编造资产、位置和告警事实。",
      ];
    }
    return [
      "数据中心日常维护建议先关注环境、供电、制冷、硬件健康、容量和变更记录六类事项。",
      "环境侧重点看温湿度、漏水、烟感和冷热通道；供电侧重点看 UPS、PDU、电流和冗余；硬件侧重点看磁盘、内存、风扇、电源和带外日志。",
      "处理问题时建议保留告警来源、时间线、影响范围、处理步骤和恢复验证结果，方便后续审计和 AI 复盘。",
    ];
  })();

  return [
    `当前已选择模型 ${config.model}，模型服务暂时不可用，我先按本地运维知识给出参考建议。`,
    ...advice,
    "平台资产、机柜、告警等事实类问题仍会继续使用本地只读工具返回真实数据。",
  ].join("\n");
}

function formatAttachmentPrompt(attachments: QfAgentRequest["attachments"]) {
  return formatAttachmentsForAgentPrompt(attachments);
}

function buildGeneralAgentPrompt(
  question: string,
  capabilities: AiAgentCapabilitySettings,
  memories?: string[],
  attachments?: QfAgentRequest["attachments"],
) {
  return [
    `用户问题：${question}`,
    "",
    "你是嵌入在泉峰AI数据中心管理平台内的智能运维 Agent。",
    "如果问题不需要查询平台事实数据，可以直接使用当前大模型能力回答。",
    "如果回答涉及平台资产、IP、责任人、机柜位置、告警等事实，必须说明需要调用平台工具，不能编造。",
    "回答要自然、专业，优先服务数据中心日常运维工作。",
    "",
    formatAgentMemoryPrompt(memories),
    "",
    formatKnowledgePrompt(question),
    "",
    formatCredentialCatalogForAgent(),
    "",
    formatAgentToolIntegrationPrompt(),
    "",
    formatAttachmentPrompt(attachments),
    "",
    buildCapabilityPrompt(capabilities),
  ].join("\n");
}

async function planWithModel(
  question: string,
  config: AiModelConfig | undefined,
  capabilities: AiAgentCapabilitySettings,
): Promise<QfAgentPlan | null> {
  if (!config) return null;

  const raw = await getProviderAdapter(config).chat(config, [
    { role: "system", content: getAgentRoleDefinition() },
    { role: "system", content: buildSkillPrompt() },
    { role: "system", content: formatCustomAgentSkillPrompt() },
    { role: "system", content: formatCredentialCatalogForAgent() },
    { role: "system", content: formatAgentToolIntegrationPrompt() },
    { role: "system", content: buildCapabilityPrompt(capabilities) },
    { role: "user", content: buildPlannerPrompt(question) },
  ]);
  const parsed = extractJsonObject(raw) as { toolName?: string; reason?: string };
  if (!parsed.toolName || !isQfAgentToolName(parsed.toolName)) {
    throw new Error("模型工具选择结果不是平台允许的只读工具");
  }
  return {
    toolName: parsed.toolName,
    reason: parsed.reason?.trim() || "模型选择了最匹配的只读工具。",
    planner: "model",
  };
}

function buildDeterministicPlan(toolResult: AiToolResult, reason?: string): QfAgentPlan {
  return {
    toolName: toolResult.toolName,
    reason: reason ?? "根据平台规则选择只读工具。",
    planner: "deterministic",
  };
}

export async function runQfAiAgent(request: QfAgentRequest): Promise<QfAgentRunResult> {
  const config = getEnabledConfig(request.configs);
  const capabilities = request.capabilities ?? getAiAgentCapabilitySettings();
  const virtualServers = request.virtualServers ?? loadVirtualServers();
  const accessRecords = request.accessRecords ?? getAccessRecords();
  const changeEvents = request.changeEvents ?? getChangeEvents();
  const connectionRecords = request.connectionRecords ?? getConnectionRecords();
  const auditLogs = request.auditLogs ?? getLocalAiAuditLogs();
  const reliabilitySettings = getAgentReliabilitySettings();

  if (reliabilitySettings.highRiskGuardEnabled && shouldRequireHumanApproval(request.question)) {
    const answer = [
      "这条指令涉及新增、修改、删除、下架、停机或敏感信息等高风险动作。",
      "当前 AI Agent 处于安全只读阶段，我可以先帮你查询影响范围、整理操作步骤和生成变更草稿，但不会直接执行高风险动作。",
      "后续开放写入能力时，会进入人工确认流程，并完整记录执行轨迹和证据链。",
    ].join("\n");
    const plan: QfAgentPlan = {
      toolName: "general_chat",
      reason: "AgentScope 风格高风险操作拦截，需要人工确认后才能执行。",
      planner: "deterministic",
    };
    return {
      toolName: "general_chat",
      answer,
      usedModel: config?.model,
      fallbackReason: "高风险操作已拦截",
      plan,
      events: buildAiAgentEvents({
        question: request.question,
        toolName: "general_chat",
        answer,
        usedModel: config?.model,
        fallbackReason: "高风险操作已拦截",
        dataSource: "Agent 安全策略",
      }),
    };
  }

  if (isModelIdentityQuestion(request.question)) {
    const answer = buildModelIdentityAnswer(config);
    const plan: QfAgentPlan = {
      toolName: "general_chat",
      reason: "用户询问当前 AI 模型配置，直接读取平台模型配置回答。",
      planner: "deterministic",
    };
    return {
      toolName: "general_chat",
      answer,
      usedModel: config?.model,
      fallbackReason: config ? undefined : "未配置启用模型",
      plan,
      events: buildAiAgentEvents({
        question: request.question,
        toolName: "general_chat",
        answer,
        usedModel: config?.model,
        fallbackReason: config ? undefined : "未配置启用模型",
        dataSource: "模型配置",
      }),
    };
  }

  if (!isPlatformQuestion(request.question, request.rooms, request.racks)) {
    const plan: QfAgentPlan = {
      toolName: "general_chat",
      reason: "用户问题不需要查询平台事实数据，直接交给当前模型回答。",
      planner: config ? "model" : "deterministic",
    };
    const fallbackAnswer =
      "我可以回答通用问题，也可以调用平台工具查询资产、机柜、告警、审计和虚拟服务器信息。当前未配置启用模型，所以通用回答能力受限。";

    if (!config) {
      return {
        toolName: "general_chat",
        answer: fallbackAnswer,
        fallbackReason: "未配置启用模型",
        plan,
        events: buildAiAgentEvents({
          question: request.question,
          toolName: "general_chat",
          answer: fallbackAnswer,
          fallbackReason: "未配置启用模型",
          dataSource: "当前模型",
        }),
      };
    }

    try {
      const modelResult = await chatWithReliability(request.configs, config, [
        { role: "system", content: getAgentRoleDefinition() },
        { role: "system", content: buildSkillPrompt() },
        { role: "system", content: formatCustomAgentSkillPrompt() },
        { role: "system", content: formatCredentialCatalogForAgent() },
        { role: "system", content: formatAgentToolIntegrationPrompt() },
        { role: "system", content: buildCapabilityPrompt(capabilities) },
        { role: "system", content: formatAgentMemoryPrompt(request.memories) },
        { role: "user", content: buildGeneralAgentPrompt(request.question, capabilities, request.memories, request.attachments) },
      ]);
      const answer = modelResult.answer;
      return {
        toolName: "general_chat",
        answer: answer.trim() || fallbackAnswer,
        usedModel: modelResult.usedModel,
        fallbackReason: modelResult.retrySummary || undefined,
        plan,
        events: buildAiAgentEvents({
          question: request.question,
          toolName: "general_chat",
          answer: answer.trim() || fallbackAnswer,
          usedModel: modelResult.usedModel,
          fallbackReason: modelResult.retrySummary || undefined,
          dataSource: "当前模型",
        }),
      };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : "模型调用失败";
      const answer = buildModelFailureAnswer(config, request.question);
      return {
        toolName: "general_chat",
        answer,
        fallbackReason,
        plan,
        events: buildAiAgentEvents({
          question: request.question,
          toolName: "general_chat",
          answer,
          fallbackReason,
          dataSource: "当前模型",
        }),
      };
    }
  }

  const toolResult = runDeterministicAiQuery(
    request.question,
    request.rooms,
    request.racks,
    request.devices,
    request.alerts,
    virtualServers,
    auditLogs,
    accessRecords,
    changeEvents,
    connectionRecords,
  );

  let plan = buildDeterministicPlan(toolResult);
  let plannerFailure: string | undefined;
  if (config) {
    try {
      const modelPlan = await planWithModel(request.question, config, capabilities);
      if (modelPlan) {
        plan = {
          ...modelPlan,
          toolName: toolResult.toolName,
          reason:
            modelPlan.toolName === toolResult.toolName
              ? modelPlan.reason
              : `${modelPlan.reason}；平台执行器校正为 ${toolResult.toolName}。`,
        };
      }
    } catch (error) {
      plannerFailure =
        error instanceof Error ? error.message : "模型工具选择失败，已回退规则工具";
      plan = buildDeterministicPlan(toolResult, plannerFailure);
    }
  }

  if (!config) {
    return {
      ...toolResult,
      plan,
      fallbackReason: "未配置启用模型",
      events: buildAiAgentEvents({
        question: request.question,
        toolName: toolResult.toolName,
        answer: toolResult.answer,
        fallbackReason: "未配置启用模型",
        dataSource: request.dataSource,
        relatedDeviceId: toolResult.relatedDeviceId,
        relatedRackId: toolResult.relatedRackId,
        relatedRoomId: toolResult.relatedRoomId,
      }),
    };
  }

  try {
    const modelResult = await chatWithReliability(request.configs, config, [
      { role: "system", content: getAgentRoleDefinition() },
      { role: "system", content: buildSkillPrompt() },
      { role: "system", content: formatCustomAgentSkillPrompt() },
      { role: "system", content: formatCredentialCatalogForAgent() },
      { role: "system", content: formatAgentToolIntegrationPrompt() },
      { role: "system", content: buildCapabilityPrompt(capabilities) },
      { role: "user", content: buildSummaryPrompt(request.question, toolResult) },
    ]);
    const answer = modelResult.answer;

    return {
      ...toolResult,
      answer: answer.trim() || toolResult.answer,
      usedModel: modelResult.usedModel,
      fallbackReason: plannerFailure || modelResult.retrySummary || undefined,
      plan,
      events: buildAiAgentEvents({
        question: request.question,
        toolName: toolResult.toolName,
        answer: answer.trim() || toolResult.answer,
        usedModel: modelResult.usedModel,
        fallbackReason: plannerFailure || modelResult.retrySummary || undefined,
        dataSource: request.dataSource,
        relatedDeviceId: toolResult.relatedDeviceId,
        relatedRackId: toolResult.relatedRackId,
        relatedRoomId: toolResult.relatedRoomId,
      }),
    };
  } catch (error) {
    const fallbackReason = error instanceof Error ? error.message : "模型调用失败";
    return {
      ...toolResult,
      plan,
      fallbackReason,
      events: buildAiAgentEvents({
        question: request.question,
        toolName: toolResult.toolName,
        answer: toolResult.answer,
        fallbackReason,
        dataSource: request.dataSource,
        relatedDeviceId: toolResult.relatedDeviceId,
        relatedRackId: toolResult.relatedRackId,
        relatedRoomId: toolResult.relatedRoomId,
      }),
    };
  }
}

export function listQfAgentToolNames(): AiToolName[] {
  return qfAgentTools.map((tool) => tool.name);
}
