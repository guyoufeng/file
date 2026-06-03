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
  if (file.size <= options.textHeadBytes + options.textTailBytes) {
    return {
      text: safeText(await file.text()),
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
    const lineCount = preview.text ? preview.text.split(/\r?\n/).length : 0;
    return {
      ...base,
      status: "ready",
      summary: `${file.name} 已解析为文本预览，大小 ${formatSize(file.size)}，约 ${lineCount} 行${preview.truncated ? "，已按头尾分块截取" : ""}。`,
      extractedText: preview.text,
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

export function formatAttachmentsForAgentPrompt(attachments?: AgentAttachmentSummary[]): string {
  if (!attachments || attachments.length === 0) return "附件：无。";
  return [
    "附件分析结果：",
    ...attachments.map((item, index) => {
      const text = item.extractedText
        ? `\n提取内容：\n${item.extractedText.slice(0, 8000)}`
        : "";
      return `${index + 1}. ${item.name}（${item.type}，${item.sizeLabel}）：${item.summary}${text}`;
    }),
  ].join("\n");
}
