export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const pageSizeOptions = [20, 30, 40, 50, 100] as const;

export function paginate<T>(
  items: T[],
  state: PaginationState,
): PaginationResult<T> {
  const pageSize = pageSizeOptions.includes(
    state.pageSize as (typeof pageSizeOptions)[number],
  )
    ? state.pageSize
    : 20;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    pageCount,
  };
}

export function sortByStartedAtDesc<T extends { startedAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}
