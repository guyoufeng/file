import { writeAiToolAuditLog } from "../backend/ai";
import type { AiToolName } from "./aiTools";

export function recordAiAgentToolCall(input: {
  toolName: AiToolName;
  question: string;
  source: string;
  answer: string;
  startedAt: number;
  status: "success" | "failed";
  errorMessage?: string;
}) {
  const firstLine = input.answer.split("\n").find((line) => line.trim());
  return writeAiToolAuditLog({
    toolName: input.toolName,
    inputSummary: input.question.slice(0, 200),
    source: input.source,
    durationMs: Math.max(0, Date.now() - input.startedAt),
    status: input.status,
    resultSummary: firstLine?.slice(0, 200) ?? "无返回内容",
    errorMessage: input.errorMessage,
  });
}
