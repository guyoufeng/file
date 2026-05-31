import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAgentMemories } from "../../services/ai/agentMemory";
import { getKnowledgeEntries } from "../../services/ai/agentKnowledgeBase";
import { getAgentRoleDefinition } from "../../services/ai/agentIdentity";
import { answerAgentControlMessage } from "../../services/ai/agentNaturalLanguageCommands";

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("AI agent natural-language control commands", () => {
  it("stores memory from natural language", async () => {
    const result = await answerAgentControlMessage("请记住以后优先用中文回答运维问题");

    expect(result?.answer).toContain("已写入长期记忆");
    expect(getAgentMemories()[0].content).toBe("以后优先用中文回答运维问题");
  });

  it("stores knowledge from natural language", async () => {
    const result = await answerAgentControlMessage(
      "把服务器内存故障先确认 DIMM 槽位加入知识库",
    );

    expect(result?.answer).toContain("已加入知识库");
    expect(getKnowledgeEntries()[0].content).toContain("DIMM");
  });

  it("updates role definition from natural language", async () => {
    const result = await answerAgentControlMessage(
      "更新角色定义 你是泉峰数据中心的专业 AI 运维智能体",
    );

    expect(result?.answer).toContain("角色定义已更新");
    expect(getAgentRoleDefinition()).toContain("专业 AI 运维智能体");
  });
});
