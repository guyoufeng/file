export interface AgentReadonlyTool {
  name: string;
  description: string;
  method: "GET";
  path: string;
  url: string;
  readonly: true;
  query?: Record<string, string>;
}

type OpenApiPathItem = {
  get: {
    summary: string;
    description: string;
    parameters?: Array<{
      name: string;
      in: "query";
      required: false;
      schema: { type: "string" };
      description: string;
    }>;
    responses: {
      "200": {
        description: string;
      };
    };
  };
};

export interface AgentOpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  security: Array<{ readonlyAgentToken: [] }>;
  components: {
    securitySchemes: {
      readonlyAgentToken: {
        type: "http";
        scheme: "bearer";
        bearerFormat: "只读访问令牌";
        description: string;
      };
    };
  };
  paths: Record<string, OpenApiPathItem>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function getAgentReadonlyTools(baseUrl: string): AgentReadonlyTool[] {
  return [
    {
      name: "agent_health",
      description: "检查泉峰AI数据中心管理平台只读 Agent API 是否可用。",
      method: "GET",
      path: "/health",
      url: joinUrl(baseUrl, "/health"),
      readonly: true,
    },
    {
      name: "agent_get_topology",
      description: "获取机房、机柜、设备、告警、审计日志的只读快照。",
      method: "GET",
      path: "/topology",
      url: joinUrl(baseUrl, "/topology"),
      readonly: true,
    },
    {
      name: "agent_list_rooms",
      description: "查询所有机房。",
      method: "GET",
      path: "/rooms",
      url: joinUrl(baseUrl, "/rooms"),
      readonly: true,
    },
    {
      name: "agent_list_racks",
      description: "按机房或关键字查询机柜。",
      method: "GET",
      path: "/racks",
      url: joinUrl(baseUrl, "/racks"),
      readonly: true,
      query: {
        roomId: "机房 ID，可选。",
        q: "机柜名称、类型、备注关键字，可选。",
      },
    },
    {
      name: "agent_search_devices",
      description: "按计算机名、IP、责任人、机柜、机房或关键字查询设备资产。",
      method: "GET",
      path: "/devices",
      url: joinUrl(baseUrl, "/devices"),
      readonly: true,
      query: {
        q: "计算机名、用途、型号、SN、资产编号、机柜名等关键字，可选。",
        ip: "业务 IP、带外 IP 或 IP 列表中的地址，可选。",
        owner: "责任人，可选。",
        rackId: "机柜 ID，可选。",
        roomId: "机房 ID，可选。",
      },
    },
    {
      name: "agent_list_alerts",
      description: "按设备、状态或关键字查询告警。",
      method: "GET",
      path: "/alerts",
      url: joinUrl(baseUrl, "/alerts"),
      readonly: true,
      query: {
        deviceId: "设备 ID，可选。",
        status: "告警状态，如 unconfirmed、acknowledged、recovered，可选。",
        q: "告警标题、描述、来源、级别关键字，可选。",
      },
    },
    {
      name: "agent_search_audit_logs",
      description: "查询 AI 查询、系统变更、导入恢复等审计日志。",
      method: "GET",
      path: "/audit-logs",
      url: joinUrl(baseUrl, "/audit-logs"),
      readonly: true,
      query: {
        q: "审计关键字，可选。",
        action: "审计动作，如 ai_readonly_query、room.restore，可选。",
        status: "success 或 failed，可选。",
      },
    },
  ];
}

export function buildAgentOpenApiDocument(baseUrl: string): AgentOpenApiDocument {
  const tools = getAgentReadonlyTools(baseUrl);
  return {
    openapi: "3.1.0",
    info: {
      title: "泉峰AI数据中心管理平台只读 Agent API",
      version: "0.1.0",
      description: "供外部 AI Agent 查询机房、机柜、设备、告警和审计日志的只读 HTTP API。",
    },
    servers: [{ url: baseUrl.replace(/\/$/, "") }],
    security: [{ readonlyAgentToken: [] }],
    components: {
      securitySchemes: {
        readonlyAgentToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "只读访问令牌",
          description:
            "外部 AI Agent 调用只读接口时使用 Authorization: Bearer <token>。第一版令牌只允许读取，不允许写入平台数据。",
        },
      },
    },
    paths: Object.fromEntries(
      tools.map((tool) => [
        tool.path,
        {
          get: {
            summary: tool.name,
            description: tool.description,
            parameters: Object.entries(tool.query ?? {}).map(([name, description]) => ({
              name,
              in: "query" as const,
              required: false,
              schema: { type: "string" },
              description,
            })),
            responses: {
              "200": {
                description: "查询成功。",
              },
            },
          },
        },
      ]),
    ),
  };
}
