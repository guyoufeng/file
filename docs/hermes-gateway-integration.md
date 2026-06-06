# Hermes 消息网关接入说明

## 源码来源

已下载 Hermes Agent 源码到本机：

- 路径：`D:\codex\vendor\hermes-agent`
- 仓库：`https://github.com/NousResearch/hermes-agent.git`
- 当前提交：`d880b5be0`
- 许可证：MIT

重点参考文件：

- `gateway/config.py`：平台枚举、网关配置、会话策略。
- `gateway/run.py`：Gateway 运行器、长连接、重试、消息调度。
- `gateway/platforms/base.py`：平台适配器基类、消息事件、发送结果。
- `gateway/platforms/weixin.py`：微信个人号 iLink Bot API 适配。
- `gateway/platforms/wecom.py`：企业微信 AI Bot 长连接适配。
- `gateway/platforms/wecom_callback.py`：企业微信自建应用回调适配。
- `gateway/platforms/dingtalk.py`：钉钉 Stream Mode 适配。
- `gateway/platforms/webhook.py`：通用 Webhook 入口。

## 平台内置回调

泉峰平台已经提供 Hermes-compatible 回调入口：

```text
POST /api/agent/v1/gateway/{provider}
GET  /api/agent/v1/gateway/{provider}/pair?configId=...
```

`provider` 当前支持：

- `wechat`
- `wecom`
- `dingtalk`

入站消息示例：

```json
{
  "externalUserId": "wx-user-001",
  "displayName": "张三",
  "content": "查询 529-A1 有哪些服务器",
  "attachments": []
}
```

平台收到后会写入：

- `gateway_messages`
- `service_audit_logs`
- Agent 网关会话记录

## 真实微信/企微/钉钉接入边界

浏览器页面生成的二维码是平台回调配对二维码，不等同于微信官方登录二维码。

真实个人微信扫码、企业微信 AI Bot、钉钉 Stream Mode 需要运行后端 Gateway Adapter：

```powershell
cd D:\codex\vendor\hermes-agent
hermes gateway setup
hermes gateway run
```

然后在 Hermes 对应平台适配器中，把收到的消息转发到泉峰平台回调地址：

```text
http://<平台服务器IP>:5173/api/agent/v1/gateway/wechat
http://<平台服务器IP>:5173/api/agent/v1/gateway/wecom
http://<平台服务器IP>:5173/api/agent/v1/gateway/dingtalk
```

后续生产化建议把 Hermes Gateway 独立部署成服务，由泉峰平台管理配置、审计、会话和 Agent 权限。

## 当前笔记本 WSL 检查结果

2026-06-06 检查结果：

- WSL2 Ubuntu 已安装并运行。
- root 用户下已有 Hermes Gateway systemd user service：
  - 服务名：`hermes-gateway.service`
  - 进程：`/root/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`
  - `webhook` 状态：connected
  - `weixin` 状态：connected
  - `api_server` 状态：paused，当前 8658 未监听
  - `webhook` 健康检查：`http://127.0.0.1:8644/health`
- Hermes 已存在微信 iLink 账号缓存，说明这台机器之前已经完成过真实微信扫码登录。

后续如果要让微信消息直接进入泉峰平台，有两种安全路线：

1. 在 Hermes 中增加一个专用 Skill/Tool，调用泉峰平台 `/api/agent/v1/*` 查询和写入接口。
2. 做一个独立 bridge 服务，订阅 Hermes/Weixin 入站消息，再 POST 到泉峰平台 `/api/agent/v1/gateway/wechat`。

不建议直接手工覆盖 `/root/.hermes/config.yaml`，因为当前已有运行中的 Hermes、微信账号缓存、MCP 和其他进程。
