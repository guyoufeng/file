import { beforeEach, describe, expect, it } from "vitest";
import {
  createGatewayPairing,
  getGatewayConfigs,
  getGatewaySessions,
  recordGatewayMessage,
  saveGatewayConfig,
} from "../../services/ai/agentMessageGateway";

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

describe("agent message gateway", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("stores gateway configs, QR pairing payloads and independent external sessions", () => {
    const wechat = saveGatewayConfig({
      provider: "wechat",
      name: "微信演示网关",
      enabled: true,
      endpoint: "http://127.0.0.1:5173/api/agent/v1/gateway/wechat",
      token: "wechat-token",
      notes: "扫码配对",
    });
    saveGatewayConfig({
      provider: "dingtalk",
      name: "钉钉网关",
      enabled: false,
      endpoint: "",
      token: "",
      notes: "",
    });

    const pairing = createGatewayPairing(wechat.id, "http://192.168.1.10:5173");
    expect(pairing.payload).toContain("wechat");
    expect(pairing.qrCells).toHaveLength(21 * 21);
    expect(getGatewayConfigs()).toHaveLength(2);

    recordGatewayMessage({
      provider: "wechat",
      externalUserId: "wx-user-a",
      displayName: "张三手机微信",
      direction: "inbound",
      content: "查 QF-SRV-001 在哪里",
    });
    recordGatewayMessage({
      provider: "dingtalk",
      externalUserId: "dt-user-b",
      displayName: "李四钉钉",
      direction: "inbound",
      content: "机房温度多少合适",
    });

    const sessions = getGatewaySessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.provider).sort()).toEqual([
      "dingtalk",
      "wechat",
    ]);
    expect(sessions[0].skillScope).toBe("shared");
  });
});
