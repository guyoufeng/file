import { resizeTableColumn, type DataTableColumn, type ResolvedDataTableColumn } from "./tableColumnPreferences";

export function useTableColumnResize(
  tableId: string,
  columns: DataTableColumn[],
  update: (columns: ResolvedDataTableColumn[]) => void,
) {
  function columnWidthStyle(column: ResolvedDataTableColumn) {
    return {
      width: `${column.width}px`,
      minWidth: `${column.minWidth ?? 92}px`,
      maxWidth: `${column.maxWidth ?? 520}px`,
    };
  }

  function startColumnResize(column: ResolvedDataTableColumn, event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = column.width;

    function move(pointerEvent: PointerEvent) {
      update(resizeTableColumn(tableId, columns, column.id, startWidth + pointerEvent.clientX - startX));
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return {
    columnWidthStyle,
    startColumnResize,
  };
}
