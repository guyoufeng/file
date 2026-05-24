import type { Device } from "../../types/domain";
import { sampleProject } from "./data";
import { invokeCommand } from "./invoke";

type BackendDevice = Omit<Device, "ips" | "ports" | "metadata"> & {
  ips?: string[];
  ports?: Device["ports"];
  metadata?: Device["metadata"];
  ipsJson?: string;
  metadataJson?: string;
};

type DeviceInput = Omit<Device, "ips" | "ports" | "metadata"> & {
  ipsJson: string;
  metadataJson: string;
};

const WEB_DEVICE_STORAGE_KEY = "qf-ai-dcim.devices";

function isWebStorageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readStoredDevices(): Device[] | null {
  if (!isWebStorageAvailable()) return null;
  const raw = window.localStorage.getItem(WEB_DEVICE_STORAGE_KEY);
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as Device[];
  } catch {
    return null;
  }
}

function writeStoredDevices(devices: Device[]) {
  if (!isWebStorageAvailable()) return;
  window.localStorage.setItem(WEB_DEVICE_STORAGE_KEY, JSON.stringify(devices));
}

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeDevice(device: BackendDevice): Device {
  return {
    ...device,
    ips: device.ips ?? parseJsonField<string[]>(device.ipsJson, []),
    ports: device.ports ?? [],
    metadata:
      device.metadata ??
      parseJsonField<Record<string, unknown> | undefined>(
        device.metadataJson,
        undefined,
      ),
  };
}

function toDeviceInput(device: Device): DeviceInput {
  const { ips, ports: _ports, metadata, ...input } = device;
  return {
    ...input,
    ipsJson: JSON.stringify(ips ?? []),
    metadataJson: JSON.stringify(metadata ?? {}),
  };
}

export async function getDevices(rackId?: string): Promise<Device[]> {
  try {
    const devices = (
      await invokeCommand<BackendDevice[]>("get_devices", { rackId })
    ).map(normalizeDevice);
    if (devices.length > 0) {
      return devices;
    }
    return rackId
      ? sampleProject.devices.filter((device) => device.rackId === rackId)
      : sampleProject.devices;
  } catch {
    const storedDevices = readStoredDevices();
    if (storedDevices) {
      return rackId
        ? storedDevices.filter((device) => device.rackId === rackId)
        : storedDevices;
    }
    return rackId
      ? sampleProject.devices.filter((device) => device.rackId === rackId)
      : sampleProject.devices;
  }
}

export async function saveDevice(device: Device): Promise<Device> {
  try {
    const saved = await invokeCommand<BackendDevice>("upsert_device", {
      input: toDeviceInput(device),
    });
    return normalizeDevice(saved);
  } catch {
    const storedDevices = readStoredDevices() ?? sampleProject.devices;
    const index = storedDevices.findIndex((item) => item.id === device.id);
    const nextDevices =
      index >= 0
        ? storedDevices.map((item) => (item.id === device.id ? device : item))
        : [device, ...storedDevices];
    writeStoredDevices(nextDevices);
    return device;
  }
}

export async function removeDevice(id: string): Promise<void> {
  try {
    await invokeCommand<void>("delete_device", { id });
  } catch {
    const storedDevices = readStoredDevices() ?? sampleProject.devices;
    writeStoredDevices(storedDevices.filter((device) => device.id !== id));
  }
}
