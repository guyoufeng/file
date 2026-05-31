import type { AgentReadonlyTool } from "../agent/apiManifest";
import { answerAiAssistantCommand } from "./agentCommands";
import {
  addAgentMemory,
  clearAgentMemories,
  formatAgentMemoryPrompt,
} from "./agentMemory";
import {
  addCustomAgentSkill,
  formatCustomAgentSkillPrompt,
} from "./agentCustomSkills";
import {
  addKnowledgeEntry,
  formatKnowledgePrompt,
  getKnowledgeEntries,
} from "./agentKnowledgeBase";
import {
  getAgentRoleDefinition,
  resetAgentRoleDefinition,
  saveAgentRoleDefinition,
} from "./agentIdentity";
import { formatCredentialCatalogForAgent } from "./agentCredentials";

export interface AgentControlAnswer {
  toolName: "agent_command";
  answer: string;
}

export async function answerAgentControlMessage(
  questionText: string,
  loadTools: () => Promise<AgentReadonlyTool[]> = async () => [],
): Promise<AgentControlAnswer | null> {
  const trimmed = questionText.trim();
  if (!trimmed) return null;

  const memoryContent = extractMemoryContent(trimmed);
  if (memoryContent) {
    const memory = addAgentMemory(memoryContent);
    return commandAnswer(`已写入长期记忆：${memory.content}`);
  }

  if (trimmed === "/memory" || /^(查看|显示|列出).*(记忆|长期记忆)$/.test(trimmed)) {
    return commandAnswer(formatAgentMemoryPrompt());
  }

  if (trimmed === "/clear-memory" || /^(清空|删除).*(记忆|长期记忆)$/.test(trimmed)) {
    clearAgentMemories();
    return commandAnswer("已清空 AI Agent 长期记忆。");
  }

  const skillContent = extractSkillContent(trimmed);
  if (skillContent) {
    try {
      const skill = addCustomAgentSkill(skillContent);
      return commandAnswer(`已新增自定义 Skill：${skill.name}\n${skill.description}`);
    } catch (error) {
      return commandAnswer(error instanceof Error ? error.message : "新增 Skill 失败");
    }
  }

  if (
    trimmed === "/custom-skills" ||
    /^(查看|显示|列出).*(skill|Skill|技能)$/.test(trimmed)
  ) {
    return commandAnswer(formatCustomAgentSkillPrompt());
  }

  const knowledgeContent = extractKnowledgeContent(trimmed);
  if (knowledgeContent) {
    const entry = addKnowledgeEntry({
      title: knowledgeContent.slice(0, 24),
      content: knowledgeContent,
      sourceType: "manual",
    });
    return commandAnswer(`已加入知识库：${entry.title}`);
  }

  if (/^(查看|显示|列出).*知识库$/.test(trimmed)) {
    const entries = getKnowledgeEntries();
    if (entries.length === 0) return commandAnswer("知识库暂无内容。");
    return commandAnswer([
      "知识库当前内容：",
      ...entries.slice(0, 20).map((entry, index) => `${index + 1}. ${entry.title}`),
    ].join("\n"));
  }

  if (/^(搜索|查询|检索).*知识库/.test(trimmed)) {
    return commandAnswer(formatKnowledgePrompt(trimmed));
  }

  const roleContent = extractRoleContent(trimmed);
  if (roleContent) {
    const role = saveAgentRoleDefinition(roleContent);
    return commandAnswer(`角色定义已更新：\n${role}`);
  }

  if (/^(查看|显示|列出).*(角色定义|系统提示词|agent角色|Agent角色)/.test(trimmed)) {
    return commandAnswer(`当前角色定义：\n${getAgentRoleDefinition()}`);
  }

  if (/^(恢复|重置).*(角色定义|系统提示词|agent角色|Agent角色)/.test(trimmed)) {
    return commandAnswer(`已恢复默认角色定义：\n${resetAgentRoleDefinition()}`);
  }

  if (/^(查看|显示|列出).*(凭据|账号|密码|token|Token)/.test(trimmed)) {
    return commandAnswer(formatCredentialCatalogForAgent());
  }

  const tools = await loadTools().catch(() => []);
  return answerAiAssistantCommand(questionText, tools);
}

function commandAnswer(answer: string): AgentControlAnswer {
  return {
    toolName: "agent_command",
    answer,
  };
}

function extractMemoryContent(trimmed: string) {
  if (trimmed.startsWith("/remember ")) {
    return trimmed.replace(/^\/remember\s+/, "").trim();
  }
  const direct = trimmed.match(/^(?:请|帮我)?记住[:：]?\s*(.+)$/);
  if (direct) return direct[1].trim();
  const add = trimmed.match(/^把(.+)(?:加入|写入|保存到)(?:长期)?记忆$/);
  return add?.[1].trim() ?? "";
}

function extractSkillContent(trimmed: string) {
  if (trimmed.startsWith("/skill add ")) {
    return trimmed.replace(/^\/skill\s+add\s+/, "").trim();
  }
  const natural = trimmed.match(/^(?:请|帮我)?(?:新增|添加|更新|写入)(?:一个)?\s*(?:skill|Skill|技能)[:：]?\s*(.+)$/);
  return natural?.[1].trim() ?? "";
}

function extractKnowledgeContent(trimmed: string) {
  const add = trimmed.match(/^把(.+)(?:加入|写入|保存到|放到)知识库$/);
  if (add) return add[1].trim();
  const direct = trimmed.match(/^(?:请|帮我)?(?:新增|添加|更新|写入)(?:一条)?知识(?:库)?[:：]?\s*(.+)$/);
  return direct?.[1].trim() ?? "";
}

function extractRoleContent(trimmed: string) {
  const role = trimmed.match(/^(?:请|帮我)?(?:更新|修改|设置|写入)(?:AI)?(?:Agent)?(?:角色定义|系统提示词|agent角色|Agent角色)[:：]?\s*(.+)$/);
  return role?.[1].trim() ?? "";
}
