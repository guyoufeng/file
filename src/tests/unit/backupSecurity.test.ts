import { describe, expect, it } from "vitest";
import {
  scanProjectBackupSecurity,
  summarizeBackupSecurity,
} from "../../services/project/backupSecurity";

describe("backup security scan", () => {
  it("detects sensitive field names and secret-looking values", () => {
    const result = scanProjectBackupSecurity({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-26T00:00:00.000Z",
      data: {
        aiModelConfigs: [
          {
            id: "ai-001",
            provider: "gpustack",
            apiKeyRef: "gpustack_386df344b6f0e56d_fc755dd830c238a49374e655a1810aee",
          },
        ],
        devices: [
          {
            id: "dev-001",
            metadata: {
              password: "P@ssw0rd",
              remark: "Bearer abcdef",
            },
          },
        ],
      },
    });

    expect(result.safe).toBe(false);
    expect(result.findings.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        "data.aiModelConfigs[0].apiKeyRef",
        "data.devices[0].metadata.password",
        "data.devices[0].metadata.remark",
      ]),
    );
    expect(summarizeBackupSecurity(result)).toContain("发现 3 处疑似敏感信息");
  });

  it("passes sanitized project files without secrets", () => {
    const result = scanProjectBackupSecurity({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-26T00:00:00.000Z",
      data: {
        aiModelConfigs: [
          {
            id: "ai-001",
            provider: "gpustack",
            model: "qwen3.6-35b-a3b-awq",
          },
        ],
        devices: [{ id: "dev-001", name: "数据库服务器" }],
      },
    });

    expect(result.safe).toBe(true);
    expect(result.findings).toEqual([]);
    expect(summarizeBackupSecurity(result)).toBe("安全检查通过，未发现疑似密钥、Token 或密码字段。");
  });
});
