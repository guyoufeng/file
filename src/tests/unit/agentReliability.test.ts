import { beforeEach, describe, expect, it } from "vitest";
import {
  executeWithAgentRetry,
  getAgentReliabilitySettings,
  saveAgentReliabilitySettings,
  shouldRequireHumanApproval,
} from "../../services/ai/agentReliability";

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

describe("agent reliability", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("persists AgentScope-inspired reliability settings and retries failed model calls", async () => {
    saveAgentReliabilitySettings({
      maxRetries: 2,
      backupModelEnabled: true,
      contentBlocksEnabled: true,
    });
    expect(getAgentReliabilitySettings().backupModelEnabled).toBe(true);

    let attempts = 0;
    const result = await executeWithAgentRetry(
      [
        {
          label: "primary",
          run: async () => {
            attempts += 1;
            throw new Error("primary unavailable");
          },
        },
        {
          label: "backup",
          run: async () => "backup-answer",
        },
      ],
      getAgentReliabilitySettings(),
    );

    expect(result.value).toBe("backup-answer");
    expect(result.usedCandidate).toBe("backup");
    expect(result.attempts.length).toBe(3);
    expect(attempts).toBe(2);
  });

  it("requires human approval for high-risk natural-language actions", () => {
    expect(shouldRequireHumanApproval("帮我删除 529-A1 里面的服务器")).toBe(true);
    expect(shouldRequireHumanApproval("查询 529-A1 有哪些服务器")).toBe(false);
  });
});
