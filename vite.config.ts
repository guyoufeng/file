import type { IncomingMessage } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

async function readBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0
    ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
    : {};
}

function aiProxyPlugin() {
  return {
    name: "ai-proxy",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/__demo_seed", async (_req, res) => {
        try {
          const seedPath = path.resolve(".local/demo-seed.json");
          const content = await readFile(seedPath, "utf8");
          res.setHeader("Content-Type", "application/json");
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ message: "未配置本地演示种子" }));
        }
      });

      server.middlewares.use("/__ai_proxy/models", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const body = (await readBody(req)) as {
            provider?: string;
            baseUrl?: string;
            apiKeyRef?: string;
            model?: string;
          };
          const baseUrl = body.baseUrl?.replace(/\/$/, "") ?? "";

          if (!baseUrl && body.provider !== "gemini") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ message: "Base URL 不能为空" }));
            return;
          }

          if (body.provider === "gemini") {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ data: body.model ? [{ id: body.model }] : [] }),
            );
            return;
          }

          if (body.provider === "ollama") {
            const response = await fetch(`${baseUrl}/api/tags`);
            const data = await response.json();
            const models = Array.isArray(data.models)
              ? data.models.map((item: { name: string }) => item.name)
              : [];
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ models }));
            return;
          }

          const headers: Record<string, string> = {};
          if (body.apiKeyRef) {
            headers.Authorization = `Bearer ${body.apiKeyRef}`;
          }

          const response = await fetch(`${baseUrl}/models`, { headers });
          const data = await response.json();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message:
                error instanceof Error ? error.message : "模型代理请求失败",
            }),
          );
        }
      });

      server.middlewares.use("/__ai_proxy/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const body = (await readBody(req)) as {
            provider?: string;
            baseUrl?: string;
            apiKeyRef?: string;
            model?: string;
            messages?: Array<{ role: string; content: string }>;
          };
          const baseUrl = body.baseUrl?.replace(/\/$/, "") ?? "";

          if (body.provider === "ollama") {
            const response = await fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: body.model,
                messages: body.messages,
                stream: false,
              }),
            });
            const data = await response.json();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return;
          }

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (body.apiKeyRef) {
            headers.Authorization = `Bearer ${body.apiKeyRef}`;
          }

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: body.model,
              messages: body.messages,
              temperature: 0.2,
            }),
          });
          const data = await response.json();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message:
                error instanceof Error ? error.message : "模型聊天代理请求失败",
            }),
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), aiProxyPlugin()],
  test: {
    include: ["src/tests/unit/**/*.test.ts"],
  },
});
