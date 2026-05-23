export type AssetOperation = "save" | "delete" | "import";

export interface AssetOperationNotice {
  title: string;
  message: string;
}

const operationTitles: Record<AssetOperation, string> = {
  save: "设备保存失败",
  delete: "设备删除失败",
  import: "设备导入失败",
};

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "操作失败，请稍后重试";
}

export function buildAssetOperationError(
  operation: AssetOperation,
  error: unknown,
): AssetOperationNotice {
  return {
    title: operationTitles[operation],
    message: toMessage(error),
  };
}
