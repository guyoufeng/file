import { beforeEach, describe, expect, it } from "vitest";
import {
  authorizeAgentApiKey,
  createAgentApiKey,
  listAgentApiKeys,
} from "../../services/agent/apiKeys";

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

describe("agent api keys", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("creates read and write scoped api keys without exposing the raw token after creation", () => {
    const readonlyKey = createAgentApiKey({ name: "只读演示", scopes: ["read"] });
    const writeKey = createAgentApiKey({ name: "写入集成", scopes: ["read", "write"] });

    expect(readonlyKey.token).toMatch(/^qf_agent_/);
    expect(writeKey.token).toMatch(/^qf_agent_/);
    expect(listAgentApiKeys()).toEqual([
      expect.objectContaining({ name: "写入集成", tokenPreview: expect.any(String) }),
      expect.objectContaining({ name: "只读演示", tokenPreview: expect.any(String) }),
    ]);
    expect(JSON.stringify(listAgentApiKeys())).not.toContain(writeKey.token);
    expect(authorizeAgentApiKey(readonlyKey.token, "read").ok).toBe(true);
    expect(authorizeAgentApiKey(readonlyKey.token, "write").ok).toBe(false);
    expect(authorizeAgentApiKey(writeKey.token, "write").ok).toBe(true);
  });
});
