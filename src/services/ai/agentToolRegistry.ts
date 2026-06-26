import type { AiToolName } from "./aiTools";

export interface QfAgentToolDefinition {
  name: AiToolName;
  label: string;
  description: string;
  readonly: true;
  inputSchema: Record<string, string>;
}

export const qfAgentTools: QfAgentToolDefinition[] = [
  {
    name: "locate_device",
    label: "定位设备",
    description: "根据 IP、计算机名、资产编号、SN 等查询设备所在机房、机柜和 U 位。",
    readonly: true,
    inputSchema: {
      query: "用户输入的 IP、计算机名、资产编号、SN 或自然语言问题。",
    },
  },
  {
    name: "search_devices",
    label: "搜索资产",
    description: "搜索设备资产详情、责任人、用途、业务 IP、带外 IP、硬件配置等信息。",
    readonly: true,
    inputSchema: {
      query: "设备关键字、责任人、用途、型号、IP 网段或自然语言问题。",
    },
  },
  {
    name: "list_rack_devices",
    label: "机柜盘点",
    description: "查询指定机柜中的设备清单、U 位占用和告警情况。",
    readonly: true,
    inputSchema: {
      query: "机柜名称或自然语言问题。",
    },
  },
  {
    name: "list_room_devices",
    label: "机房汇总",
    description: "查询指定机房的机柜数量、设备数量和状态概览。",
    readonly: true,
    inputSchema: {
      query: "机房名称或自然语言问题。",
    },
  },
  {
    name: "list_alert_devices",
    label: "告警查询",
    description: "查询活动告警、设备告警详情、处理状态和告警排行。",
    readonly: true,
    inputSchema: {
      query: "告警、报警、故障、异常、处理状态相关问题。",
    },
  },
  {
    name: "search_alerts",
    label: "告警中心查询",
    description: "查询告警中心记录总数、活动告警、级别统计、未匹配 webhook 告警和告警明细。",
    readonly: true,
    inputSchema: {
      query: "告警中心、告警记录、报警数据或自然语言问题。",
    },
  },
  {
    name: "search_virtual_servers",
    label: "虚拟服务器查询",
    description: "查询虚拟机、云主机、ZStack 虚拟服务器及宿主物理机关系。",
    readonly: true,
    inputSchema: {
      query: "虚拟机名称、业务 IP、宿主或自然语言问题。",
    },
  },
  {
    name: "search_audit_logs",
    label: "审计查询",
    description: "查询 AI 查询记录、导入记录、修改记录和系统操作审计。",
    readonly: true,
    inputSchema: {
      query: "审计、操作记录、历史记录、导入记录相关问题。",
    },
  },
  {
    name: "search_access_records",
    label: "进出管理查询",
    description: "查询数据中心进出、维修入场、故障处理记录和附件说明。",
    readonly: true,
    inputSchema: {
      query: "日期、单位、人员、服务器、故障、维修或自然语言问题。",
    },
  },
  {
    name: "search_change_events",
    label: "变更查询",
    description: "查询物理机上架、下架、接线、维修、安装和配置调整等变更记录。",
    readonly: true,
    inputSchema: {
      query: "服务器、业务 IP、机柜、变更类型、操作人或自然语言问题。",
    },
  },
  {
    name: "search_connections",
    label: "连线查询",
    description: "查询服务器、交换机、端口、线缆编号和对端关系。",
    readonly: true,
    inputSchema: {
      query: "服务器名、交换机名、端口、线缆编号或自然语言问题。",
    },
  },
  {
    name: "summarize_room_status",
    label: "运行概览",
    description: "汇总当前机房、机柜、设备和活动告警数量。",
    readonly: true,
    inputSchema: {
      query: "整体状态、运行概览、平台能查询什么等问题。",
    },
  },
];

export function isQfAgentToolName(value: string): value is AiToolName {
  return qfAgentTools.some((tool) => tool.name === value);
}

export function formatQfAgentToolCatalog(): string {
  return qfAgentTools
    .map(
      (tool) =>
        `- ${tool.name}（${tool.label}）：${tool.description} 输入：${Object.keys(tool.inputSchema).join("、")}`,
    )
    .join("\n");
}
