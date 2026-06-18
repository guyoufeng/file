import type { IncomingMessage, ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0
    ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
    : {};
}

export function sendJson(res: ServerResponse, value: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

export function getRuntimePublicBaseUrl(req: IncomingMessage): string {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const port = (req.headers.host ?? "127.0.0.1:5200").split(":").at(-1) ?? "5200";
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return `${protocol}://${entry.address}:${port}`;
      }
    }
  }
  return `${protocol}://${req.headers.host ?? "127.0.0.1:5200"}`;
}
