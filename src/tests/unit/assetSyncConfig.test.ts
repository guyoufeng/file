import { describe, expect, it } from "vitest";
import {
  buildAssetSyncEndpoint,
  testAssetSyncConnection,
  validateAssetSyncConfig,
} from "../../services/asset/assetSyncConfig";

describe("asset sync config", () => {
  it("validates CMDB sync configuration", () => {
    const result = validateAssetSyncConfig({
      type: "cmdb",
      name: "公司CMDB",
      baseUrl: "https://cmdb.example.com/api",
      authMode: "token",
      token: "cmdb-token",
      scope: "physical_assets",
    });

    expect(result.valid).toBe(true);
  });

  it("validates MCP sync configuration for ZStack virtual servers", () => {
    const result = validateAssetSyncConfig({
      type: "mcp",
      name: "ZStack MCP",
      baseUrl: "http://zstack-mcp.local",
      authMode: "token",
      token: "mcp-token",
      scope: "virtual_servers",
    });

    expect(result.valid).toBe(true);
    expect(buildAssetSyncEndpoint("mcp")).toContain("ZStack");
  });

  it("rejects missing url or token before testing connection", async () => {
    const config = {
      type: "cmdb" as const,
      name: "公司CMDB",
      baseUrl: "",
      authMode: "token" as const,
      token: "",
      scope: "physical_assets" as const,
    };

    expect(validateAssetSyncConfig(config).valid).toBe(false);
    await expect(testAssetSyncConnection(config)).resolves.toMatchObject({
      ok: false,
    });
  });
});
