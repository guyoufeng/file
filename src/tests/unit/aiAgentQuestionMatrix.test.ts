import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig } from "../../types/domain";
import { sampleProject } from "../../services/backend/data";

const chat = vi.fn();

vi.mock("../../services/ai/aiGateway", () => ({
  getProviderAdapter: () => ({
    name: "openai-compatible",
    chat,
  }),
}));

const config: AiModelConfig = {
  id: "ai-config-gpustack-default",
  provider: "gpustack",
  name: "GPUStack qwen3.6-35b-a3b-awq",
  baseUrl: "http://192.168.127.8/v1",
  model: "qwen3.6-35b-a3b-awq",
  apiKeyRef: "secret",
  enabled: true,
};

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

const platformQuestions = [
  "IP 为 10.10.0.21 的服务器在哪里？",
  "QF-SRV-001 的用途是什么？",
  "QF-SRV-002 责任人是谁？",
  "SN00000003 对应哪台设备？",
  "IDC-SRV-0004 资产编号是什么设备？",
  "529-A1 有哪些设备？",
  "529数据中心有哪些服务器？",
  "当前有哪些告警？",
  "哪个机柜告警最多？",
  "QF-SRV-001 最近有没有告警？",
  "172.16.0.21 这台带外IP在哪？",
  "张三负责哪些服务器？",
  "未来90天哪些设备维保到期？",
  "哪些设备缺少带外IP？",
  "MES-VM-APP-01 虚拟机在哪个宿主？",
  "192.168.129.51 这台虚拟服务器是什么用途？",
  "查看审计日志",
  "最近导入记录谁操作的？",
  "529-A6 机柜设备清单",
  "308数据中心有哪些设备？",
];

const genericQuestions = [
  "机房推荐的参考温度多少度合适？",
  "数据中心日常维护要注意什么？",
  "服务器内存条坏了怎么维修？",
  "物理机 ECC 报警如何处理？",
  "CPU 报警阈值设置多少合适？",
  "内存使用率报警阈值多少合适？",
  "磁盘阵列出现坏盘怎么处理？",
  "UPS 巡检要注意什么？",
  "精密空调漏水怎么排查？",
  "交换机端口 CRC 错误如何排查？",
  "服务器风扇故障怎么处理？",
  "虚拟化集群维护前要做哪些准备？",
  "机房灰尘治理有什么建议？",
  "双电源服务器如何安排检修？",
  "数据库服务器巡检关注哪些指标？",
  "服务器上架前要检查哪些项目？",
  "带外管理口登录失败通常有哪些原因？",
  "RAID 重建期间要注意什么？",
  "机房消防系统维护注意什么？",
  "如何制定月度巡检报告？",
];

describe("AI agent 40-question routing matrix", () => {
  beforeEach(() => {
    installLocalStorage();
    chat.mockReset();
  });

  it.each(platformQuestions)("routes platform query through readonly tools: %s", async (question) => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");

    const result = await runQfAiAgent({
      question,
      configs: [],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).not.toBe("general_chat");
    expect(result.answer).not.toContain("当前平台已纳管");
  });

  it.each(genericQuestions)("routes general operations question to the selected model: %s", async (question) => {
    const { runQfAiAgent } = await import("../../services/ai/agentRuntime");
    chat.mockResolvedValueOnce(`模型回答：${question}`);

    const result = await runQfAiAgent({
      question,
      configs: [config],
      rooms: sampleProject.rooms,
      racks: sampleProject.racks,
      devices: sampleProject.devices,
      alerts: sampleProject.alerts,
      dataSource: "只读 Agent API",
    });

    expect(result.toolName).toBe("general_chat");
    expect(result.answer).toContain("模型回答");
    expect(result.usedModel).toBe("qwen3.6-35b-a3b-awq");
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
