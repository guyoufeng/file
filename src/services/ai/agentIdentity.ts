import { qfDcimAgentRole } from "./agentProfile";

const STORAGE_KEY = "qf-ai-dcim.agent.roleDefinition";

export function getAgentRoleDefinition(): string {
  if (typeof localStorage === "undefined") return qfDcimAgentRole;
  return localStorage.getItem(STORAGE_KEY) || qfDcimAgentRole;
}

export function saveAgentRoleDefinition(role: string): string {
  const normalized = role.trim() || qfDcimAgentRole;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, normalized);
  }
  return normalized;
}

export function resetAgentRoleDefinition(): string {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return qfDcimAgentRole;
}
