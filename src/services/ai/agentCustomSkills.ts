import type { AiSkillDefinition } from "./agentProfile";

const STORAGE_KEY = "qf-ai-dcim.agent.customSkills";

function readCustomSkills(): AiSkillDefinition[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AiSkillDefinition[];
  } catch {
    return [];
  }
}

function writeCustomSkills(skills: AiSkillDefinition[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
}

export function getCustomAgentSkills(): AiSkillDefinition[] {
  return readCustomSkills();
}

export function addCustomAgentSkill(input: string): AiSkillDefinition {
  const [rawName, ...descriptionParts] = input.split(/[:：]/);
  const name = rawName.trim();
  const description = descriptionParts.join("：").trim();
  if (!name || !description) {
    throw new Error("Skill 格式应为：/skill add 名称:说明");
  }

  const skill: AiSkillDefinition = {
    name,
    description,
    rules: ["该 Skill 来自用户维护，回答时优先遵守其说明。"],
  };
  const next = [
    skill,
    ...readCustomSkills().filter((item) => item.name !== skill.name),
  ].slice(0, 30);
  writeCustomSkills(next);
  return skill;
}

export function formatCustomAgentSkillPrompt(
  skills: AiSkillDefinition[] = getCustomAgentSkills(),
) {
  if (skills.length === 0) return "用户自定义 Skill：暂无。";
  return [
    "用户自定义 Skill：",
    ...skills.map((skill) => `Skill：${skill.name}\n说明：${skill.description}`),
  ].join("\n\n");
}
