import type { AgentReadonlyTool } from "../agent/apiManifest";
import { qfDcimSkills } from "./agentProfile";
import type { AiToolName } from "./aiTools";

export interface AiAssistantCommandAnswer {
  toolName: AiToolName;
  answer: string;
}

function normalizeCommand(input: string): string | null {
  const command = input.trim().toLowerCase();
  if (!command.startsWith("/")) return null;
  return command.split(/\s+/)[0];
}

function formatToolPath(tool: AgentReadonlyTool): string {
  return tool.url.replace(/^https?:\/\/[^/]+\/api\/agent\/v1/, "/api/agent/v1");
}

function formatTools(tools: AgentReadonlyTool[]): string {
  if (tools.length === 0) {
    return "当前没有读取到只读 Agent API 工具清单，请稍后重试或检查开发服务。";
  }

  const lines = tools.map((tool, index) => {
    const queryNames = Object.keys(tool.query ?? {});
    const queryText =
      queryNames.length > 0 ? `参数：${queryNames.join("、")}` : "参数：无";
    return `${index + 1}. ${tool.name}\n   ${tool.description}\n   ${tool.method} ${formatToolPath(tool)}\n   ${queryText}`;
  });

  return [
    "当前 AI 助手可调用的只读 Agent API 工具如下：",
    "",
    ...lines,
    "",
    "这些接口也是后续外部 AI Agent 访问平台的标准入口；第一版保持只读，不执行新增、修改和删除。",
  ].join("\n");
}

function formatSkills(): string {
  const lines = qfDcimSkills.map((skill, index) => {
    const rules = skill.rules.map((rule) => `   - ${rule}`).join("\n");
    return `${index + 1}. ${skill.name}\n   ${skill.description}\n${rules}`;
  });

  return [
    "当前内置运维 Skill：",
    "",
    ...lines,
    "",
    "后续接入 Prometheus、卓豪监控、CMDB、ZStack MCP 时，可以继续扩展新的 Skill。",
  ].join("\n");
}

function formatHelp(): string {
  return [
    "我是泉峰AI数据中心管理平台的本地智能运维助手。",
    "",
    "现在可以直接问：",
    "- 某个 IP、计算机名、SN、资产编号在哪里",
    "- 某个责任人负责哪些服务器",
    "- 某个机柜或机房有哪些设备",
    "- 当前有哪些告警、某台设备告警怎么处理",
    "- 最近有哪些 AI 查询、导入、修改等审计记录",
    "",
    "可用命令：",
    "- /help：查看助手能力",
    "- /tools：查看只读 Agent API 工具清单",
    "- /skills：查看内置运维 Skill",
  ].join("\n");
}

export function answerAiAssistantCommand(
  input: string,
  tools: AgentReadonlyTool[],
): AiAssistantCommandAnswer | null {
  const command = normalizeCommand(input);
  if (!command) return null;

  const answers: Record<string, string> = {
    "/help": formatHelp(),
    "/tools": formatTools(tools),
    "/skills": formatSkills(),
  };
  const answer = answers[command];
  if (!answer) return null;

  return {
    toolName: "agent_command",
    answer,
  };
}
