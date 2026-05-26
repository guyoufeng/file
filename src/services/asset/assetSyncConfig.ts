export type AssetSyncType = "cmdb" | "mcp";
export type AssetSyncScope = "physical_assets" | "virtual_servers";

export interface AssetSyncConfig {
  type: AssetSyncType;
  name: string;
  baseUrl: string;
  authMode: "token" | "none";
  token?: string;
  scope: AssetSyncScope;
}

export interface AssetSyncValidationResult {
  valid: boolean;
  message: string;
}

export interface AssetSyncConnectionResult {
  ok: boolean;
  message: string;
}

export function buildAssetSyncEndpoint(type: AssetSyncType): string {
  return type === "cmdb" ? "公司CMDB资产接口" : "ZStack MCP虚拟服务器接口";
}

export function validateAssetSyncConfig(
  config: AssetSyncConfig,
): AssetSyncValidationResult {
  if (!config.name.trim()) {
    return { valid: false, message: "请输入同步名称" };
  }
  if (!config.baseUrl.trim()) {
    return { valid: false, message: "请输入接口地址" };
  }
  if (config.authMode === "token" && !config.token?.trim()) {
    return { valid: false, message: "请输入 Token" };
  }
  if (config.type === "cmdb" && config.scope !== "physical_assets") {
    return { valid: false, message: "CMDB 同步用于物理资产" };
  }
  if (config.type === "mcp" && config.scope !== "virtual_servers") {
    return { valid: false, message: "MCP 同步用于虚拟服务器" };
  }
  return { valid: true, message: "配置校验通过" };
}

export async function testAssetSyncConnection(
  config: AssetSyncConfig,
): Promise<AssetSyncConnectionResult> {
  const validation = validateAssetSyncConfig(config);
  if (!validation.valid) {
    return { ok: false, message: validation.message };
  }

  return {
    ok: true,
    message: `${buildAssetSyncEndpoint(config.type)}配置已通过本地校验，真实连通性将在适配器接入后执行。`,
  };
}
