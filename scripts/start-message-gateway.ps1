$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pluginSource = Join-Path $projectRoot "local-service\hermes\qf-dcim-bridge"
$pluginTarget = "/root/.hermes/plugins/qf-dcim-bridge"

Write-Host "Installing QF DCIM Hermes bridge plugin..."
wsl -d Ubuntu -u root -- bash -lc "mkdir -p '$pluginTarget'"
wsl -d Ubuntu -u root -- bash -lc "cp -f '/mnt/d/codex/qf-ai-dcim/local-service/hermes/qf-dcim-bridge/plugin.yaml' '$pluginTarget/plugin.yaml' && cp -f '/mnt/d/codex/qf-ai-dcim/local-service/hermes/qf-dcim-bridge/__init__.py' '$pluginTarget/__init__.py'"

Write-Host "Enabling qf-dcim-bridge in Hermes config..."
wsl -d Ubuntu -u root -- python3 - <<'PY'
from pathlib import Path
import yaml

path = Path("/root/.hermes/config.yaml")
data = yaml.safe_load(path.read_text()) or {}
plugins = data.setdefault("plugins", {})
enabled = plugins.setdefault("enabled", [])
if enabled is None:
    enabled = []
    plugins["enabled"] = enabled
if "qf-dcim-bridge" not in enabled:
    enabled.append("qf-dcim-bridge")
path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False))
PY

Write-Host "Restarting Hermes Gateway service..."
wsl -d Ubuntu -u root -- bash -lc "systemctl --user restart hermes-gateway.service"

Write-Host "Starting local QF message gateway adapter on port 8787..."
$env:QF_PLATFORM_BASE_URL = "http://127.0.0.1:5173"
$env:QF_GATEWAY_PORT = "8787"
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Set-Location 'D:\codex\qf-ai-dcim'; `$env:QF_PLATFORM_BASE_URL='http://127.0.0.1:5173'; `$env:QF_GATEWAY_PORT='8787'; pnpm run gateway:dev"
)

Write-Host "Gateway startup requested. Check:"
Write-Host "  WSL Hermes: wsl -d Ubuntu -u root -- systemctl --user status hermes-gateway.service --no-pager"
Write-Host "  Local adapter: http://127.0.0.1:8787/health"
