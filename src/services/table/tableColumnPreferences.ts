export interface DataTableColumn {
  id: string;
  label: string;
  visibleByDefault?: boolean;
  locked?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface ResolvedDataTableColumn extends DataTableColumn {
  visible: boolean;
  width: number;
}

interface ColumnPreference {
  id: string;
  visible: boolean;
  width?: number;
}

const STORAGE_PREFIX = "qf-ai-dcim.tableColumns";
const defaultColumnWidth = 150;
const defaultColumnMinWidth = 92;
const defaultColumnMaxWidth = 520;

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function key(tableId: string) {
  return `${STORAGE_PREFIX}.${tableId}`;
}

function defaultPreferences(columns: DataTableColumn[]): ColumnPreference[] {
  return columns.map((column) => ({
    id: column.id,
    visible: column.visibleByDefault !== false,
    width: normalizeColumnWidth(column, column.width),
  }));
}

function normalizeColumnWidth(column: DataTableColumn, width: unknown): number {
  const minWidth = column.minWidth ?? defaultColumnMinWidth;
  const maxWidth = column.maxWidth ?? defaultColumnMaxWidth;
  const numeric = typeof width === "number" && Number.isFinite(width) ? width : column.width ?? defaultColumnWidth;
  return Math.min(Math.max(Math.round(numeric), minWidth), maxWidth);
}

function readPreferences(tableId: string, columns: DataTableColumn[]): ColumnPreference[] {
  const raw = storage()?.getItem(key(tableId));
  if (!raw) return defaultPreferences(columns);
  try {
    const parsed = JSON.parse(raw) as ColumnPreference[];
    if (!Array.isArray(parsed)) return defaultPreferences(columns);
    const known = new Map(columns.map((column) => [column.id, column]));
    const existing = parsed.filter((item) => known.has(item.id));
    const missing = columns
      .filter((column) => !existing.some((item) => item.id === column.id))
      .map((column) => ({
        id: column.id,
        visible: column.visibleByDefault !== false,
        width: normalizeColumnWidth(column, column.width),
      }));
    return [...existing, ...missing].map((preference) => {
      const column = known.get(preference.id);
      return column ? { ...preference, width: normalizeColumnWidth(column, preference.width) } : preference;
    });
  } catch {
    return defaultPreferences(columns);
  }
}

function writePreferences(tableId: string, preferences: ColumnPreference[]) {
  storage()?.setItem(key(tableId), JSON.stringify(preferences));
}

export function resolveTableColumns(
  tableId: string,
  columns: DataTableColumn[],
): ResolvedDataTableColumn[] {
  const definitions = new Map(columns.map((column) => [column.id, column]));
  return readPreferences(tableId, columns)
    .map((preference) => {
      const column = definitions.get(preference.id);
      if (!column) return undefined;
      return {
        ...column,
        visible: column.locked ? true : preference.visible,
        width: normalizeColumnWidth(column, preference.width),
      };
    })
    .filter((column): column is ResolvedDataTableColumn => Boolean(column));
}

export function toggleTableColumn(
  tableId: string,
  columns: DataTableColumn[],
  columnId: string,
  visible: boolean,
) {
  const locked = columns.find((column) => column.id === columnId)?.locked;
  const preferences = readPreferences(tableId, columns).map((preference) =>
    preference.id === columnId ? { ...preference, visible: locked ? true : visible } : preference,
  );
  writePreferences(tableId, preferences);
  return resolveTableColumns(tableId, columns);
}

export function resizeTableColumn(
  tableId: string,
  columns: DataTableColumn[],
  columnId: string,
  width: number,
) {
  const column = columns.find((item) => item.id === columnId);
  const preferences = readPreferences(tableId, columns).map((preference) =>
    preference.id === columnId && column
      ? { ...preference, width: normalizeColumnWidth(column, width) }
      : preference,
  );
  writePreferences(tableId, preferences);
  return resolveTableColumns(tableId, columns);
}

export function moveTableColumn(
  tableId: string,
  columns: DataTableColumn[],
  columnId: string,
  direction: "left" | "right",
) {
  const preferences = [...readPreferences(tableId, columns)];
  const index = preferences.findIndex((item) => item.id === columnId);
  const nextIndex = direction === "left" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= preferences.length) {
    return resolveTableColumns(tableId, columns);
  }
  const [item] = preferences.splice(index, 1);
  preferences.splice(nextIndex, 0, item);
  writePreferences(tableId, preferences);
  return resolveTableColumns(tableId, columns);
}

export function resetTableColumns(tableId: string) {
  storage()?.removeItem(key(tableId));
}
