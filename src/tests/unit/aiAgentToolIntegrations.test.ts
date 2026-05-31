import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteAgentToolIntegration,
  formatAgentToolIntegrationPrompt,
  getAgentToolIntegrations,
  saveAgentToolIntegration,
  testAgentToolIntegration,
} from "../../services/ai/agentToolIntegrations";

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

describe("AI agent CMDB/MCP tool integrations", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("stores CMDB and MCP tool configs and masks secrets in agent prompt", () => {
    saveAgentToolIntegration({
      type: "cmdb",
      name: "公司 CMDB",
      endpoint: "https://cmdb.example/api",
      token: "cmdb-secret",
      enabled: true,
      notes: "资产同步",
    });
    saveAgentToolIntegration({
      type: "mcp",
      name: "ZStack MCP",
      endpoint: "mcp://zstack",
      token: "mcp-secret",
      enabled: false,
      notes: "虚拟机同步",
    });

    const integrations = getAgentToolIntegrations();
    expect(integrations).toHaveLength(2);

    const prompt = formatAgentToolIntegrationPrompt();
    expect(prompt).toContain("公司 CMDB");
    expect(prompt).toContain("cmdb");
    expect(prompt).toContain("密钥：已保存");
    expect(prompt).not.toContain("cmdb-secret");
    expect(prompt).not.toContain("mcp-secret");
    expect(prompt).not.toContain("ZStack MCP");
  });

  it("validates tool integration connectivity inputs without exposing token", async () => {
    await expect(
      testAgentToolIntegration({
        type: "cmdb",
        name: "",
        endpoint: "https://cmdb.example/api",
        token: "secret",
        enabled: true,
        notes: "",
      }),
    ).resolves.toMatchObject({ ok: false });

    await expect(
      testAgentToolIntegration({
        type: "mcp",
        name: "ZStack MCP",
        endpoint: "mcp://zstack",
        token: "secret",
        enabled: true,
        notes: "",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("deletes a tool integration by id", () => {
    const integration = saveAgentToolIntegration({
      type: "cmdb",
      name: "公司 CMDB",
      endpoint: "https://cmdb.example/api",
      enabled: true,
      notes: "",
    });

    deleteAgentToolIntegration(integration.id);

    expect(getAgentToolIntegrations()).toEqual([]);
  });
});
