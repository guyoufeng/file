import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCapabilityPrompt,
  getAiAgentCapabilitySettings,
  saveAiAgentCapabilitySettings,
} from "../../services/ai/agentCapabilities";

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

describe("AI agent capability settings", () => {
  it("keeps external tools disabled by default while allowing general chat", () => {
    const settings = getAiAgentCapabilitySettings();

    expect(settings.generalChatEnabled).toBe(true);
    expect(settings.externalToolsEnabled).toBe(false);
    expect(settings.weatherSkillEnabled).toBe(false);
    expect(settings.webSearchSkillEnabled).toBe(false);
  });

  it("persists selected skills for future agent tools", () => {
    saveAiAgentCapabilitySettings({
      externalToolsEnabled: true,
      weatherSkillEnabled: true,
      webSearchSkillEnabled: false,
    });

    expect(getAiAgentCapabilitySettings()).toMatchObject({
      externalToolsEnabled: true,
      weatherSkillEnabled: true,
      webSearchSkillEnabled: false,
    });
  });

  it("builds a safety prompt that forbids fake realtime answers without tools", () => {
    expect(buildCapabilityPrompt(getAiAgentCapabilitySettings())).toContain(
      "未启用外网辅助",
    );

    saveAiAgentCapabilitySettings({
      externalToolsEnabled: true,
      weatherSkillEnabled: true,
    });

    expect(buildCapabilityPrompt(getAiAgentCapabilitySettings())).toContain(
      "必须来自工具返回结果",
    );
  });
});
