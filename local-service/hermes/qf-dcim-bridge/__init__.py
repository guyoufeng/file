"""Hermes plugin that bridges messaging gateway events into QF AI DCIM.

The plugin runs inside Hermes Gateway. It intercepts real platform messages
before Hermes dispatches them to its own agent, forwards the text to the QF
platform gateway endpoint, sends the returned reply back through the original
Hermes adapter, and then skips the original Hermes dispatch.
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from typing import Any


PROVIDER_MAP = {
    "weixin": "wechat",
    "wechat": "wechat",
    "wecom": "wecom",
    "wecom_callback": "wecom",
    "dingtalk": "dingtalk",
}


def _platform_name(source: Any) -> str:
    platform = getattr(source, "platform", "") or ""
    return str(getattr(platform, "value", platform) or "").strip().lower()


def _windows_host_ip() -> str:
    try:
        with open("/etc/resolv.conf", "r", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("nameserver"):
                    parts = line.split()
                    if len(parts) >= 2:
                        return parts[1]
    except OSError:
        pass
    return "127.0.0.1"


def _base_url() -> str:
    configured = os.environ.get("QF_DCIM_GATEWAY_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return f"http://{_windows_host_ip()}:5173/api/agent/v1/gateway"


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read().decode("utf-8", errors="replace")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"reply": raw}


async def _send_reply(gateway: Any, source: Any, reply: str) -> None:
    if not reply.strip():
        return
    adapter = gateway.adapters.get(source.platform)
    if not adapter:
        return
    result = adapter.send(source.chat_id, reply[:3500], reply_to=getattr(source, "message_id", None))
    if asyncio.iscoroutine(result):
        await result


async def _forward_to_qf(event: Any, gateway: Any) -> dict[str, str] | None:
    source = getattr(event, "source", None)
    if source is None:
        return None
    provider = PROVIDER_MAP.get(_platform_name(source))
    if not provider:
        return None

    text = str(getattr(event, "text", "") or "").strip()
    if not text:
        return None

    payload = {
        "externalUserId": str(getattr(source, "user_id", "") or getattr(source, "chat_id", "") or "wechat-user"),
        "displayName": str(getattr(source, "user_name", "") or getattr(source, "chat_name", "") or "微信用户"),
        "content": text,
        "messageId": str(getattr(event, "message_id", "") or ""),
        "chatId": str(getattr(source, "chat_id", "") or ""),
        "chatType": str(getattr(source, "chat_type", "") or ""),
        "rawPlatform": _platform_name(source),
    }

    url = f"{_base_url()}/{provider}"
    try:
        result = await asyncio.to_thread(_post_json, url, payload)
        reply = str(result.get("reply") or result.get("message") or "")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        reply = f"泉峰AI平台暂时不可达：{exc}"

    await _send_reply(gateway, source, reply)
    return {"action": "skip", "reason": "forwarded-to-qf-dcim"}


def register(ctx: Any) -> None:
    def pre_gateway_dispatch(event: Any, gateway: Any, **kwargs: Any) -> Any:
        del kwargs
        return _forward_to_qf(event, gateway)

    ctx.register_hook("pre_gateway_dispatch", pre_gateway_dispatch)
