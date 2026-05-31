<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getAiAgentCapabilitySettings,
  saveAiAgentCapabilitySettings,
  type AiAgentCapabilitySettings,
} from "../../../services/ai/agentCapabilities";
import type { AgentReadonlyTool } from "../../../services/agent/apiManifest";
import {
  getStoredAgentReadonlyToken,
  loadAgentReadonlyHealth,
  loadAgentReadonlyTokenSettings,
  loadAgentReadonlyTools,
  saveAgentReadonlyTokenSettings,
  storeAgentReadonlyToken,
  type AgentReadonlyHealth,
  type AgentReadonlyTokenSettings,
} from "../../../services/agent/apiClient";

const settings = ref<AiAgentCapabilitySettings>(getAiAgentCapabilitySettings());
const message = ref("AI Agent 第一阶段默认只读，外网辅助默认关闭。");
const apiHealth = ref<AgentReadonlyHealth | null>(null);
const apiTools = ref<AgentReadonlyTool[]>([]);
const apiLoading = ref(false);
const apiMessage = ref("点击测试 API，确认只读 Agent API 和工具清单可用。");
const tokenSettings = ref<AgentReadonlyTokenSettings>({ enabled: false });
const tokenValue = ref(getStoredAgentReadonlyToken() ?? "");
const tokenMessage = ref("令牌只用于只读查询，外部 Agent 不能通过该令牌修改平台数据。");
const apiBaseUrl = computed(() =>
  typeof window === "undefined"
    ? "/api/agent/v1"
    : `${window.location.origin}/api/agent/v1`,
);
const curlExample = computed(() => {
  const token = tokenValue.value.trim() || "<readonly-token>";
  return `curl -H "Authorization: Bearer ${token}" "${apiBaseUrl.value}/devices?q=cnsmffluxdb1"`;
});

onMounted(() => {
  void loadTokenSettings();
  void refreshAgentApi();
});

function save(settingsPatch: Partial<AiAgentCapabilitySettings>) {
  settings.value = saveAiAgentCapabilitySettings(settingsPatch);
  message.value = "AI Agent 能力配置已保存。";
}

function toggleExternalTools() {
  save({ externalToolsEnabled: !settings.value.externalToolsEnabled });
}

function toggleSkill(key: keyof AiAgentCapabilitySettings) {
  save({ [key]: !settings.value[key] });
}

async function refreshAgentApi() {
  apiLoading.value = true;
  try {
    const [health, tools] = await Promise.all([
      loadAgentReadonlyHealth(),
      loadAgentReadonlyTools(),
    ]);
    apiHealth.value = health;
    apiTools.value = tools;
    apiMessage.value = `API 可用，快照时间：${new Date(health.generatedAt).toLocaleString("zh-CN", { hour12: false })}`;
  } catch (error) {
    apiHealth.value = null;
    apiTools.value = [];
    apiMessage.value =
      error instanceof Error ? error.message : "只读 Agent API 检测失败";
  } finally {
    apiLoading.value = false;
  }
}

function formatToolPath(tool: AgentReadonlyTool) {
  return `/api/agent/v1${tool.path}`;
}

async function loadTokenSettings() {
  try {
    tokenSettings.value = await loadAgentReadonlyTokenSettings();
  } catch {
    tokenSettings.value = { enabled: false };
  }
}

function generateToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  tokenValue.value = `qf-agent-${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function saveTokenSettings(enabled: boolean) {
  const token = tokenValue.value.trim();
  try {
    tokenSettings.value = await saveAgentReadonlyTokenSettings({
      enabled,
      token,
    });
    if (!enabled) {
      tokenValue.value = "";
      storeAgentReadonlyToken(undefined);
    }
    tokenMessage.value = enabled
      ? "只读访问令牌已启用，外部 Agent 调用 API 时必须携带 Bearer Token。"
      : "只读访问令牌已关闭，当前开发环境允许直接访问只读 API。";
    await refreshAgentApi();
  } catch (error) {
    tokenMessage.value =
      error instanceof Error ? error.message : "保存只读访问令牌失败";
  }
}
</script>

<template>
  <section class="agent-panel">
    <header>
      <div>
        <p class="eyebrow">AI Agent</p>
        <h3>Agent 能力与 Skill 开关</h3>
      </div>
      <span>用于控制 AI 助手能做什么。资产、告警、机柜事实仍必须来自平台工具。</span>
    </header>

    <div class="capability-grid">
      <article>
        <div>
          <strong>通用问答</strong>
          <span>允许回答平台使用、运维方法、巡检建议等非实时问题。</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :checked="settings.generalChatEnabled"
            @change="toggleSkill('generalChatEnabled')"
          />
          <span />
        </label>
      </article>

      <article>
        <div>
          <strong>外网辅助总开关</strong>
          <span>后续天气、网页搜索等外部工具都受这个总开关控制。</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :checked="settings.externalToolsEnabled"
            @change="toggleExternalTools"
          />
          <span />
        </label>
      </article>

      <article :class="{ disabled: !settings.externalToolsEnabled }">
        <div>
          <strong>天气查询 Skill</strong>
          <span>预留南京等城市天气查询能力，实际结果必须来自工具。</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :disabled="!settings.externalToolsEnabled"
            :checked="settings.weatherSkillEnabled"
            @change="toggleSkill('weatherSkillEnabled')"
          />
          <span />
        </label>
      </article>

      <article :class="{ disabled: !settings.externalToolsEnabled }">
        <div>
          <strong>网页搜索 Skill</strong>
          <span>预留联网搜索能力，后续需要权限、审计和来源展示。</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :disabled="!settings.externalToolsEnabled"
            :checked="settings.webSearchSkillEnabled"
            @change="toggleSkill('webSearchSkillEnabled')"
          />
          <span />
        </label>
      </article>

      <article>
        <div>
          <strong>监控 API Skill 记忆</strong>
          <span>用于沉淀卓豪、Prometheus 等接口调用经验和查询约束。</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :checked="settings.monitoringSkillMemoryEnabled"
            @change="toggleSkill('monitoringSkillMemoryEnabled')"
          />
          <span />
        </label>
      </article>
    </div>

    <section class="agent-api-panel">
      <header>
        <div>
          <p class="eyebrow">Agent API</p>
          <h3>只读 Agent API</h3>
        </div>
        <button type="button" @click="refreshAgentApi">
          {{ apiLoading ? "测试中..." : "测试 API" }}
        </button>
      </header>

      <div class="api-status">
        <code>{{ apiBaseUrl }}</code>
        <strong :class="{ healthy: apiHealth }">
          {{ apiHealth ? "API 可用" : "待检测" }}
        </strong>
        <span>{{ apiMessage }}</span>
      </div>

      <div class="token-box" aria-label="只读 API 访问令牌">
        <div>
          <strong>只读访问令牌</strong>
          <span>用于外部 AI Agent 访问平台只读 API。启用后必须使用 Authorization: Bearer。</span>
        </div>
        <div class="token-controls">
          <input
            v-model="tokenValue"
            type="text"
            placeholder="生成或输入 qf-agent- 开头的只读令牌"
            aria-label="只读访问令牌"
          />
          <button type="button" @click="generateToken">生成令牌</button>
          <button type="button" @click="saveTokenSettings(true)">启用令牌</button>
          <button type="button" @click="saveTokenSettings(false)">关闭令牌</button>
        </div>
        <small>
          当前状态：{{ tokenSettings.enabled ? "已启用" : "未启用" }}
          <template v-if="tokenSettings.tokenPreview">
            / {{ tokenSettings.tokenPreview }}
          </template>
        </small>
        <small>{{ tokenMessage }}</small>
      </div>

      <div class="agent-example" aria-label="外部 Agent 调用示例">
        <strong>外部 Agent 调用示例</strong>
        <code>{{ curlExample }}</code>
        <span>OpenAPI：{{ apiBaseUrl }}/openapi.json</span>
      </div>

      <div class="api-tool-list" aria-label="只读 Agent API 工具">
        <article v-for="tool in apiTools" :key="tool.name">
          <div>
            <strong>{{ tool.name }}</strong>
            <span>{{ tool.description }}</span>
          </div>
          <code>{{ tool.method }} {{ formatToolPath(tool) }}</code>
        </article>
      </div>
    </section>

    <p class="message">{{ message }}</p>
  </section>
</template>

<style scoped>
.agent-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
}

header span,
.message,
article span {
  color: var(--color-text-muted);
}

.capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

article {
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.68);
}

article div {
  display: grid;
  gap: 6px;
}

article.disabled {
  opacity: 0.58;
}

.switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex: 0 0 auto;
}

.switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.switch span {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.98);
  cursor: pointer;
}

.switch span::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #94a3b8;
  transition: transform 0.16s ease, background 0.16s ease;
}

.switch input:checked + span {
  border-color: rgba(14, 165, 233, 0.8);
  background: rgba(14, 165, 233, 0.22);
}

.switch input:checked + span::after {
  transform: translateX(20px);
  background: #38bdf8;
}

.switch input:disabled + span {
  cursor: not-allowed;
}

.message {
  margin: 0;
}

.agent-api-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.46);
}

.agent-api-panel header button {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(14, 165, 233, 0.56);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}

.api-status {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 12px;
  align-items: center;
}

.api-status code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #bfdbfe;
}

.api-status strong {
  padding: 4px 8px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 999px;
  color: var(--color-text-muted);
  background: rgba(15, 23, 42, 0.82);
  font-size: 12px;
}

.api-status strong.healthy {
  border-color: rgba(16, 185, 129, 0.48);
  color: #bbf7d0;
  background: rgba(16, 185, 129, 0.12);
}

.api-status span {
  grid-column: 1 / -1;
  color: var(--color-text-muted);
  font-size: 12px;
}

.api-tool-list {
  display: grid;
  gap: 8px;
}

.token-box,
.agent-example {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.62);
}

.token-box > div:first-child {
  display: grid;
  gap: 5px;
}

.token-controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) repeat(3, auto);
  gap: 8px;
}

.token-controls input {
  min-height: 32px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(2, 6, 23, 0.82);
}

.token-controls button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(14, 165, 233, 0.46);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.14);
  cursor: pointer;
}

.token-box small,
.agent-example span {
  color: var(--color-text-muted);
}

.agent-example code {
  min-width: 0;
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  color: #dbeafe;
  background: rgba(2, 6, 23, 0.72);
}

.api-tool-list article {
  min-height: 0;
  align-items: flex-start;
}

.api-tool-list code {
  flex: 0 0 auto;
  color: #bae6fd;
  white-space: nowrap;
}

@media (max-width: 920px) {
  .capability-grid {
    grid-template-columns: 1fr;
  }

  .token-controls {
    grid-template-columns: 1fr;
  }
}
</style>
