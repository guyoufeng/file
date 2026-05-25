<script setup lang="ts">
import { ref } from "vue";
import {
  getAiAgentCapabilitySettings,
  saveAiAgentCapabilitySettings,
  type AiAgentCapabilitySettings,
} from "../../../services/ai/agentCapabilities";

const settings = ref<AiAgentCapabilitySettings>(getAiAgentCapabilitySettings());
const message = ref("AI Agent 第一阶段默认只读，外网辅助默认关闭。");

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

@media (max-width: 920px) {
  .capability-grid {
    grid-template-columns: 1fr;
  }
}
</style>
