interface ReloadableProjectStores {
  roomStore: { loadRooms: () => Promise<unknown> };
  assetStore: { loadDevices: () => Promise<unknown> };
  alertStore: { loadAlerts: () => Promise<unknown> };
  aiStore: { loadConfigs: () => Promise<unknown> };
}

export async function reloadProjectStores({
  roomStore,
  assetStore,
  alertStore,
  aiStore,
}: ReloadableProjectStores): Promise<void> {
  await Promise.all([
    roomStore.loadRooms(),
    assetStore.loadDevices(),
    alertStore.loadAlerts(),
    aiStore.loadConfigs(),
  ]);
}
