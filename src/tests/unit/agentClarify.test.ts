import { describe, expect, it } from "vitest";
import { buildAgentClarification } from "../../services/ai/agentClarify";

describe("agent clarify", () => {
  it("asks the user to choose a target module when a write command is ambiguous", () => {
    const clarification = buildAgentClarification(
      "录入服务器192.168.127.8增加了3块L20显卡",
    );

    expect(clarification?.prompt).toContain("需要确认");
    expect(clarification?.options.map((option) => option.label)).toEqual([
      "录入变更记录",
      "新增或修改资产",
      "录入进出记录",
    ]);
    expect(clarification?.options[0].value).toContain("变更管理");
  });

  it("does not ask again when the target module is explicit", () => {
    expect(
      buildAgentClarification(
        "现在在变更管理里面录入，2026年6月4号15点，服务器192.168.127.8增加了3块L20显卡",
      ),
    ).toBeNull();
  });
});
