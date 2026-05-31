import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAgentRoleDefinition,
  resetAgentRoleDefinition,
  saveAgentRoleDefinition,
} from "../../services/ai/agentIdentity";
import {
  formatCredentialCatalogForAgent,
  saveAgentCredential,
} from "../../services/ai/agentCredentials";
import {
  addKnowledgeEntry,
  formatKnowledgePrompt,
  searchKnowledgeEntries,
} from "../../services/ai/agentKnowledgeBase";

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

describe("AI agent workbench services", () => {
  it("stores editable role definition", () => {
    saveAgentRoleDefinition("你是数据中心运维 Agent。");

    expect(getAgentRoleDefinition()).toContain("数据中心运维 Agent");
    expect(resetAgentRoleDefinition()).toContain("泉峰AI数据中心管理平台");
  });

  it("stores credentials but formats only masked catalog for agent context", () => {
    saveAgentCredential({
      type: "zoho",
      name: "卓豪生产监控",
      endpoint: "https://zoho.example/api",
      username: "admin",
      secret: "super-secret",
      notes: "生产环境",
    });

    const catalog = formatCredentialCatalogForAgent();

    expect(catalog).toContain("卓豪生产监控");
    expect(catalog).toContain("已保存");
    expect(catalog).not.toContain("super-secret");
  });

  it("stores and searches knowledge entries", () => {
    addKnowledgeEntry({
      title: "服务器内存故障处理",
      content: "先确认告警 DIMM 槽位，再安排停机更换同规格内存条。",
      tags: ["硬件", "内存"],
    });

    expect(searchKnowledgeEntries("内存条坏了")).toHaveLength(1);
    expect(formatKnowledgePrompt("内存条坏了")).toContain("DIMM");
  });
});
