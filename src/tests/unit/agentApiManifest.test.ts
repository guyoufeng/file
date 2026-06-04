import { describe, expect, it } from "vitest";
import {
  buildAgentOpenApiDocument,
  getAgentReadonlyTools,
  getAgentWriteTools,
} from "../../services/agent/apiManifest";

describe("agent api manifest", () => {
  it("describes readonly tools for external ai agents", () => {
    const tools = getAgentReadonlyTools("http://127.0.0.1:5200/api/agent/v1");

    expect(tools.map((tool) => tool.name)).toEqual([
      "agent_health",
      "agent_get_topology",
      "agent_list_rooms",
      "agent_list_racks",
      "agent_search_devices",
      "agent_list_alerts",
      "agent_search_audit_logs",
      "agent_search_access_records",
      "agent_search_change_events",
      "agent_search_connections",
    ]);
    expect(tools.find((tool) => tool.name === "agent_search_devices")).toMatchObject({
      method: "GET",
      path: "/devices",
      readonly: true,
    });
  });

  it("builds an openapi document with no write operations", () => {
    const doc = buildAgentOpenApiDocument("http://127.0.0.1:5200/api/agent/v1");

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0].url).toBe("http://127.0.0.1:5200/api/agent/v1");
    expect(Object.keys(doc.paths)).toContain("/devices");
    expect(Object.keys(doc.paths)).toContain("/change-events");
    expect(Object.keys(doc.paths)).toContain("/connections");
    expect(Object.values(doc.paths).every((pathItem) => !("post" in pathItem))).toBe(true);
  });

  it("documents bearer token security for readonly external agents", () => {
    const doc = buildAgentOpenApiDocument("http://127.0.0.1:5200/api/agent/v1");

    expect(doc.components?.securitySchemes?.readonlyAgentToken).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(doc.security).toEqual([{ readonlyAgentToken: [] }]);
  });

  it("exposes write tools only when the OpenAPI document is explicitly built for write agents", () => {
    const baseUrl = "http://127.0.0.1:5200/api/agent/v1";
    const tools = getAgentWriteTools(baseUrl);
    const doc = buildAgentOpenApiDocument(baseUrl, { includeWriteTools: true });

    expect(tools.map((tool) => tool.name)).toEqual([
      "agent_create_or_update_device",
      "agent_create_access_record",
      "agent_create_change_event",
    ]);
    expect(doc.paths["/devices"].post?.security).toEqual([{ writeAgentToken: [] }]);
    expect(doc.paths["/change-events"].post?.description).toContain("需要写入权限");
    expect(doc.components.securitySchemes.writeAgentToken?.bearerFormat).toBe("写入访问令牌");
  });
});
