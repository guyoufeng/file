import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCustomAgentSkill,
  formatCustomAgentSkillPrompt,
  getCustomAgentSkills,
} from "../../services/ai/agentCustomSkills";

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

describe("AI agent custom skills", () => {
  it("adds user maintained skills to future model context", () => {
    const skill = addCustomAgentSkill("报警维修建议: 结合硬件告警给出排查步骤");

    expect(skill.name).toBe("报警维修建议");
    expect(getCustomAgentSkills()).toHaveLength(1);
    expect(formatCustomAgentSkillPrompt()).toContain("结合硬件告警");
  });
});
