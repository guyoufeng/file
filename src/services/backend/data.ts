import { defaultDeviceCategories } from "../../constants/categories";
import type { AccessRecord } from "../../features/access-management/accessRecords";
import type { AiModelConfig, Alert, DataCenter, Device, MicroModule, Rack, Room } from "../../types/domain";
import { writeSystemAuditLog } from "./ai";
import { invokeCommand } from "./invoke";

export interface SampleProject {
  schemaVersion: "0.1.0";
  dataCenters: DataCenter[];
  rooms: Room[];
  microModules?: MicroModule[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  accessRecords?: AccessRecord[];
  aiModelConfigs?: AiModelConfig[];
}

export interface ProjectJson {
  schemaVersion: string;
  exportedAt: string;
  data: Partial<SampleProject>;
}

export interface ProjectSummary {
  roomCount: number;
  rackCount: number;
  deviceCount: number;
  alertCount: number;
}

export interface ProjectValidationResult {
  valid: boolean;
  message: string;
}

function createSampleProject(): SampleProject {
  const dataCenters: DataCenter[] = [
    { id: "dc-nanjing", name: "南京", location: "南京", rooms: [] },
    { id: "dc-hangzhou", name: "杭州", location: "杭州", rooms: [] },
    { id: "dc-vietnam", name: "越南", location: "越南", rooms: [] },
  ];

  const rooms: Room[] = [
    {
      id: "room-nj-529",
      dataCenterId: "dc-nanjing",
      name: "529数据中心",
      layoutType: "micro_module",
      defaultRackHeightU: 42,
      racks: [],
      microModules: [
        {
          id: "mm-529-a",
          roomId: "room-nj-529",
          name: "529华为模块1",
          rows: 2,
          columns: 10,
          rackIds: [],
        },
        {
          id: "mm-529-b",
          roomId: "room-nj-529",
          name: "529华为模块2",
          rows: 2,
          columns: 10,
          rackIds: [],
        },
      ],
    },
    {
      id: "room-nj-99",
      dataCenterId: "dc-nanjing",
      name: "99数据中心",
      layoutType: "simple_rows",
      defaultRackHeightU: 48,
      racks: [],
    },
    {
      id: "room-nj-308",
      dataCenterId: "dc-nanjing",
      name: "308数据中心",
      layoutType: "simple_rows",
      defaultRackHeightU: 48,
      racks: [],
    },
    {
      id: "room-hz-main",
      dataCenterId: "dc-hangzhou",
      name: "杭州数据中心",
      layoutType: "simple_rows",
      defaultRackHeightU: 48,
      racks: [],
    },
    {
      id: "room-vn-c7",
      dataCenterId: "dc-vietnam",
      name: "越南C7数据中心",
      layoutType: "single_rack",
      defaultRackHeightU: 48,
      racks: [],
    },
  ];

  const racks: Rack[] = [];
  const devices: Device[] = [];
  const alerts: Alert[] = [];

  const addRack = (rack: Rack) => {
    racks.push(rack);
    const room = rooms.find((item) => item.id === rack.roomId);
    room?.racks.push(rack);
    const module = room?.microModules?.find(
      (item) => item.id === rack.microModuleId,
    );
    module?.rackIds.push(rack.id);
  };

  const addDevices = (rack: Rack, rackIndex: number) => {
    const starts = [38, 30, 21, 10];
    starts.forEach((startU, index) => {
      const sequence = rackIndex * 4 + index + 1;
      const device: Device = {
        id: `dev-${sequence.toString().padStart(3, "0")}`,
        rackId: rack.id,
        categoryId: "server",
        subtype:
          index % 4 === 1
            ? "数据库服务器"
            : index % 4 === 2
              ? "虚拟化服务器"
              : index % 4 === 3
                ? "超融合服务器"
                : "物理服务器",
        name: `业务服务器-${sequence.toString().padStart(3, "0")}`,
        computerName: `QF-SRV-${sequence.toString().padStart(3, "0")}`,
        businessIp: `10.${10 + (rackIndex % 20)}.${Math.floor(sequence / 250)}.${20 + (sequence % 200)}`,
        managementIp: `172.16.${rackIndex % 50}.${20 + (sequence % 200)}`,
        ips: [],
        purpose:
          index % 3 === 0
            ? "生产业务"
            : index % 3 === 1
              ? "数据库服务"
              : "虚拟化资源池",
        owner: ["张三", "李四", "王五", "赵六"][sequence % 4],
        vendor: index % 2 === 0 ? "HPE" : "Dell",
        model: index % 2 === 0 ? "DL380 Gen10" : "PowerEdge R750",
        serialNumber: `SN${sequence.toString().padStart(8, "0")}`,
        assetNo: `IDC-SRV-${sequence.toString().padStart(4, "0")}`,
        warrantyExpireAt: "2028-12-31",
        hardwareSpec: "2CPU / 256GB RAM / 8x1.92TB SSD",
        operatingSystem: index % 2 === 0 ? "VMware ESXi 8" : "Rocky Linux 9",
        side: "front",
        startU,
        endU: startU + 3,
        heightU: 4,
        status: sequence % 37 === 0 ? "alert" : "normal",
        ports: [],
      };
      device.ips = [device.businessIp, device.managementIp].filter(
        Boolean,
      ) as string[];
      devices.push(device);
    });
  };

  const moduleRows = [
    { moduleName: "a", rows: ["A", "B"] },
    { moduleName: "b", rows: ["C", "D"] },
  ] as const;

  const coolingRacks = new Set([
    "529-A3",
    "529-A7",
    "529-B5",
    "529-C3",
    "529-C7",
    "529-D5",
  ]);
  const rowHeadRacks = new Set(["529-B1", "529-D1"]);
  const patchingRacks = new Set([
    "529-A10",
    "529-B10",
    "529-C10",
    "529-D10",
    "529-B2",
    "529-D2",
  ]);
  const networkRacks = new Set([
    "529-A8",
    "529-A9",
    "529-B9",
    "529-C8",
    "529-D9",
  ]);

  const get529RackType = (rackName: string): Rack["type"] => {
    if (coolingRacks.has(rackName)) return "cooling";
    if (rowHeadRacks.has(rackName)) return "row_head";
    if (patchingRacks.has(rackName)) return "patching";
    if (networkRacks.has(rackName)) return "network";
    return "server";
  };

  for (const module of moduleRows) {
    for (const rowLetter of module.rows) {
      for (let column = 1; column <= 10; column += 1) {
        const rackNo = `${rowLetter}${column}`;
        const rackName = `529-${rackNo}`;
        const rackType = get529RackType(rackName);
        addRack({
          id: `rack-529-${rackNo.toLowerCase()}`,
          roomId: "room-nj-529",
          microModuleId: `mm-529-${module.moduleName}`,
          name: rackName,
          type: rackType,
          rowName: `${rowLetter}排`,
          columnIndex: column,
          heightU: 42,
          status:
            column === 6 && module.moduleName === "b" ? "alert" : "normal",
          powerCapacityW: 8000,
          notes: rackType === "cooling" ? "精密空调柜位" : undefined,
        });
      }
    }
  }

  [
    ["room-nj-99", "99", 4],
    ["room-nj-308", "308", 3],
    ["room-hz-main", "HZ", 3],
    ["room-vn-c7", "C7", 2],
  ].forEach(([roomId, prefix, count]) => {
    for (let column = 1; column <= Number(count); column += 1) {
      addRack({
        id: `rack-${String(prefix).toLowerCase()}-${column.toString().padStart(2, "0")}`,
        roomId: String(roomId),
        name: `${prefix}-${column.toString().padStart(2, "0")}`,
        type: column === Number(count) ? "network" : "server",
        rowName: "A排",
        columnIndex: column,
        heightU: 48,
        status: "normal",
        powerCapacityW: 6000,
      });
    }
  });

  racks.forEach((rack, rackIndex) => addDevices(rack, rackIndex));

  devices.slice(0, 12).forEach((device, index) => {
    alerts.push({
      id: `alert-${(index + 1).toString().padStart(2, "0")}`,
      deviceId: device.id,
      source: index % 2 === 0 ? "manual" : "prometheus",
      level: index % 3 === 0 ? "critical" : "warning",
      status: index % 4 === 0 ? "acknowledged" : "unconfirmed",
      title: index % 3 === 0 ? "物理机硬件异常" : "资源使用率偏高",
      description:
        index % 3 === 0
          ? "示例硬盘或电源模块告警"
          : "示例 CPU、内存或磁盘阈值告警",
      startedAt: `2026-05-${(10 + index).toString().padStart(2, "0")}T09:00:00+08:00`,
    });
  });

  dataCenters.forEach((dataCenter) => {
    dataCenter.rooms = rooms.filter(
      (room) => room.dataCenterId === dataCenter.id,
    );
  });

  return {
    schemaVersion: "0.1.0",
    dataCenters,
    rooms,
    racks,
    devices,
    alerts,
  };
}

export const sampleProject = createSampleProject();
export const sampleDeviceCategories = defaultDeviceCategories;

export function getProjectSummary(project: ProjectJson): ProjectSummary {
  return {
    roomCount: project.data.rooms?.length ?? 0,
    rackCount: project.data.racks?.length ?? 0,
    deviceCount: project.data.devices?.length ?? 0,
    alertCount: project.data.alerts?.length ?? 0,
  };
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function collectMicroModules(rooms: Room[], racks: Rack[]): MicroModule[] {
  return rooms.flatMap((room) =>
    (room.microModules ?? []).map((module) => ({
      ...module,
      rackIds:
        (module.rackIds ?? []).length > 0
          ? module.rackIds
          : racks
              .filter((rack) => rack.microModuleId === module.id)
              .map((rack) => rack.id),
    })),
  );
}

function attachMicroModulesToRooms(
  rooms: Room[],
  racks: Rack[],
  microModules: MicroModule[] | undefined,
): Room[] {
  const modules =
    microModules && microModules.length > 0
      ? microModules
      : collectMicroModules(rooms, racks);

  return rooms.map((room) => {
    const roomModules = modules
      .filter((module) => module.roomId === room.id)
      .map((module) => ({
        ...module,
        rackIds:
          (module.rackIds ?? []).length > 0
            ? module.rackIds
            : racks
                .filter((rack) => rack.microModuleId === module.id)
                .map((rack) => rack.id),
      }));

    return roomModules.length > 0 ? { ...room, microModules: roomModules } : room;
  });
}

export function sanitizeProjectJson(project: ProjectJson): ProjectJson {
  const configs = project.data.aiModelConfigs?.map((config) => {
    const { apiKeyRef: _apiKeyRef, ...safeConfig } = config;
    return safeConfig;
  });

  return {
    ...project,
    data: {
      ...project.data,
      ...(configs ? { aiModelConfigs: configs as AiModelConfig[] } : {}),
    },
  };
}

export function buildProjectJson(data: SampleProject): ProjectJson {
  const project: ProjectJson = {
    schemaVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    data: {
      ...data,
      dataCenters: readLocalJson<DataCenter[]>(
        "qf-ai-dcim.dataCenters",
        data.dataCenters,
      ),
      rooms: readLocalJson<Room[]>("qf-ai-dcim.rooms", data.rooms),
      racks: readLocalJson<Rack[]>("qf-ai-dcim.racks", data.racks),
      devices: readLocalJson<Device[]>("qf-ai-dcim.devices", data.devices),
      alerts: readLocalJson<Alert[]>("qf-ai-dcim.alerts", data.alerts),
      accessRecords: readLocalJson<AccessRecord[]>(
        "qf-ai-dcim.accessRecords",
        data.accessRecords ?? [],
      ),
      aiModelConfigs: readLocalJson<AiModelConfig[]>(
        "qf-ai-dcim.aiModelConfigs",
        data.aiModelConfigs ?? [],
      ),
    },
  };
  const rooms = project.data.rooms ?? [];
  const racks = project.data.racks ?? [];
  project.data.microModules = collectMicroModules(rooms, racks);

  return sanitizeProjectJson(project);
}

export function validateProjectJson(value: unknown): ProjectValidationResult {
  if (!value || typeof value !== "object") {
    return { valid: false, message: "项目 JSON 格式不正确" };
  }

  const project = value as Partial<ProjectJson>;
  if (project.schemaVersion !== "0.1.0") {
    return { valid: false, message: "仅支持 v0.1.0 项目 JSON" };
  }

  if (!project.data || typeof project.data !== "object") {
    return { valid: false, message: "项目 JSON 缺少 data 节点" };
  }

  const data = project.data as Partial<SampleProject>;
  if (
    !Array.isArray(data.rooms) ||
    !Array.isArray(data.racks) ||
    !Array.isArray(data.devices) ||
    !Array.isArray(data.alerts)
  ) {
    return {
      valid: false,
      message: "项目 JSON 缺少 rooms、racks、devices 或 alerts 集合",
    };
  }

  return { valid: true, message: "项目 JSON 校验通过" };
}

export async function exportProjectJson(): Promise<ProjectJson> {
  try {
    return sanitizeProjectJson(await invokeCommand<ProjectJson>("export_project_json"));
  } catch {
    return buildProjectJson(sampleProject);
  }
}

export async function importProjectJson(project: ProjectJson): Promise<void> {
  const validation = validateProjectJson(project);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  try {
    await invokeCommand<void>("import_project_json", { project });
  } catch {
    writeLocalJson("qf-ai-dcim.dataCenters", project.data.dataCenters ?? []);
    const racks = project.data.racks ?? [];
    const rooms = attachMicroModulesToRooms(
      project.data.rooms ?? [],
      racks,
      project.data.microModules,
    );
    writeLocalJson("qf-ai-dcim.rooms", rooms);
    writeLocalJson("qf-ai-dcim.racks", racks);
    writeLocalJson("qf-ai-dcim.devices", project.data.devices ?? []);
    writeLocalJson("qf-ai-dcim.alerts", project.data.alerts ?? []);
    writeLocalJson("qf-ai-dcim.accessRecords", project.data.accessRecords ?? []);
    writeLocalJson("qf-ai-dcim.aiModelConfigs", project.data.aiModelConfigs ?? []);
  }

  const summary = getProjectSummary(project);
  writeSystemAuditLog({
    action: "project.import_json",
    targetType: "project",
    summary: `导入项目 JSON：${summary.roomCount} 个机房、${summary.rackCount} 个机柜、${summary.deviceCount} 台设备、${summary.alertCount} 条告警`,
    status: "success",
    metadata: summary,
  });
}

export async function restoreSampleProject(): Promise<void> {
  try {
    await invokeCommand<void>("restore_sample_data", { confirmed: true });
  } catch {
    writeLocalJson("qf-ai-dcim.dataCenters", sampleProject.dataCenters);
    writeLocalJson("qf-ai-dcim.rooms", sampleProject.rooms);
    writeLocalJson("qf-ai-dcim.racks", sampleProject.racks);
    writeLocalJson("qf-ai-dcim.devices", sampleProject.devices);
    writeLocalJson("qf-ai-dcim.alerts", sampleProject.alerts);
    writeLocalJson("qf-ai-dcim.accessRecords", []);
    writeLocalJson("qf-ai-dcim.aiModelConfigs", []);
  }

  writeSystemAuditLog({
    action: "project.restore_sample",
    targetType: "project",
    summary: "恢复 v0.1 示例数据",
    status: "success",
    metadata: {
      roomCount: sampleProject.rooms.length,
      rackCount: sampleProject.racks.length,
      deviceCount: sampleProject.devices.length,
      alertCount: sampleProject.alerts.length,
    },
  });
}
