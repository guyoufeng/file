<script setup lang="ts">
import { ref } from 'vue'
import AboutSystem from './components/AboutSystem.vue'
import AiAgentSettings from './components/AiAgentSettings.vue'
import AiModelSettings from './components/AiModelSettings.vue'
import AccountManagementSettings from './components/AccountManagementSettings.vue'
import AuditLogPanel from './components/AuditLogPanel.vue'
import DataManagementSettings from './components/DataManagementSettings.vue'
import ThemeSettings from './components/ThemeSettings.vue'

type SettingsTab = 'ai' | 'agent' | 'accounts' | 'data' | 'theme' | 'audit' | 'about'

const activeTab = ref<SettingsTab>('ai')

const tabs: Array<{ value: SettingsTab; label: string }> = [
  { value: 'ai', label: 'AI模型' },
  { value: 'agent', label: 'AI Agent' },
  { value: 'accounts', label: '账号管理' },
  { value: 'data', label: '数据管理' },
  { value: 'theme', label: '主题' },
  { value: 'audit', label: '审计日志' },
  { value: 'about', label: '关于' },
]
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">系统设置</h2>
        <p class="page-subtitle">配置 AI 模型、数据备份、审计日志和后续插件适配能力。</p>
      </div>
    </div>

    <div class="settings-tabs" aria-label="设置分类">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <AiModelSettings v-if="activeTab === 'ai'" />
    <AiAgentSettings v-else-if="activeTab === 'agent'" />
    <AccountManagementSettings v-else-if="activeTab === 'accounts'" />
    <DataManagementSettings v-else-if="activeTab === 'data'" />
    <ThemeSettings v-else-if="activeTab === 'theme'" />
    <AuditLogPanel v-else-if="activeTab === 'audit'" />
    <AboutSystem v-else />
  </section>
</template>

<style scoped>
.settings-tabs {
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
}

.settings-tabs button {
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}

.settings-tabs button.active {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
}
</style>
