export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  sourceType: "manual" | "attachment" | "alarm" | "skill" | "other";
  tags: string[];
  createdAt: string;
}

export interface KnowledgeEntryInput {
  title: string;
  content: string;
  sourceType?: KnowledgeEntry["sourceType"];
  tags?: string[];
}

const STORAGE_KEY = "qf-ai-dcim.agent.knowledgeBase";

function readKnowledge(): KnowledgeEntry[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as KnowledgeEntry[];
  } catch {
    return [];
  }
}

function writeKnowledge(entries: KnowledgeEntry[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getKnowledgeEntries(): KnowledgeEntry[] {
  return readKnowledge().sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function addKnowledgeEntry(input: KnowledgeEntryInput): KnowledgeEntry {
  const entry: KnowledgeEntry = {
    id: `knowledge-${Date.now()}`,
    title: input.title.trim() || "未命名知识",
    content: input.content.trim(),
    sourceType: input.sourceType ?? "manual",
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...readKnowledge()].slice(0, 200);
  writeKnowledge(next);
  return entry;
}

export function deleteKnowledgeEntry(id: string) {
  writeKnowledge(readKnowledge().filter((item) => item.id !== id));
}

function buildSearchTokens(query: string) {
  const normalized = query.trim().toLowerCase();
  const explicitTokens = normalized
    .split(/[\s,，。；;:：、/\\|]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const chineseTokens = Array.from(normalized.matchAll(/[\u4e00-\u9fa5]{2,}/g))
    .flatMap((match) => {
      const word = match[0];
      const tokens = [word];
      for (let size = 2; size <= Math.min(4, word.length); size += 1) {
        for (let index = 0; index <= word.length - size; index += 1) {
          tokens.push(word.slice(index, index + size));
        }
      }
      return tokens;
    });
  return Array.from(new Set([...explicitTokens, ...chineseTokens])).filter(
    (item) => !["怎么", "如何", "什么", "一下", "查看", "查询"].includes(item),
  );
}

function scoreEntry(entry: KnowledgeEntry, tokens: string[]) {
  const text = [entry.title, entry.content, entry.tags.join(" ")].join(" ").toLowerCase();
  return tokens.reduce((score, token) => (text.includes(token) ? score + token.length : score), 0);
}

export function searchKnowledgeEntries(query: string, limit = 5): KnowledgeEntry[] {
  const tokens = buildSearchTokens(query);
  if (tokens.length === 0) return [];
  return getKnowledgeEntries()
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.entry)
    .slice(0, limit);
}

export function formatKnowledgePrompt(query: string): string {
  const matches = searchKnowledgeEntries(query);
  if (matches.length === 0) return "知识库检索：未找到相关知识。";
  return [
    "知识库检索结果：",
    ...matches.map((entry, index) =>
      `${index + 1}. ${entry.title}\n${entry.content.slice(0, 800)}`,
    ),
  ].join("\n\n");
}
