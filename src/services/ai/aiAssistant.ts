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
import { runDeterministicAiQuery, type AiToolResult } from "./aiTools";
import { buildSkillPrompt, qfDcimAgentRole } from "./agentProfile";
import {
  buildCapabilityPrompt,
  getAiAgentCapabilitySettings,
  type AiAgentCapabilitySettings,
} from "./agentCapabilities";

export interface AiAssistantRequest {
  question: string;
  configs: AiModelConfig[];
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  virtualServers?: VirtualServer[];
  auditLogs?: AuditLog[];
  capabilities?: AiAgentCapabilitySettings;
}

export interface AiAssistantAnswer extends AiToolResult {
  usedModel?: string;
  fallbackReason?: string;
}

function getEnabledConfig(configs: AiModelConfig[]) {
  return configs.find((config) => config.enabled) ?? configs[0];
}

function buildUserPrompt(question: string, toolResult: AiToolResult) {
  return [
    `用户问题：${question}`,
    "",
    "工具查询结果：",
    toolResult.answer,
    "",
    "请基于工具查询结果，用专业运维口吻回答。不要添加工具结果中不存在的事实。",
  ].join("\n");
}

function isDcimQuestion(question: string, rooms: Room[], racks: Rack[]) {
  const normalized = question.toLowerCase();
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(question)) return true;
  if (/机房|机柜|服务器|设备|资产|告警|报警|异常|故障|责任人|用途|业务ip|带外ip|u位|位置|在哪|计算机名|固定资产|编号|sn|SN|序列号|维保|硬件配置|操作系统|负责人|负责|查询|查下|查看|看下|搜索|虚拟机|虚拟服务器|云主机|宿主|审计|操作记录|历史记录|导入记录|查询记录/.test(question)) {
    return true;
  }
  if (rooms.some((room) => normalized.includes(room.name.toLowerCase()))) return true;
  if (racks.some((rack) => normalized.includes(rack.name.toLowerCase()))) return true;
  return false;
}

function buildGeneralPrompt(question: string, capabilities: AiAgentCapabilitySettings) {
  return [
    `用户问题：${question}`,
    "",
    "请以泉峰AI数据中心管理平台助手的身份回答。",
    buildCapabilityPrompt(capabilities),
    "如果问题涉及平台能力，可以说明你能查询资产位置、机柜设备、告警状态、审计记录和后续报表建议。",
    "不要编造平台资产、IP、责任人、告警和配置。",
  ].join("\n");
}

export async function answerWithAiAssistant(
  request: AiAssistantRequest,
): Promise<AiAssistantAnswer> {
  const config = getEnabledConfig(request.configs);
  const capabilities = request.capabilities ?? getAiAgentCapabilitySettings();
  const dcimQuestion = isDcimQuestion(request.question, request.rooms, request.racks);

  if (!dcimQuestion) {
    const generalResult: AiToolResult = {
      toolName: "general_chat",
      answer:
        "当前可以回答平台使用、运维思路和通用问题。实时天气、新闻、联网搜索需要后续启用外网辅助 Skill。",
    };

    if (!config) {
      return {
        ...generalResult,
        fallbackReason: "未配置启用模型",
      };
    }

    try {
      const answer = await getProviderAdapter(config).chat(config, [
        {
          role: "system",
          content: qfDcimAgentRole,
        },
        {
          role: "system",
          content: buildSkillPrompt(),
        },
        {
          role: "system",
          content: buildCapabilityPrompt(capabilities),
        },
        {
          role: "user",
          content: buildGeneralPrompt(request.question, capabilities),
        },
      ]);

      return {
        ...generalResult,
        answer: answer.trim() || generalResult.answer,
        usedModel: config.model,
      };
    } catch (error) {
      return {
        ...generalResult,
        fallbackReason: error instanceof Error ? error.message : "模型调用失败",
      };
    }
  }

  const toolResult = runDeterministicAiQuery(
    request.question,
    request.rooms,
    request.racks,
    request.devices,
    request.alerts,
    request.virtualServers ?? loadVirtualServers(),
    request.auditLogs ?? getLocalAiAuditLogs(),
  );

  if (!config) {
    return {
      ...toolResult,
      fallbackReason: "未配置启用模型",
    };
  }

  try {
    const answer = await getProviderAdapter(config).chat(config, [
      {
        role: "system",
        content: qfDcimAgentRole,
      },
      {
        role: "system",
        content: buildSkillPrompt(),
      },
      {
        role: "system",
        content: buildCapabilityPrompt(capabilities),
      },
      {
        role: "user",
        content: buildUserPrompt(request.question, toolResult),
      },
    ]);

    return {
      ...toolResult,
      answer: answer.trim() || toolResult.answer,
      usedModel: config.model,
    };
  } catch (error) {
    return {
      ...toolResult,
      fallbackReason: error instanceof Error ? error.message : "模型调用失败",
    };
  }
}
