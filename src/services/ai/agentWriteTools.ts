import type { Device, Rack, Room } from "../../types/domain";
import {
  canModifyModule,
  type AppModuleKey,
  type AuthSession,
} from "../auth/accountAccess";
import { saveDevice } from "../backend/assets";
import { writeSystemAuditLog } from "../backend/ai";
import {
  createAccessRecord,
  type AccessRecord,
  type AccessRecordInput,
} from "../../features/access-management/accessRecords";
import {
  createChangeEvent,
  type ChangeEvent,
  type ChangeEventInput,
  type ChangeEventType,
} from "../../features/change-management/changeEvents";

export interface AgentWriteDependencies {
  saveDevice?: (device: Device) => Promise<Device> | Device;
  createAccessRecord?: (input: AccessRecordInput) => AccessRecord;
  createChangeEvent?: (input: ChangeEventInput) => ChangeEvent;
  writeAuditLog?: typeof writeSystemAuditLog;
}

export interface AgentWriteCommandInput {
  question: string;
  session: AuthSession | null;
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  dependencies?: AgentWriteDependencies;
}

export interface AgentWriteCommandResult {
  status: "success" | "denied" | "ignored" | "failed";
  toolName: "write_asset" | "write_access_record" | "write_change_event";
  answer: string;
  relatedDeviceId?: string;
  relatedRackId?: string;
  relatedRoomId?: string;
}

function hasWriteIntent(question: string) {
  return /新增|添加|录入|创建|修改|更新|改成|改为|调整|保存/.test(question);
}

function deny(moduleKey: AppModuleKey, label: string, toolName: AgentWriteCommandResult["toolName"]): AgentWriteCommandResult {
  return {
    status: "denied",
    toolName,
    answer: `当前账号没有${label}修改权限，AI 助手只能查询，不能执行新增或修改。`,
  };
}

function assertPermission(
  session: AuthSession | null,
  moduleKey: AppModuleKey,
  label: string,
  toolName: AgentWriteCommandResult["toolName"],
) {
  return canModifyModule(session ?? undefined, moduleKey) ? undefined : deny(moduleKey, label, toolName);
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function findDevice(question: string, devices: Device[]) {
  const normalizedQuestion = question.toLowerCase();
  return devices.find((device) => {
    const candidates = [
      device.id,
      device.name,
      device.computerName,
      device.businessIp,
      device.managementIp,
      device.assetNo,
      device.serialNumber,
      ...device.ips,
    ].map(normalize);
    return candidates.some((candidate) => candidate && normalizedQuestion.includes(candidate));
  });
}

function findRackAndRoom(device: Device | undefined, racks: Rack[], rooms: Room[]) {
  const rack = racks.find((item) => item.id === device?.rackId);
  const room = rooms.find((item) => item.id === rack?.roomId);
  return { rack, room };
}

function extractField(question: string, label: string) {
  const pattern = new RegExp(`${label}\\s*(?:改成|改为|更新为|调整为|是|为|[:：])?\\s*([^，,。\\n]+)`);
  return question.match(pattern)?.[1]?.trim();
}

function extractAfterPrefix(question: string, prefix: RegExp) {
  return question.replace(prefix, "").trim().replace(/^[:：，,。]+/, "").trim();
}

function parseDate(question: string) {
  const explicit = question.match(/日期\s*[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)?.[1]?.replace(/\//g, "-");
  if (explicit) return explicit;
  const chinese = question.match(/(\d{4})年(\d{1,2})月(\d{1,2})(?:号|日)?/);
  if (!chinese) return undefined;
  return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
}

function parseDateTime(question: string) {
  const date = parseDate(question);
  if (!date) return new Date().toISOString();
  const time = question.match(/(\d{1,2})\s*(?:点|:)(\d{1,2})?/) ?? question.match(/(\d{1,2}):(\d{2})/);
  const hour = time?.[1]?.padStart(2, "0") ?? "00";
  const minute = time?.[2]?.padStart(2, "0") ?? "00";
  return `${date}T${hour}:${minute}:00.000Z`;
}

function parseLabelValue(question: string, label: string) {
  return question.match(new RegExp(`${label}\\s*[:：]?\\s*([^，,。\\n]+)`))?.[1]?.trim();
}

function parseRack(question: string, racks: Rack[]) {
  const rackName = parseLabelValue(question, "机柜") || question.match(/\b(\d{3}-[A-Z]\d{1,2})\b/i)?.[1];
  if (!rackName) return racks[0];
  return racks.find((rack) => rack.name.toLowerCase() === rackName.toLowerCase()) ?? racks[0];
}

function parseUPosition(question: string) {
  const range = question.match(/U位\s*[:：]?\s*(\d{1,2})\s*[-~到]\s*(\d{1,2})/i);
  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);
    const startU = Math.min(first, second);
    const endU = Math.max(first, second);
    return { startU, endU, heightU: endU - startU + 1 };
  }
  const single = question.match(/U位\s*[:：]?\s*(\d{1,2})/i);
  if (single) {
    const startU = Number(single[1]);
    return { startU, endU: startU, heightU: 1 };
  }
  return { startU: 1, endU: 1, heightU: 1 };
}

function createDeviceId(computerName?: string, businessIp?: string) {
  const raw = computerName || businessIp || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `ai-device-${raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

async function executeAssetCreate(input: AgentWriteCommandInput): Promise<AgentWriteCommandResult | null> {
  if (!/(新增|添加|录入|创建).*(服务器|物理机|资产|设备)/.test(input.question)) return null;
  const denied = assertPermission(input.session, "assets", "资产管理", "write_asset");
  if (denied) return denied;

  const computerName =
    extractField(input.question, "计算机名") ||
    extractField(input.question, "主机名") ||
    parseLabelValue(input.question, "服务器");
  const businessIp =
    extractField(input.question, "业务IP") ||
    extractField(input.question, "IP") ||
    input.question.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
  const managementIp = extractField(input.question, "带外IP") || extractField(input.question, "管理IP");
  const rack = parseRack(input.question, input.racks);
  const room = input.rooms.find((item) => item.id === rack?.roomId);
  const position = parseUPosition(input.question);

  if (!computerName && !businessIp) {
    return {
      status: "failed",
      toolName: "write_asset",
      answer: "识别到了新增资产意图，但缺少计算机名或业务 IP。可说：新增服务器：计算机名 QF-SRV-NEW，业务IP 10.10.9.9，机柜 529-A1，U位 21-22。",
    };
  }

  const device: Device = {
    id: createDeviceId(computerName, businessIp),
    rackId: rack?.id || "rack-unassigned",
    categoryId: "server",
    subtype: "物理服务器",
    name: "物理服务器",
    computerName,
    businessIp,
    managementIp,
    ips: [businessIp, managementIp].filter((item): item is string => Boolean(item)),
    purpose: extractField(input.question, "用途"),
    owner: extractField(input.question, "责任人"),
    vendor: extractField(input.question, "厂商"),
    model: extractField(input.question, "型号"),
    serialNumber: extractField(input.question, "SN") || extractField(input.question, "序列号"),
    assetNo: extractField(input.question, "固定资产编号") || extractField(input.question, "资产编号"),
    warrantyExpireAt: extractField(input.question, "维保"),
    hardwareSpec: extractField(input.question, "硬件配置"),
    operatingSystem: extractField(input.question, "操作系统"),
    side: /背面|rear/i.test(input.question) ? "rear" : "front",
    startU: position.startU,
    endU: position.endU,
    heightU: position.heightU,
    status: "normal",
    ports: [],
  };

  await (input.dependencies?.saveDevice ?? saveDevice)(device);
  input.dependencies?.writeAuditLog?.({
    action: "ai_asset.create",
    targetType: "device",
    targetId: device.id,
    summary: `AI 新增资产：${device.computerName || device.businessIp || device.name}`,
    status: "success",
    metadata: { rackId: rack?.id, roomId: room?.id },
  });

  return {
    status: "success",
    toolName: "write_asset",
    answer: `已新增资产 ${device.computerName || device.businessIp}，位置：${rack?.name || "未指定机柜"} / ${device.startU}U-${device.endU}U。`,
    relatedDeviceId: device.id,
    relatedRackId: rack?.id,
    relatedRoomId: room?.id,
  };
}

async function executeAssetUpdate(input: AgentWriteCommandInput): Promise<AgentWriteCommandResult | null> {
  if (!/(责任人|用途|业务IP|带外IP|管理IP|SN|序列号|维保|操作系统|硬件配置).*(改成|改为|更新|调整)|把.+(责任人|用途|业务IP|带外IP|管理IP)/.test(input.question)) {
    return null;
  }
  const denied = assertPermission(input.session, "assets", "资产管理", "write_asset");
  if (denied) return denied;

  const device = findDevice(input.question, input.devices);
  if (!device) {
    return {
      status: "failed",
      toolName: "write_asset",
      answer: "没有找到要修改的设备。请在指令里带上计算机名、业务 IP、带外 IP、资产编号或 SN。",
    };
  }

  const patch: Partial<Device> = {};
  const owner = extractField(input.question, "责任人");
  const purpose = extractField(input.question, "用途");
  const businessIp = extractField(input.question, "业务IP");
  const managementIp = extractField(input.question, "带外IP") || extractField(input.question, "管理IP");
  const serialNumber = extractField(input.question, "SN") || extractField(input.question, "序列号");
  const warrantyExpireAt = extractField(input.question, "维保");
  const operatingSystem = extractField(input.question, "操作系统");
  const hardwareSpec = extractField(input.question, "硬件配置");
  if (owner) patch.owner = owner;
  if (purpose) patch.purpose = purpose;
  if (businessIp) patch.businessIp = businessIp;
  if (managementIp) patch.managementIp = managementIp;
  if (serialNumber) patch.serialNumber = serialNumber;
  if (warrantyExpireAt) patch.warrantyExpireAt = warrantyExpireAt;
  if (operatingSystem) patch.operatingSystem = operatingSystem;
  if (hardwareSpec) patch.hardwareSpec = hardwareSpec;

  if (Object.keys(patch).length === 0) {
    return {
      status: "failed",
      toolName: "write_asset",
      answer: "识别到了资产修改意图，但没有识别出可更新字段。可说：把 QF-SRV-001 的责任人改成李四，用途改成虚拟化资源池。",
      relatedDeviceId: device.id,
    };
  }

  const nextDevice = { ...device, ...patch };
  await (input.dependencies?.saveDevice ?? saveDevice)(nextDevice);
  const { rack, room } = findRackAndRoom(device, input.racks, input.rooms);
  input.dependencies?.writeAuditLog?.({
    action: "ai_asset.update",
    targetType: "device",
    targetId: device.id,
    summary: `AI 更新资产：${device.computerName || device.name}`,
    status: "success",
    metadata: { patch },
  });
  return {
    status: "success",
    toolName: "write_asset",
    answer: `已更新资产 ${device.computerName || device.name}：${Object.entries(patch)
      .map(([key, value]) => `${key}=${value}`)
      .join("，")}。`,
    relatedDeviceId: device.id,
    relatedRackId: rack?.id,
    relatedRoomId: room?.id,
  };
}

function buildAccessRecordInput(input: AgentWriteCommandInput, device?: Device): AccessRecordInput {
  const today = new Date().toISOString().slice(0, 10);
  const reason = parseLabelValue(input.question, "事由") || input.question;
  return {
    date: parseDate(input.question) || today,
    unit: parseLabelValue(input.question, "单位") || "未填写单位",
    visitorName: parseLabelValue(input.question, "人员") || parseLabelValue(input.question, "姓名") || "未填写人员",
    enterTime: parseLabelValue(input.question, "进入时间") || new Date().toTimeString().slice(0, 5),
    leaveTime: parseLabelValue(input.question, "离开时间") || undefined,
    reason,
    isServerRepair: Boolean(device) || /维修|故障|服务器|物理机|虚拟机/.test(input.question),
    deviceId: device?.id,
    deviceName: device?.computerName || device?.name,
    faultDescription: /故障|重启|报警|维修/.test(input.question) ? reason : undefined,
    result: parseLabelValue(input.question, "处理结果") || undefined,
    attachments: [],
  };
}

function executeAccessCreate(input: AgentWriteCommandInput): AgentWriteCommandResult | null {
  if (!/新增.*进出|录入.*进出|添加.*进出|新增.*入场|新增.*出入/.test(input.question)) return null;
  const denied = assertPermission(input.session, "access-records", "进出管理", "write_access_record");
  if (denied) return denied;
  const device = findDevice(input.question, input.devices);
  const record = (input.dependencies?.createAccessRecord ?? createAccessRecord)(buildAccessRecordInput(input, device));
  const { rack, room } = findRackAndRoom(device, input.racks, input.rooms);
  return {
    status: "success",
    toolName: "write_access_record",
    answer: `已新增进出记录：${record.date} ${record.unit} / ${record.visitorName} / ${record.reason}。`,
    relatedDeviceId: device?.id,
    relatedRackId: rack?.id,
    relatedRoomId: room?.id,
  };
}

function isChangeCreateIntent(question: string) {
  return (
    /(变更管理|变更记录|变更).*(录入|新增|添加|创建|保存)/.test(question) ||
    /(录入|新增|添加|创建|保存).*(变更管理|变更记录|变更)/.test(question) ||
    /(上架|下架|接线|更换|维修|安装|配置调整|增加了?.*(显卡|内存|硬盘|网卡))/.test(question)
  );
}

function inferChangeType(question: string): ChangeEventType {
  if (/接线|端口|线缆/.test(question)) return "cabling";
  if (/上架/.test(question)) return "rack_mount";
  if (/下架/.test(question)) return "rack_unmount";
  if (/安装|配置|增加.*(显卡|内存|硬盘|网卡)/.test(question)) return "configuration";
  if (/巡检/.test(question)) return "inspection";
  return "maintenance";
}

function executeChangeCreate(input: AgentWriteCommandInput): AgentWriteCommandResult | null {
  if (!isChangeCreateIntent(input.question)) return null;
  const denied = assertPermission(input.session, "change-management", "变更管理", "write_change_event");
  if (denied) return denied;
  const device = findDevice(input.question, input.devices);
  const { rack, room } = findRackAndRoom(device, input.racks, input.rooms);
  const content = extractAfterPrefix(input.question, /.*?(?:变更管理|变更记录|变更).*?(?:录入|新增|添加|创建|保存)|(?:录入|新增|添加|创建|保存).*?(?:变更管理|变更记录|变更)/);
  const record = (input.dependencies?.createChangeEvent ?? createChangeEvent)({
    title: content ? content.slice(0, 60) : `${device?.computerName || device?.name || "设备"} 运维变更`,
    type: inferChangeType(input.question),
    status: /计划/.test(input.question) ? "planned" : "completed",
    roomId: room?.id,
    roomName: room?.name,
    rackId: rack?.id,
    rackName: rack?.name,
    deviceId: device?.id,
    deviceName: device?.computerName || device?.name,
    businessIp: device?.businessIp,
    operator: input.session?.username || "AI助手",
    changedAt: parseDateTime(input.question),
    content: content || input.question,
    impact: parseLabelValue(input.question, "影响范围") || "",
    result: parseLabelValue(input.question, "处理结果") || "",
    attachments: [],
  });
  return {
    status: "success",
    toolName: "write_change_event",
    answer: `已新增变更记录：${record.title}。`,
    relatedDeviceId: device?.id,
    relatedRackId: rack?.id,
    relatedRoomId: room?.id,
  };
}

export async function executeAgentWriteCommand(
  input: AgentWriteCommandInput,
): Promise<AgentWriteCommandResult | null> {
  if (!hasWriteIntent(input.question)) return null;
  return (
    executeAccessCreate(input) ??
    executeChangeCreate(input) ??
    (await executeAssetCreate(input)) ??
    (await executeAssetUpdate(input))
  );
}
