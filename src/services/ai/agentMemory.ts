export interface AgentMemory {
  id: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEY = "qf-ai-dcim.agent.memories";

function readMemories(): AgentMemory[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AgentMemory[];
  } catch {
    return [];
  }
}

function writeMemories(memories: AgentMemory[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function getAgentMemories(): AgentMemory[] {
  return readMemories().sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function addAgentMemory(content: string): AgentMemory {
  const memory: AgentMemory = {
    id: `memory-${Date.now()}`,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [memory, ...readMemories().filter((item) => item.content !== memory.content)];
  writeMemories(next.slice(0, 50));
  return memory;
}

export function clearAgentMemories(): void {
  writeMemories([]);
}

export function formatAgentMemoryPrompt(memories: string[] = getAgentMemories().map((item) => item.content)): string {
  if (memories.length === 0) {
    return "Agent 长期记忆：暂无长期记忆。";
  }

  return [
    "Agent 长期记忆：",
    ...memories.slice(0, 20).map((memory, index) => `${index + 1}. ${memory}`),
  ].join("\n");
}
