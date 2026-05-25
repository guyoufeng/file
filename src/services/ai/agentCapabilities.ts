export interface AiAgentCapabilitySettings {
  generalChatEnabled: boolean;
  externalToolsEnabled: boolean;
  weatherSkillEnabled: boolean;
  webSearchSkillEnabled: boolean;
  monitoringSkillMemoryEnabled: boolean;
}

const STORAGE_KEY = "qf-ai-dcim.aiAgentCapabilities";

export const defaultAiAgentCapabilitySettings: AiAgentCapabilitySettings = {
  generalChatEnabled: true,
  externalToolsEnabled: false,
  weatherSkillEnabled: false,
  webSearchSkillEnabled: false,
  monitoringSkillMemoryEnabled: true,
};

export function getAiAgentCapabilitySettings(): AiAgentCapabilitySettings {
  if (typeof localStorage === "undefined") {
    return defaultAiAgentCapabilitySettings;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultAiAgentCapabilitySettings;

  try {
    return {
      ...defaultAiAgentCapabilitySettings,
      ...(JSON.parse(raw) as Partial<AiAgentCapabilitySettings>),
    };
  } catch {
    return defaultAiAgentCapabilitySettings;
  }
}

export function saveAiAgentCapabilitySettings(
  settings: Partial<AiAgentCapabilitySettings>,
): AiAgentCapabilitySettings {
  const nextSettings = {
    ...getAiAgentCapabilitySettings(),
    ...settings,
  };
  const normalized = nextSettings.externalToolsEnabled
    ? nextSettings
    : {
        ...nextSettings,
        weatherSkillEnabled: false,
        webSearchSkillEnabled: false,
      };

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function buildCapabilityPrompt(settings: AiAgentCapabilitySettings) {
  if (!settings.externalToolsEnabled) {
    return [
      "AI Agent 能力边界：未启用外网辅助。",
      "遇到天气、新闻、联网搜索等实时外部信息时，必须说明当前不能查询实时结果。",
      "可以回答平台使用、运维方法、巡检建议和资产/告警查询相关问题。",
    ].join("\n");
  }

  const enabledSkills = [
    settings.weatherSkillEnabled ? "天气查询" : "",
    settings.webSearchSkillEnabled ? "网页搜索" : "",
    settings.monitoringSkillMemoryEnabled ? "监控API Skill记忆" : "",
  ].filter(Boolean);

  return [
    `AI Agent 能力边界：已允许外网辅助 Skill：${enabledSkills.join("、") || "无"}.`,
    "实时外部信息必须来自工具返回结果，不能凭模型记忆生成。",
    "所有外部工具调用后续必须进入审计日志，并标记工具名、查询对象和结果状态。",
  ].join("\n");
}
