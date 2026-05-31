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
import { getLocalAiAuditLogs } from "../backend/ai";
import { getProviderAdapter } from "./aiGateway";
import { runDeterministicAiQuery, type AiToolResult, type AiToolName } from "./aiTools";
import { buildAiAgentEvents, type AiAgentEvent } from "./agentEvents";
import { buildSkillPrompt, qfDcimAgentRole } from "./agentProfile";
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

export interface QfAgentRequest {
  question: string;
  configs: AiModelConfig[];
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  virtualServers?: VirtualServer[];
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
  ].join("\n");
}

function isPlatformQuestion(question: string, rooms: Room[], racks: Rack[]) {
  const normalized = question.toLowerCase();
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(question)) return true;
  if (/机房|机柜|服务器|设备|资产|告警|报警|异常|故障|责任人|用途|业务ip|带外ip|u位|位置|在哪|计算机名|固定资产|编号|sn|SN|序列号|维保|硬件配置|操作系统|负责人|负责|查询|查下|查看|看下|搜索|虚拟机|虚拟服务器|云主机|宿主|审计|操作记录|历史记录|导入记录|查询记录|接口|端口|接线|容量|巡检|维修建议/.test(question)) {
    return true;
  }
  if (rooms.some((room) => normalized.includes(room.name.toLowerCase()))) return true;
  if (racks.some((rack) => normalized.includes(rack.name.toLowerCase()))) return true;
  return false;
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
    { role: "system", content: qfDcimAgentRole },
    { role: "system", content: buildSkillPrompt() },
    { role: "system", content: formatCustomAgentSkillPrompt() },
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
  const auditLogs = request.auditLogs ?? getLocalAiAuditLogs();

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
        { role: "system", content: qfDcimAgentRole },
        { role: "system", content: buildSkillPrompt() },
        { role: "system", content: formatCustomAgentSkillPrompt() },
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
      return {
        toolName: "general_chat",
        answer: fallbackAnswer,
        fallbackReason,
        plan,
        events: buildAiAgentEvents({
          question: request.question,
          toolName: "general_chat",
          answer: fallbackAnswer,
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
      { role: "system", content: qfDcimAgentRole },
      { role: "system", content: buildSkillPrompt() },
      { role: "system", content: formatCustomAgentSkillPrompt() },
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
