import { describe, expect, it } from "vitest";
import {
  formatAttachmentsForAgentPrompt,
  summarizeAgentAttachment,
} from "../../services/ai/agentAttachments";

describe("agent attachments", () => {
  it("extracts text previews for files without using the unsupported fallback", async () => {
    const file = new File(
      ["服务器巡检记录\nQF-SRV-001 内存 ECC 告警已恢复\n处理人：张三"],
      "inspection.txt",
      { type: "text/plain" },
    );

    const summary = await summarizeAgentAttachment(file);

    expect(summary.status).toBe("ready");
    expect(summary.extractedText).toContain("QF-SRV-001");
    expect(formatAttachmentsForAgentPrompt([summary])).not.toContain("暂不支持直接解析附件");
  });

  it("supports large files with bounded first and last chunk analysis", async () => {
    const prefix = "A".repeat(140 * 1024);
    const suffix = "结尾：硬盘故障处理完成";
    const file = new File([prefix, suffix], "large.log", { type: "text/plain" });

    const summary = await summarizeAgentAttachment(file, {
      textHeadBytes: 16,
      textTailBytes: 32,
    });

    expect(summary.status).toBe("ready");
    expect(summary.truncated).toBe(true);
    expect(summary.extractedText).toContain("前 16 字节");
    expect(summary.extractedText).toContain("硬盘故障处理完成");
  });
});
