export interface BackupSecurityFinding {
  path: string;
  reason: string;
}

export interface BackupSecurityScanResult {
  safe: boolean;
  findings: BackupSecurityFinding[];
}

const sensitiveKeyPattern = /api[-_]?key|apiKeyRef|token|password|passwd|secret|authorization/i;
const sensitiveValuePattern = /\bBearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}|gpustack_[a-z0-9_]{16,}/i;

function joinPath(parent: string, key: string): string {
  if (!parent) return key;
  return `${parent}.${key}`;
}

function scanValue(value: unknown, path: string, findings: BackupSecurityFinding[]) {
  if (value === null || value === undefined) return;

  if (typeof value === "string") {
    if (sensitiveValuePattern.test(value)) {
      findings.push({ path, reason: "字段值疑似包含密钥、Token 或认证头" });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${path}[${index}]`, findings));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const childPath = joinPath(path, key);
      if (sensitiveKeyPattern.test(key)) {
        findings.push({ path: childPath, reason: "字段名疑似敏感信息" });
      }
      scanValue(child, childPath, findings);
    });
  }
}

export function scanProjectBackupSecurity(project: unknown): BackupSecurityScanResult {
  const findings: BackupSecurityFinding[] = [];
  scanValue(project, "", findings);

  const uniqueFindings = [...new Map(findings.map((item) => [item.path, item])).values()];
  return {
    safe: uniqueFindings.length === 0,
    findings: uniqueFindings,
  };
}

export function summarizeBackupSecurity(result: BackupSecurityScanResult): string {
  if (result.safe) {
    return "安全检查通过，未发现疑似密钥、Token 或密码字段。";
  }

  return `发现 ${result.findings.length} 处疑似敏感信息，请确认导入/导出文件中不包含 API Key、Token、密码或认证头。`;
}
