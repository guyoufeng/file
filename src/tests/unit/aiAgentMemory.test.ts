import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addAgentMemory,
  clearAgentMemories,
  formatAgentMemoryPrompt,
  getAgentMemories,
} from "../../services/ai/agentMemory";

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

describe("AI agent memory", () => {
  it("stores user maintained memories for future model context", () => {
    const memory = addAgentMemory("回答日常问题时优先结合数据中心运维场景。");

    expect(memory.content).toBe("回答日常问题时优先结合数据中心运维场景。");
    expect(getAgentMemories()).toHaveLength(1);
    expect(formatAgentMemoryPrompt()).toContain("数据中心运维场景");
  });

  it("clears memories when user asks to reset them", () => {
    addAgentMemory("测试记忆");
    clearAgentMemories();

    expect(getAgentMemories()).toHaveLength(0);
    expect(formatAgentMemoryPrompt()).toContain("暂无长期记忆");
  });
});
