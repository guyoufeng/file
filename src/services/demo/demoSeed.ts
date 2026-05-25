const DEMO_SEED_ENDPOINT = "/__demo_seed";

const seedStorageKeys = {
  dataCenters: "qf-ai-dcim.dataCenters",
  rooms: "qf-ai-dcim.rooms",
  racks: "qf-ai-dcim.racks",
  devices: "qf-ai-dcim.devices",
  alerts: "qf-ai-dcim.alerts",
  aiModelConfigs: "qf-ai-dcim.aiModelConfigs",
  aiAgentCapabilities: "qf-ai-dcim.aiAgentCapabilities",
  auditLogs: "qf-ai-dcim.auditLogs",
} as const;

export type DemoSeed = Partial<Record<keyof typeof seedStorageKeys, unknown>>;

function hasLocalAssetData() {
  if (typeof localStorage === "undefined") return true;
  return Boolean(localStorage.getItem(seedStorageKeys.devices));
}

function isLanDemoHost() {
  if (typeof location === "undefined") return false;
  return !["127.0.0.1", "localhost"].includes(location.hostname);
}

export function applyDemoSeed(seed: DemoSeed) {
  if (typeof localStorage === "undefined" || hasLocalAssetData()) return false;

  Object.entries(seedStorageKeys).forEach(([seedKey, storageKey]) => {
    const value = seed[seedKey as keyof DemoSeed];
    if (value !== undefined) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  });

  localStorage.setItem("qf-ai-dcim.demoSeedAppliedAt", new Date().toISOString());
  return true;
}

export async function loadDemoSeedIfAvailable() {
  if (typeof fetch === "undefined" || !isLanDemoHost() || hasLocalAssetData()) return false;

  try {
    const response = await fetch(DEMO_SEED_ENDPOINT);
    if (!response.ok) return false;
    return applyDemoSeed((await response.json()) as DemoSeed);
  } catch {
    return false;
  }
}
