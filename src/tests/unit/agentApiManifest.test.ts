import { describe, expect, it } from "vitest";
import {
  buildAgentOpenApiDocument,
  getAgentReadonlyTools,
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
    expect(Object.values(doc.paths).every((pathItem) => !("post" in pathItem))).toBe(true);
  });
});
