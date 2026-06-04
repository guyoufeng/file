export type PersistenceBackendType = "browser-local" | "tauri-sqlite" | "remote-api";

export interface PersistenceBackendInfo {
  type: PersistenceBackendType;
  namespace: string;
  sqliteReady: boolean;
  tauriReady: boolean;
}

export interface PersistentCollectionOptions {
  name: string;
  legacyKeys?: string[];
  maxRecords?: number;
}

export interface PersistentCollection<T> {
  key: string;
  read(): T[];
  write(records: T[]): void;
  clear(): void;
}

const DATA_NAMESPACE = "qf-ai-dcim.data";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function collectionKey(name: string) {
  return `${DATA_NAMESPACE}.${name}`;
}

function parseRecords<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateLegacyKeys<T>(key: string, legacyKeys: string[]) {
  const store = storage();
  if (!store || store.getItem(key)) return;
  for (const legacyKey of legacyKeys) {
    const legacyRecords = parseRecords<T>(store.getItem(legacyKey));
    if (legacyRecords.length === 0) continue;
    store.setItem(key, JSON.stringify(legacyRecords));
    store.removeItem(legacyKey);
    return;
  }
}

export function createPersistentCollection<T>(
  options: PersistentCollectionOptions,
): PersistentCollection<T> {
  const key = collectionKey(options.name);
  migrateLegacyKeys<T>(key, options.legacyKeys ?? []);
  return {
    key,
    read() {
      return parseRecords<T>(storage()?.getItem(key) ?? null);
    },
    write(records: T[]) {
      storage()?.setItem(
        key,
        JSON.stringify(
          typeof options.maxRecords === "number"
            ? records.slice(0, options.maxRecords)
            : records,
        ),
      );
    },
    clear() {
      storage()?.removeItem(key);
    },
  };
}

export function getPersistenceBackendInfo(): PersistenceBackendInfo {
  const hasTauri = typeof window !== "undefined" && "__TAURI__" in window;
  return {
    type: "browser-local",
    namespace: DATA_NAMESPACE,
    sqliteReady: false,
    tauriReady: hasTauri,
  };
}
