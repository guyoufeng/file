export interface AgentReliabilitySettings {
  maxRetries: number;
  backupModelEnabled: boolean;
  contentBlocksEnabled: boolean;
  highRiskGuardEnabled: boolean;
  contextCompressionEnabled: boolean;
  fileCacheEnabled: boolean;
  middlewareAuditEnabled: boolean;
}

export interface AgentRetryCandidate<T> {
  label: string;
  run: () => Promise<T>;
}

export interface AgentRetryAttempt {
  candidate: string;
  attempt: number;
  status: "failed" | "success";
  message: string;
}

export interface AgentRetryResult<T> {
  value: T;
  usedCandidate: string;
  attempts: AgentRetryAttempt[];
}

const STORAGE_KEY = "qf-ai-dcim.agentReliabilitySettings";

const defaultSettings: AgentReliabilitySettings = {
  maxRetries: 2,
  backupModelEnabled: true,
  contentBlocksEnabled: true,
  highRiskGuardEnabled: true,
  contextCompressionEnabled: true,
  fileCacheEnabled: true,
  middlewareAuditEnabled: true,
};

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

export function getAgentReliabilitySettings(): AgentReliabilitySettings {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<AgentReliabilitySettings>) };
  } catch {
    return defaultSettings;
  }
}

export function saveAgentReliabilitySettings(
  patch: Partial<AgentReliabilitySettings>,
): AgentReliabilitySettings {
  const next = {
    ...getAgentReliabilitySettings(),
    ...patch,
    maxRetries: Math.max(0, Math.min(5, patch.maxRetries ?? getAgentReliabilitySettings().maxRetries)),
  };
  storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function executeWithAgentRetry<T>(
  candidates: AgentRetryCandidate<T>[],
  settings = getAgentReliabilitySettings(),
): Promise<AgentRetryResult<T>> {
  const attempts: AgentRetryAttempt[] = [];
  const maxAttemptsPerCandidate = Math.max(1, settings.maxRetries);
  const selectedCandidates = settings.backupModelEnabled ? candidates : candidates.slice(0, 1);

  for (const candidate of selectedCandidates) {
    for (let attempt = 1; attempt <= maxAttemptsPerCandidate; attempt += 1) {
      try {
        const value = await candidate.run();
        attempts.push({
          candidate: candidate.label,
          attempt,
          status: "success",
          message: "调用成功",
        });
        return { value, usedCandidate: candidate.label, attempts };
      } catch (error) {
        attempts.push({
          candidate: candidate.label,
          attempt,
          status: "failed",
          message: error instanceof Error ? error.message : "调用失败",
        });
      }
    }
  }

  const first = attempts.find((attempt) => attempt.status === "failed");
  throw new Error(first?.message || "Agent 模型调用失败");
}

export function shouldRequireHumanApproval(question: string): boolean {
  return /删除|清空|覆盖|重置|格式化|下架|停机|关机|修改密码|暴露|导出.*密钥|发送.*密码/.test(
    question,
  );
}
