import type { ProjectJson, ProjectSummary } from "../backend/data";
import {
  scanProjectBackupSecurity,
  summarizeBackupSecurity,
  type BackupSecurityScanResult,
} from "./backupSecurity";

export interface ProjectImportPreviewStats {
  dataCenterCount: number;
  roomCount: number;
  microModuleCount: number;
  rackCount: number;
  deviceCount: number;
  alertCount: number;
  aiModelConfigCount: number;
}

export interface ProjectImportPreview {
  stats: ProjectImportPreviewStats;
  exportedAtText: string;
  summaryText: string;
  currentSummaryText: string;
  riskItems: string[];
  security: BackupSecurityScanResult;
  securitySummary: string;
}

function countMicroModules(project: ProjectJson): number {
  const topLevelModules = project.data.microModules?.length ?? 0;
  const roomModules =
    project.data.rooms?.reduce(
      (total, room) => total + (room.microModules?.length ?? 0),
      0,
    ) ?? 0;
  return Math.max(topLevelModules, roomModules);
}

function formatExportedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildProjectImportPreview(
  project: ProjectJson,
  currentSummary: ProjectSummary,
): ProjectImportPreview {
  const stats: ProjectImportPreviewStats = {
    dataCenterCount: project.data.dataCenters?.length ?? 0,
    roomCount: project.data.rooms?.length ?? 0,
    microModuleCount: countMicroModules(project),
    rackCount: project.data.racks?.length ?? 0,
    deviceCount: project.data.devices?.length ?? 0,
    alertCount: project.data.alerts?.length ?? 0,
    aiModelConfigCount: project.data.aiModelConfigs?.length ?? 0,
  };
  const riskItems = [
    "导入后会覆盖当前拓扑、资产和告警数据",
    "导出文件不应包含 API Key 或 Token",
  ];
  const security = scanProjectBackupSecurity(project);

  if (stats.microModuleCount === 0) {
    riskItems.push("导入文件未包含微模块布局，529 这类模块化机房可能按普通机柜布局显示");
  }
  if (!security.safe) {
    riskItems.push("导入文件存在疑似敏感信息，请先确认是否需要清理后再导入");
  }

  return {
    stats,
    exportedAtText: formatExportedAt(project.exportedAt),
    summaryText: `${stats.roomCount} 个机房、${stats.rackCount} 个机柜、${stats.deviceCount} 台设备、${stats.alertCount} 条告警、${stats.aiModelConfigCount} 个 AI 配置`,
    currentSummaryText: `当前数据：${currentSummary.roomCount} 个机房、${currentSummary.rackCount} 个机柜、${currentSummary.deviceCount} 台设备、${currentSummary.alertCount} 条告警`,
    riskItems,
    security,
    securitySummary: summarizeBackupSecurity(security),
  };
}
