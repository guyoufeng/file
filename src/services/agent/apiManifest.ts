export interface AgentReadonlyTool {
  name: string;
  description: string;
  method: "GET";
  path: string;
  url: string;
  readonly: true;
  query?: Record<string, string>;
}

export interface AgentWriteTool {
  name: string;
  description: string;
  method: "POST";
  path: string;
  url: string;
  requiredScope: "write";
  bodySchema: Record<string, string>;
}

type OpenApiPathItem = {
  get?: {
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
  post?: {
    summary: string;
    description: string;
    security: Array<{ writeAgentToken: [] }>;
    requestBody: {
      required: true;
      content: {
        "application/json": {
          schema: {
            type: "object";
            properties: Record<string, { type: "string"; description: string }>;
          };
        };
      };
    };
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
      writeAgentToken?: {
        type: "http";
        scheme: "bearer";
        bearerFormat: "写入访问令牌";
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
    {
      name: "agent_search_access_records",
      description: "查询数据中心进出、访客、维修和故障处理记录。",
      method: "GET",
      path: "/access-records",
      url: joinUrl(baseUrl, "/access-records"),
      readonly: true,
      query: {
        q: "日期、单位、人员、服务器名、故障或处理结果关键字，可选。",
      },
    },
    {
      name: "agent_search_change_events",
      description: "查询物理机上架、下架、接线、维修、安装和配置调整等变更记录。",
      method: "GET",
      path: "/change-events",
      url: joinUrl(baseUrl, "/change-events"),
      readonly: true,
      query: {
        q: "服务器名、业务IP、机柜、变更类型、操作人、接线或处理结果关键字，可选。",
      },
    },
    {
      name: "agent_search_connections",
      description: "查询服务器、交换机、端口和线缆编号之间的连线关系。",
      method: "GET",
      path: "/connections",
      url: joinUrl(baseUrl, "/connections"),
      readonly: true,
      query: {
        q: "服务器名、交换机名、端口、线缆编号或链路说明关键字，可选。",
      },
    },
  ];
}

export function getAgentWriteTools(baseUrl: string): AgentWriteTool[] {
  return [
    {
      name: "agent_create_or_update_device",
      description: "通过结构化字段新增或更新设备资产。需要写入权限。",
      method: "POST",
      path: "/devices",
      url: joinUrl(baseUrl, "/devices"),
      requiredScope: "write",
      bodySchema: {
        id: "设备 ID，更新时填写；新增可留空。",
        computerName: "计算机名。",
        businessIp: "业务 IP。",
        managementIp: "带外或管理 IP。",
        rackId: "目标机柜 ID。",
        startU: "起始 U 位。",
        endU: "结束 U 位。",
        owner: "责任人。",
        purpose: "用途。",
      },
    },
    {
      name: "agent_create_access_record",
      description: "录入数据中心进出、维修或现场处理记录。需要写入权限。",
      method: "POST",
      path: "/access-records",
      url: joinUrl(baseUrl, "/access-records"),
      requiredScope: "write",
      bodySchema: {
        date: "日期，YYYY-MM-DD。",
        unit: "进入单位。",
        visitorName: "进入人员。",
        enterTime: "进入时间。",
        leaveTime: "离开时间，可选。",
        reason: "进入事由。",
        deviceId: "关联设备 ID，可选。",
        faultDescription: "故障说明，可选。",
        result: "处理结果，可选。",
      },
    },
    {
      name: "agent_create_change_event",
      description: "录入上架、下架、接线、维修、配置调整等变更记录。需要写入权限。",
      method: "POST",
      path: "/change-events",
      url: joinUrl(baseUrl, "/change-events"),
      requiredScope: "write",
      bodySchema: {
        title: "变更标题。",
        type: "变更类型，如 rack_mount、cabling、maintenance、configuration。",
        changedAt: "变更时间。",
        deviceId: "关联设备 ID，可选。",
        content: "变更内容。",
        result: "处理结果，可选。",
      },
    },
  ];
}

export function buildAgentOpenApiDocument(
  baseUrl: string,
  options?: { includeWriteTools?: boolean },
): AgentOpenApiDocument {
  const tools = getAgentReadonlyTools(baseUrl);
  const writeTools = options?.includeWriteTools ? getAgentWriteTools(baseUrl) : [];
  const writePaths = Object.fromEntries(
    writeTools.map((tool) => [
      tool.path,
      {
        post: {
          summary: tool.name,
          description: tool.description,
          security: [{ writeAgentToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object" as const,
                  properties: Object.fromEntries(
                    Object.entries(tool.bodySchema).map(([name, description]) => [
                      name,
                      { type: "string", description },
                    ]),
                  ),
                },
              },
            },
          },
          responses: {
            "200": {
              description: "写入成功，且会产生审计日志。",
            },
          },
        },
      },
    ]),
  );
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
        ...(options?.includeWriteTools
          ? {
              writeAgentToken: {
                type: "http" as const,
                scheme: "bearer" as const,
                bearerFormat: "写入访问令牌" as const,
                description:
                  "外部 AI Agent 调用写入接口时使用 Authorization: Bearer <token>，令牌必须包含 write scope；所有写入都会记录审计。",
              },
            }
          : {}),
      },
    },
    paths: {
      ...Object.fromEntries(tools.map((tool) => [
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
      ])),
      ...writePaths,
    },
  };
}
