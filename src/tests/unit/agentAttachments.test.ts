import { describe, expect, it } from "vitest";
import {
  buildAttachmentAnalysisAnswer,
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

  it("keeps searchable evidence from the middle of large log files for restart analysis", async () => {
    const middle = [
      "2026-06-02 15:18:20 INFO VM[vm-prod-01] qemu monitor disconnected",
      "2026-06-02 15:18:23 ERROR VM[vm-prod-01] host heartbeat timeout, HA will restart the VM",
      "2026-06-02 15:18:51 INFO VM[vm-prod-01] start vm after HA recovery success",
    ].join("\n");
    const file = new File(
      ["A".repeat(128 * 1024), "\n", middle, "\n", "Z".repeat(128 * 1024)],
      "zstack-kvmagent.log",
      { type: "text/plain" },
    );

    const summary = await summarizeAgentAttachment(file, {
      textHeadBytes: 16,
      textTailBytes: 16,
    });
    const answer = buildAttachmentAnalysisAnswer("分析6月2号下午有虚拟机发生重启的原因", [summary]);

    expect(summary.fullTextAvailable).toBe(true);
    expect(answer).toContain("vm-prod-01");
    expect(answer).toContain("HA will restart");
    expect(answer).toContain("host heartbeat timeout");
  });
});
