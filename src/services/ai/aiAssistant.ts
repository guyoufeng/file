import type {
  Alert,
  AiModelConfig,
  Device,
  Rack,
  Room,
} from "../../types/domain";
import { getProviderAdapter } from "./aiGateway";
import { runDeterministicAiQuery, type AiToolResult } from "./aiTools";
import { buildSkillPrompt, qfDcimAgentRole } from "./agentProfile";

export interface AiAssistantRequest {
  question: string;
  configs: AiModelConfig[];
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
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

export async function answerWithAiAssistant(
  request: AiAssistantRequest,
): Promise<AiAssistantAnswer> {
  const toolResult = runDeterministicAiQuery(
    request.question,
    request.rooms,
    request.racks,
    request.devices,
    request.alerts,
  );
  const config = getEnabledConfig(request.configs);

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
