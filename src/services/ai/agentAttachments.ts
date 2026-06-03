export type AgentAttachmentKind = "text" | "spreadsheet" | "image" | "pdf" | "binary";

export interface AgentAttachmentSummary {
  name: string;
  type: string;
  size: number;
  sizeLabel: string;
  kind: AgentAttachmentKind;
  status: "ready" | "error";
  summary: string;
  extractedText?: string;
  fullTextForAnalysis?: string;
  fullTextAvailable?: boolean;
  lineCount?: number;
  truncated?: boolean;
  imagePreviewDataUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  error?: string;
}

export interface AttachmentSummaryOptions {
  maxBytes?: number;
  textHeadBytes?: number;
  textTailBytes?: number;
  previewImageMaxBytes?: number;
}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_TEXT_HEAD_BYTES = 96 * 1024;
const DEFAULT_TEXT_TAIL_BYTES = 48 * 1024;
const DEFAULT_IMAGE_PREVIEW_MAX_BYTES = 6 * 1024 * 1024;

function formatSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${size} B`;
}

function detectAttachmentKind(file: File): AgentAttachmentKind {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (file.type.includes("pdf") || /\.pdf$/i.test(name)) return "pdf";
  if (/\.(csv|xlsx?|xlsm|tsv)$/i.test(name)) return "spreadsheet";
  if (
    file.type.startsWith("text/") ||
    /\.(txt|md|json|log|yaml|yml|xml|ini|conf|sql|csv|tsv)$/i.test(name)
  ) {
    return "text";
  }
  return "binary";
}

function safeText(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

async function readTextPreview(file: File, options: Required<Pick<AttachmentSummaryOptions, "textHeadBytes" | "textTailBytes">>) {
  const fullText = safeText(await file.text());
  if (file.size <= options.textHeadBytes + options.textTailBytes) {
    return {
      text: fullText,
      fullText,
      truncated: false,
    };
  }
  const head = safeText(await file.slice(0, options.textHeadBytes).text());
  const tailStart = Math.max(0, file.size - options.textTailBytes);
  const tail = safeText(await file.slice(tailStart, file.size).text());
  return {
    text: [
      `【前 ${options.textHeadBytes} 字节】`,
      head,
      "",
      `【后 ${options.textTailBytes} 字节】`,
      tail,
    ].join("\n"),
    fullText,
    truncated: true,
  };
}

async function readImagePreview(file: File, maxBytes: number): Promise<string | undefined> {
  if (file.size > maxBytes || typeof FileReader === "undefined") return undefined;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

async function readImageDimensions(dataUrl?: string): Promise<{ width: number; height: number } | undefined> {
  if (!dataUrl || typeof Image === "undefined") return undefined;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(undefined);
    image.src = dataUrl;
  });
}

function buildSummaryBase(file: File, kind: AgentAttachmentKind): Pick<AgentAttachmentSummary, "name" | "type" | "size" | "sizeLabel" | "kind"> {
  return {
    name: file.name,
    type: file.type || "未知类型",
    size: file.size,
    sizeLabel: formatSize(file.size),
    kind,
  };
}

export async function summarizeAgentAttachment(
  file: File,
  options: AttachmentSummaryOptions = {},
): Promise<AgentAttachmentSummary> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const kind = detectAttachmentKind(file);
  const base = buildSummaryBase(file, kind);

  if (file.size > maxBytes) {
    return {
      ...base,
      status: "error",
      summary: `文件超过 ${formatSize(maxBytes)}，请拆分后再上传。`,
      error: "文件过大",
    };
  }

  if (kind === "text" || kind === "spreadsheet") {
    const preview = await readTextPreview(file, {
      textHeadBytes: options.textHeadBytes ?? DEFAULT_TEXT_HEAD_BYTES,
      textTailBytes: options.textTailBytes ?? DEFAULT_TEXT_TAIL_BYTES,
    });
    const lineCount = preview.fullText ? preview.fullText.split(/\r?\n/).length : 0;
    return {
      ...base,
      status: "ready",
      summary: `${file.name} 已解析为文本预览，大小 ${formatSize(file.size)}，约 ${lineCount} 行${preview.truncated ? "，已按头尾分块截取" : ""}。`,
      extractedText: preview.text,
      fullTextForAnalysis: preview.fullText,
      fullTextAvailable: true,
      lineCount,
      truncated: preview.truncated,
    };
  }

  if (kind === "image") {
    const imagePreviewDataUrl = await readImagePreview(
      file,
      options.previewImageMaxBytes ?? DEFAULT_IMAGE_PREVIEW_MAX_BYTES,
    );
    const dimensions = await readImageDimensions(imagePreviewDataUrl);
    return {
      ...base,
      status: "ready",
      summary: `${file.name} 已作为图片附件接收，大小 ${formatSize(file.size)}${
        dimensions ? `，分辨率 ${dimensions.width}x${dimensions.height}` : ""
      }。当前会把图片元数据和预览交给 Agent，后续可升级多模态模型直接识图。`,
      imagePreviewDataUrl,
      imageWidth: dimensions?.width,
      imageHeight: dimensions?.height,
    };
  }

  return {
    ...base,
    status: "ready",
    summary: `${file.name} 已作为 ${kind === "pdf" ? "PDF" : "二进制"} 附件接收，大小 ${formatSize(file.size)}。当前版本记录文件元数据，建议同时补充文字说明方便模型分析。`,
  };
}

export function formatAttachmentsForAgentPrompt(
  attachments?: AgentAttachmentSummary[],
  question = "附件内容",
): string {
  if (!attachments || attachments.length === 0) return "附件：无。";
  return [
    "附件分析结果：",
    ...attachments.map((item, index) => {
      const evidence = buildAttachmentEvidence(question, item).slice(0, 8000);
      const text = evidence
        ? `\n提取内容：\n${evidence}`
        : "";
      return `${index + 1}. ${item.name}（${item.type}，${item.sizeLabel}）：${item.summary}${text}`;
    }),
  ].join("\n");
}

interface LogEvidence {
  attachmentName: string;
  lineNumber: number;
  timestamp?: string;
  score: number;
  text: string;
}

const ROUTINE_LOG_PATTERNS = [
  /get_vm_guest_tools/i,
  /vm_in_ps_pool/i,
  /prometheus/i,
  /collect.*metric/i,
];

const RESTART_PATTERNS = [
  /reboot/i,
  /restart/i,
  /重启/,
  /shutdown/i,
  /power\s*off/i,
  /poweroff/i,
  /reset/i,
  /destroy/i,
  /stop\s+vm/i,
  /start\s+vm/i,
  /HA/i,
  /heartbeat/i,
  /qemu/i,
  /libvirt/i,
  /disconnect/i,
];

const FAILURE_PATTERNS = [
  /error/i,
  /failed/i,
  /failure/i,
  /timeout/i,
  /exception/i,
  /panic/i,
  /fatal/i,
  /故障/,
  /失败/,
  /超时/,
  /异常/,
];

function normalizeTimestamp(line: string): string | undefined {
  const match = line.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}:\d{2}:\d{2})/);
  if (!match) return undefined;
  const [, year, month, day, time] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${time}`;
}

function getQuestionDateFilter(question: string): string | undefined {
  const chinese = question.match(/(\d{1,2})月(\d{1,2})(?:号|日)?/);
  if (chinese) return `${chinese[1].padStart(2, "0")}-${chinese[2].padStart(2, "0")}`;
  const numeric = question.match(/(?:\d{4}[-/])?(\d{1,2})[-/](\d{1,2})/);
  if (numeric) return `${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  return undefined;
}

function matchesTimeWindow(timestamp: string | undefined, question: string) {
  if (!timestamp) return true;
  const dateFilter = getQuestionDateFilter(question);
  if (dateFilter && !timestamp.slice(5, 10).includes(dateFilter)) return false;
  const hour = Number(timestamp.slice(11, 13));
  if (/下午/.test(question)) return hour >= 12 && hour <= 18;
  if (/上午/.test(question)) return hour >= 0 && hour <= 12;
  if (/晚上|夜间/.test(question)) return hour >= 18 || hour <= 6;
  return true;
}

function scoreLogLine(line: string, question: string) {
  let score = 0;
  const lowerQuestion = question.toLowerCase();
  if (RESTART_PATTERNS.some((pattern) => pattern.test(line))) score += 4;
  if (FAILURE_PATTERNS.some((pattern) => pattern.test(line))) score += 3;
  if (/vm|虚拟机|domain/i.test(line)) score += 2;
  if (/ha|heartbeat|心跳/i.test(line)) score += 2;
  if (/重启|restart|reboot|虚拟机|vm/.test(lowerQuestion)) {
    if (/restart|reboot|重启|start\s+vm|stop\s+vm/i.test(line)) score += 2;
  }
  if (ROUTINE_LOG_PATTERNS.some((pattern) => pattern.test(line))) score -= 3;
  return score;
}

export function buildAttachmentEvidence(question: string, attachment: AgentAttachmentSummary): string {
  const text = attachment.fullTextForAnalysis || attachment.extractedText || "";
  if (!text.trim()) return "";
  const evidence: LogEvidence[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const timestamp = normalizeTimestamp(trimmed);
    if (!matchesTimeWindow(timestamp, question)) return;
    const score = scoreLogLine(trimmed, question);
    if (score < 3 && evidence.length > 0) return;
    if (score < 3 && !/附件内容/.test(question)) return;
    evidence.push({
      attachmentName: attachment.name,
      lineNumber: index + 1,
      timestamp,
      score,
      text: trimmed.slice(0, 520),
    });
  });

  return evidence
    .sort((first, second) => second.score - first.score || first.lineNumber - second.lineNumber)
    .slice(0, 40)
    .map((item) => `- ${item.attachmentName}:${item.lineNumber}${item.timestamp ? ` ${item.timestamp}` : ""} ${item.text}`)
    .join("\n");
}

export function buildAttachmentAnalysisAnswer(
  question: string,
  attachments?: AgentAttachmentSummary[],
): string {
  const readyAttachments = attachments?.filter((item) => item.status === "ready") ?? [];
  if (readyAttachments.length === 0) return "";

  const evidenceBlocks = readyAttachments
    .map((attachment) => ({
      attachment,
      evidence: buildAttachmentEvidence(question, attachment),
    }))
    .filter((item) => item.evidence);

  if (evidenceBlocks.length === 0) {
    return [
      "附件日志分析结论：未在附件中检索到与当前问题高度相关的重启、HA、心跳超时、qemu/libvirt 或错误证据。",
      "建议补充控制节点审计日志、ZStack 管理节点任务日志、宿主机系统日志和具体虚拟机名称/IP，再做交叉排查。",
    ].join("\n");
  }

  const evidenceText = evidenceBlocks
    .map((block) => {
      const totalLines = block.attachment.lineCount ? `，约 ${block.attachment.lineCount} 行` : "";
      return `【${block.attachment.name}${totalLines}】\n${block.evidence}`;
    })
    .join("\n\n");

  const hasHeartbeat = /heartbeat|心跳/i.test(evidenceText);
  const hasHaRestart = /ha|restart|reboot|重启/i.test(evidenceText);
  const conclusion =
    hasHeartbeat && hasHaRestart
      ? "初步判断：日志中同时出现心跳/连接异常与 HA/重启相关证据，优先怀疑宿主机心跳超时、管理面连接中断或 HA 机制触发虚拟机恢复。"
      : hasHaRestart
        ? "初步判断：日志中存在重启/HA/启动停止相关证据，需要结合虚拟机任务记录确认是人工操作、HA恢复还是宿主机异常触发。"
        : "初步判断：附件里有异常证据，但还没有形成直接重启链路，需要继续结合管理节点任务、宿主机系统日志和虚拟机事件记录确认原因。";

  return [
    "附件日志分析结论：",
    conclusion,
    "",
    "关键证据：",
    evidenceText,
    "",
    "建议下一步：核对上述时间点的宿主机硬件/BMC日志、ZStack任务审计、虚拟机事件历史和网络/存储链路告警，确认是否存在宿主机心跳丢失、存储瞬断或人工重启操作。",
  ].join("\n");
}
