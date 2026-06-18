import http from "node:http";

const port = Number(process.env.QF_GATEWAY_PORT || 8787);
const platformBaseUrl = (process.env.QF_PLATFORM_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { content: raw };
  }
}

function sendJson(res, value, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function forwardToPlatform(provider, payload) {
  const response = await fetch(`${platformBaseUrl}/api/agent/v1/gateway/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { message: text } };
  }
}

function pairPage(provider, configId, result) {
  return [
    "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />",
    "<title>泉峰AI消息网关</title>",
    "<style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#ecfdf5,#e0f2fe);color:#0f172a;line-height:1.7}main{max-width:560px;margin:12vh auto;padding:28px;border:1px solid #bbf7d0;border-radius:14px;background:rgba(255,255,255,.92);box-shadow:0 24px 70px rgba(15,23,42,.14)}h1{font-size:34px;line-height:1.25;margin:0 0 18px}code{display:block;overflow:auto;border-radius:8px;background:#f8fafc;padding:10px}</style>",
    "</head><body><main>",
    "<h1>消息网关配对已接收</h1>",
    `<p>当前适配器已接收 ${provider} 扫码请求，并已尝试转发到泉峰AI平台。</p>`,
    `<p>配置ID：${configId || "未指定"}</p>`,
    `<code>${JSON.stringify(result.body)}</code>`,
    "<p>要实现个人微信/企业微信/钉钉真实收发，请把 Hermes/iLink/官方机器人消息 POST 到本适配器的 <code>/gateway/{provider}</code>。</p>",
    "</main></body></html>",
  ].join("");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const segments = url.pathname.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, {
        ok: true,
        service: "qf-ai-message-gateway-adapter",
        platformBaseUrl,
        providers: ["wechat", "wecom", "dingtalk"],
      });
      return;
    }

    if (req.method === "GET" && segments[0] === "pair") {
      const provider = segments[1] || "wechat";
      const configId = url.searchParams.get("configId") || "";
      const platformUrl = `${platformBaseUrl}/api/agent/v1/gateway/${provider}/pair?configId=${encodeURIComponent(configId)}`;
      const response = await fetch(platformUrl);
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = { message: await response.text() };
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(pairPage(provider, configId, { status: response.status, body }));
      return;
    }

    if (req.method === "POST" && segments[0] === "gateway") {
      const provider = segments[1] || "wechat";
      const payload = await readBody(req);
      const result = await forwardToPlatform(provider, payload);
      sendJson(res, {
        message: "消息已转发到泉峰AI平台",
        provider,
        platformStatus: result.status,
        platformResult: result.body,
      }, result.status >= 400 ? 502 : 200);
      return;
    }

    sendJson(res, {
      message: "泉峰AI消息网关适配器",
      health: "/health",
      pairUrl: "/pair/wechat?configId=<id>",
      inboundUrl: "/gateway/wechat",
    });
  } catch (error) {
    sendJson(res, { message: error instanceof Error ? error.message : "gateway adapter failed" }, 500);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`QF AI message gateway adapter listening on http://127.0.0.1:${port}`);
  console.log(`Forwarding messages to ${platformBaseUrl}/api/agent/v1/gateway/{provider}`);
});
