import type {
  Alert,
  AiModelConfig,
  AuditLog,
  Device,
  Rack,
  Room,
} from "../../types/domain";
import {
  loadVirtualServers,
  type VirtualServer,
} from "../../features/virtual-server-management/virtualServers";
import {
  getAccessRecords,
  type AccessRecord,
} from "../../features/access-management/accessRecords";
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

export interface QfAgentRequest {
  question: string;
  configs: AiModelConfig[];
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  virtualServers?: VirtualServer[];
  accessRecords?: AccessRecord[];
  auditLogs?: AuditLog[];
  capabilities?: AiAgentCapabilitySettings;
  dataSource: string;
  memories?: string[];
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
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
  if (/机房|机柜|服务器|设备|资产|告警|报警|异常|故障|责任人|用途|业务ip|带外ip|u位|位置|在哪|计算机名|固定资产|编号|sn|SN|序列号|维保|硬件配置|操作系统|负责人|负责|查询|查下|查看|看下|搜索|虚拟机|虚拟服务器|云主机|宿主|审计|操作记录|历史记录|导入记录|查询记录|接口|端口|接线|容量|巡检|维修建议|进出|进入|离开|访客|维修记录|入场|出场/.test(question)) {
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

function buildModelFailureAnswer(config: AiModelConfig, reason: string) {
  return [
    `当前已选择模型 ${config.model}，但本次模型调用失败：${reason}`,
    "平台事实类问题仍可使用本地只读工具返回真实数据；通用问题需要模型服务可用后才能给出完整回答。",
    "请检查 AI 模型配置、GPUStack 服务地址、API Key、模型名称和网络连通性。",
  ].join("\n");
}

function formatAttachmentPrompt(attachments: QfAgentRequest["attachments"]) {
  if (!attachments || attachments.length === 0) return "附件：无。";
  return [
    "附件：",
    ...attachments.map(
      (item, index) =>
        `${index + 1}. ${item.name}（${item.type || "未知类型"}，${Math.ceil(item.size / 1024)} KB）`,
    ),
    "当前第一版只记录附件元数据，后续会接入文件解析和知识库检索。",
  ].join("\n");
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
  const auditLogs = request.auditLogs ?? getLocalAiAuditLogs();

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
      const answer = await getProviderAdapter(config).chat(config, [
        { role: "system", content: getAgentRoleDefinition() },
        { role: "system", content: buildSkillPrompt() },
        { role: "system", content: formatCustomAgentSkillPrompt() },
        { role: "system", content: formatCredentialCatalogForAgent() },
        { role: "system", content: formatAgentToolIntegrationPrompt() },
        { role: "system", content: buildCapabilityPrompt(capabilities) },
        { role: "system", content: formatAgentMemoryPrompt(request.memories) },
        { role: "user", content: buildGeneralAgentPrompt(request.question, capabilities, request.memories, request.attachments) },
      ]);
      return {
        toolName: "general_chat",
        answer: answer.trim() || fallbackAnswer,
        usedModel: config.model,
        plan,
        events: buildAiAgentEvents({
          question: request.question,
          toolName: "general_chat",
          answer: answer.trim() || fallbackAnswer,
          usedModel: config.model,
          dataSource: "当前模型",
        }),
      };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : "模型调用失败";
      const answer = buildModelFailureAnswer(config, fallbackReason);
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
    const answer = await getProviderAdapter(config).chat(config, [
      { role: "system", content: getAgentRoleDefinition() },
      { role: "system", content: buildSkillPrompt() },
      { role: "system", content: formatCustomAgentSkillPrompt() },
      { role: "system", content: formatCredentialCatalogForAgent() },
      { role: "system", content: formatAgentToolIntegrationPrompt() },
      { role: "system", content: buildCapabilityPrompt(capabilities) },
      { role: "user", content: buildSummaryPrompt(request.question, toolResult) },
    ]);

    return {
      ...toolResult,
      answer: answer.trim() || toolResult.answer,
      usedModel: config.model,
      fallbackReason: plannerFailure,
      plan,
      events: buildAiAgentEvents({
        question: request.question,
        toolName: toolResult.toolName,
        answer: answer.trim() || toolResult.answer,
        usedModel: config.model,
        fallbackReason: plannerFailure,
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
