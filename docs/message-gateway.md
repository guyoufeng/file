# 泉峰AI消息网关本地适配器

本地适配器用于把微信、企业微信、钉钉等外部消息网关转发到平台内置 Agent API。

## 启动方式

```powershell
$env:QF_PLATFORM_BASE_URL="http://127.0.0.1:5173"
$env:QF_GATEWAY_PORT="8787"
pnpm run gateway:dev
```

健康检查：

```powershell
Invoke-WebRequest http://127.0.0.1:8787/health
```

## 接入地址

- 扫码配对页：`http://<笔记本IP>:8787/pair/wechat?configId=<配置ID>`
- 消息回调地址：`http://<笔记本IP>:8787/gateway/wechat`

企业微信和钉钉分别使用：

- `http://<笔记本IP>:8787/gateway/wecom`
- `http://<笔记本IP>:8787/gateway/dingtalk`

## 真实微信接入说明

个人微信不能只靠网页二维码直接完成真实收发消息，需要 Hermes/iLink 或企业微信/钉钉官方机器人服务提供真实消息通道。部署真实通道后，把它的消息回调 POST 到上述 `/gateway/{provider}` 地址即可进入平台 AI Agent。
