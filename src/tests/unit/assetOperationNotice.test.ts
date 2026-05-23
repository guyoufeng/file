import { describe, expect, it } from "vitest";

describe("asset operation notice", () => {
  it("builds readable error notices for asset operations", async () => {
    const { buildAssetOperationError } =
      await import("../../services/asset/operationNotice");

    expect(
      buildAssetOperationError("save", new Error("数据库写入失败")),
    ).toEqual({
      title: "设备保存失败",
      message: "数据库写入失败",
    });
    expect(buildAssetOperationError("delete", "设备仍有关联告警")).toEqual({
      title: "设备删除失败",
      message: "设备仍有关联告警",
    });
    expect(
      buildAssetOperationError("import", { message: "导入任务中断" }),
    ).toEqual({
      title: "设备导入失败",
      message: "导入任务中断",
    });
  });
});
