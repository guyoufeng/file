import type { Device, Rack, Room } from "../../types/domain";
import type { AccessRecordInput } from "../../features/access-management/accessRecords";
import type { ChangeEventInput, ChangeEventStatus, ChangeEventType } from "../../features/change-management/changeEvents";

export type AgentWriteDraftKind = "access_record" | "change_event" | "asset_update";
export type AgentWriteDraftFieldType = "text" | "textarea" | "date" | "time" | "datetime-local" | "select" | "checkbox";

export interface AgentWriteDraftField {
  key: string;
  label: string;
  type: AgentWriteDraftFieldType;
  value: string | boolean;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface AgentWriteDraft {
  id: string;
  kind: AgentWriteDraftKind;
  title: string;
  prompt: string;
  targetDeviceId?: string;
  targetRackId?: string;
  targetRoomId?: string;
  fields: AgentWriteDraftField[];
}

export interface AgentWriteDraftInput {
  question: string;
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  lastTarget?: {
    deviceId?: string;
    rackId?: string;
    roomId?: string;
  };
}

const statusOptions: Array<{ label: string; value: ChangeEventStatus }> = [
  { label: "计划中", value: "planned" },
  { label: "进行中", value: "in_progress" },
  { label: "已完成", value: "completed" },
  { label: "已复核", value: "reviewed" },
  { label: "已取消", value: "cancelled" },
];

const changeTypeOptions: Array<{ label: string; value: ChangeEventType }> = [
  { label: "物理机上架", value: "rack_mount" },
  { label: "物理机下架", value: "rack_unmount" },
  { label: "维修维护", value: "maintenance" },
  { label: "接线调整", value: "cabling" },
  { label: "软件安装", value: "software" },
  { label: "配置修改", value: "configuration" },
  { label: "巡检复核", value: "inspection" },
  { label: "其他", value: "other" },
];

function draftId(kind: AgentWriteDraftKind) {
  return `draft-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseDate(question: string) {
  const explicit = question.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)?.slice(1, 4);
  const chinese = question.match(/(\d{4})年(\d{1,2})月(\d{1,2})(?:号|日)?/)?.slice(1, 4);
  const parts = explicit ?? chinese;
  if (!parts) return new Date().toISOString().slice(0, 10);
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

function parseTime(question: string) {
  const match = question.match(/(\d{1,2})[:点](\d{1,2})?/) ?? question.match(/(\d{1,2})时(\d{1,2})?/);
  if (!match) return "09:00";
  return `${match[1].padStart(2, "0")}:${(match[2] ?? "00").padStart(2, "0")}`;
}

function parseDateTimeLocal(question: string) {
  return `${parseDate(question)}T${parseTime(question)}`;
}

function normalize(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function findDevice(question: string, devices: Device[], lastTarget?: AgentWriteDraftInput["lastTarget"]) {
  const byTarget = devices.find((device) => device.id === lastTarget?.deviceId);
  if (byTarget && /这台|该服务器|这个服务器|更新这台|修改这台/.test(question)) return byTarget;
  const text = question.toLowerCase();
  return devices.find((device) =>
    [
      device.id,
      device.name,
      device.computerName,
      device.businessIp,
      device.managementIp,
      device.assetNo,
      device.serialNumber,
      ...device.ips,
    ]
      .map(normalize)
      .some((candidate) => candidate && text.includes(candidate)),
  );
}

function findRackAndRoom(device: Device | undefined, racks: Rack[], rooms: Room[]) {
  const rack = racks.find((item) => item.id === device?.rackId);
  const room = rooms.find((item) => item.id === rack?.roomId);
  return { rack, room };
}

function extractAfterManagementIntent(question: string, moduleName: string) {
  const pattern = new RegExp(`.*?(?:${moduleName}).*?(?:录入|新增|添加|创建|保存|填写|登记)`);
  return question.replace(pattern, "").replace(/^信息[，,：:]?/, "").trim() || question;
}

function inferAccessUnit(question: string) {
  if (/保洁/.test(question)) return "保洁";
  if (/供应商|厂家|维保/.test(question)) return "供应商";
  if (/参观|访客/.test(question)) return "访客";
  return "未填写单位";
}

function inferChangeType(question: string): ChangeEventType {
  if (/接线|网线|端口|光纤|线缆/.test(question)) return "cabling";
  if (/上架/.test(question)) return "rack_mount";
  if (/下架/.test(question)) return "rack_unmount";
  if (/安装|增加.*(显卡|内存|硬盘|网卡)|配置/.test(question)) return "configuration";
  if (/巡检/.test(question)) return "inspection";
  return "maintenance";
}

function buildDeviceOptions(devices: Device[]) {
  return [
    { label: "不关联具体设备", value: "" },
    ...devices.slice(0, 200).map((device) => ({
      label: `${device.computerName || device.name} / ${device.businessIp || "无业务IP"}`,
      value: device.id,
    })),
  ];
}

function extractShortPatchValue(question: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = question.match(
    new RegExp(`(?:${escaped})(?:改为|改成|修改为|更新为|调整为|是|为)\\s*([^，,。；;\\n]+)`),
  );
  return match?.[1]?.trim();
}

function buildAssetPatchFromQuestion(question: string) {
  return {
    computerName: extractShortPatchValue(question, ["计算机名", "主机名", "服务器名"]),
    businessIp: extractShortPatchValue(question, ["业务IP", "业务ip", "IP地址", "ip地址", "IP", "ip"]),
    managementIp: extractShortPatchValue(question, ["带外IP", "带外ip", "管理IP", "管理ip", "BMC", "ilo", "iLO"]),
    purpose: extractShortPatchValue(question, ["用途", "业务用途"]),
    owner: extractShortPatchValue(question, ["责任人", "负责人", "管理员"]),
    hardwareSpec: extractShortPatchValue(question, ["硬件配置", "配置"]),
  };
}

function buildAccessDraft(input: AgentWriteDraftInput, device?: Device): AgentWriteDraft {
  const reason = extractAfterManagementIntent(input.question, "进出管理|进出记录|出入记录");
  return {
    id: draftId("access_record"),
    kind: "access_record",
    title: "请确认进出记录",
    prompt: "我识别到你要录入数据中心进出记录。请检查下面字段，确认后我再写入平台。",
    targetDeviceId: device?.id,
    fields: [
      { key: "date", label: "日期", type: "date", value: parseDate(input.question), required: true },
      { key: "unit", label: "单位", type: "text", value: inferAccessUnit(input.question), required: true },
      { key: "visitorName", label: "进入人员", type: "text", value: inferAccessUnit(input.question), required: true },
      { key: "enterTime", label: "进入时间", type: "time", value: parseTime(input.question), required: true },
      { key: "leaveTime", label: "离开时间", type: "time", value: "" },
      { key: "reason", label: "事由", type: "textarea", value: reason, required: true },
      { key: "isServerRepair", label: "是否物理机维修", type: "checkbox", value: Boolean(device) || /维修|故障|服务器|物理机/.test(input.question) },
      { key: "deviceId", label: "关联服务器", type: "select", value: device?.id ?? "", options: buildDeviceOptions(input.devices) },
      { key: "faultDescription", label: "故障描述", type: "textarea", value: /故障|维修|报警|重启/.test(input.question) ? reason : "" },
      { key: "result", label: "处理结果", type: "textarea", value: "" },
    ],
  };
}

function buildChangeDraft(input: AgentWriteDraftInput, device?: Device): AgentWriteDraft {
  const { rack, room } = findRackAndRoom(device, input.racks, input.rooms);
  const content = extractAfterManagementIntent(input.question, "变更管理|变更记录|变更");
  return {
    id: draftId("change_event"),
    kind: "change_event",
    title: "请确认变更记录",
    prompt: "我识别到你要录入变更记录。请检查下面字段，确认后我再写入变更管理。",
    targetDeviceId: device?.id,
    targetRackId: rack?.id,
    targetRoomId: room?.id,
    fields: [
      { key: "title", label: "变更标题", type: "text", value: content.slice(0, 60) || "运维变更记录", required: true },
      { key: "type", label: "变更类型", type: "select", value: inferChangeType(input.question), options: changeTypeOptions },
      { key: "status", label: "状态", type: "select", value: /计划/.test(input.question) ? "planned" : "completed", options: statusOptions },
      { key: "deviceId", label: "关联物理设备", type: "select", value: device?.id ?? "", options: buildDeviceOptions(input.devices) },
      { key: "deviceName", label: "设备名称", type: "text", value: device?.computerName || device?.name || "" },
      { key: "changedAt", label: "变更时间", type: "datetime-local", value: parseDateTimeLocal(input.question), required: true },
      { key: "operator", label: "操作人", type: "text", value: "AI助手" },
      { key: "content", label: "变更内容", type: "textarea", value: content || input.question, required: true },
      { key: "impact", label: "影响范围", type: "text", value: "" },
      { key: "result", label: "处理结果", type: "text", value: "" },
    ],
  };
}

function buildAssetUpdateDraft(input: AgentWriteDraftInput, device?: Device): AgentWriteDraft | null {
  if (!device || !/(更新|修改|改成|改为|调整).*(服务器|资产|这台|设备|信息)/.test(input.question)) return null;
  const { rack, room } = findRackAndRoom(device, input.racks, input.rooms);
  const patch = buildAssetPatchFromQuestion(input.question);
  return {
    id: draftId("asset_update"),
    kind: "asset_update",
    title: "请确认资产信息更新",
    prompt: "我识别到你要更新服务器资产信息。请填写要修改的字段，确认后我再更新资产。",
    targetDeviceId: device.id,
    targetRackId: rack?.id,
    targetRoomId: room?.id,
    fields: [
      { key: "computerName", label: "计算机名", type: "text", value: patch.computerName || device.computerName || "" },
      { key: "businessIp", label: "业务IP", type: "text", value: patch.businessIp || device.businessIp || "" },
      { key: "managementIp", label: "带外IP", type: "text", value: patch.managementIp || device.managementIp || "" },
      { key: "purpose", label: "用途", type: "text", value: patch.purpose || device.purpose || "" },
      { key: "owner", label: "责任人", type: "text", value: patch.owner || device.owner || "" },
      { key: "hardwareSpec", label: "硬件配置", type: "textarea", value: patch.hardwareSpec || device.hardwareSpec || "" },
    ],
  };
}

export function buildAgentWriteDraft(input: AgentWriteDraftInput): AgentWriteDraft | null {
  const device = findDevice(input.question, input.devices, input.lastTarget);
  if (/进出管理|进出记录|出入记录/.test(input.question) && /录入|新增|添加|创建|登记|填写/.test(input.question)) {
    return buildAccessDraft(input, device);
  }
  if (/(变更管理|变更记录|变更).*(录入|新增|添加|创建|登记|填写)|(?:录入|新增|添加|创建|登记|填写).*(变更管理|变更记录|变更)/.test(input.question)) {
    return buildChangeDraft(input, device);
  }
  return buildAssetUpdateDraft(input, device);
}

export function updateAgentWriteDraftField(
  draft: AgentWriteDraft,
  key: string,
  value: string | boolean,
): AgentWriteDraft {
  return {
    ...draft,
    fields: draft.fields.map((field) => (field.key === key ? { ...field, value } : field)),
  };
}

function fieldValue(draft: AgentWriteDraft, key: string) {
  return draft.fields.find((field) => field.key === key)?.value;
}

export function toAccessRecordInput(draft: AgentWriteDraft): AccessRecordInput {
  return {
    date: String(fieldValue(draft, "date") || new Date().toISOString().slice(0, 10)),
    unit: String(fieldValue(draft, "unit") || "未填写单位"),
    visitorName: String(fieldValue(draft, "visitorName") || "未填写人员"),
    enterTime: String(fieldValue(draft, "enterTime") || "09:00"),
    leaveTime: String(fieldValue(draft, "leaveTime") || "") || undefined,
    reason: String(fieldValue(draft, "reason") || "AI助手录入"),
    isServerRepair: Boolean(fieldValue(draft, "isServerRepair")),
    deviceId: String(fieldValue(draft, "deviceId") || "") || undefined,
    faultDescription: String(fieldValue(draft, "faultDescription") || "") || undefined,
    result: String(fieldValue(draft, "result") || "") || undefined,
    attachments: [],
  };
}

export function toChangeEventInput(draft: AgentWriteDraft, devices: Device[], racks: Rack[], rooms: Room[]): ChangeEventInput {
  const device = devices.find((item) => item.id === fieldValue(draft, "deviceId"));
  const { rack, room } = findRackAndRoom(device, racks, rooms);
  const changedAt = String(fieldValue(draft, "changedAt") || new Date().toISOString().slice(0, 16));
  return {
    title: String(fieldValue(draft, "title") || "AI助手变更记录"),
    type: String(fieldValue(draft, "type") || "maintenance") as ChangeEventType,
    status: String(fieldValue(draft, "status") || "completed") as ChangeEventStatus,
    roomId: room?.id,
    roomName: room?.name,
    rackId: rack?.id,
    rackName: rack?.name,
    deviceId: device?.id,
    deviceName: device?.computerName || device?.name,
    businessIp: device?.businessIp,
    operator: String(fieldValue(draft, "operator") || "AI助手"),
    changedAt: new Date(changedAt).toISOString(),
    content: String(fieldValue(draft, "content") || "AI助手录入"),
    impact: String(fieldValue(draft, "impact") || ""),
    result: String(fieldValue(draft, "result") || ""),
    attachments: [],
  };
}
