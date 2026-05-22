<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import type { AiModelConfig } from '../../../types/domain'
import { useAiStore } from '../../../stores/aiStore'

const aiStore = useAiStore()

const form = reactive<AiModelConfig>({
  id: `ai-config-${Date.now()}`,
  provider: 'gpustack',
  name: '公司GPUStack qwen3.6-35b',
  baseUrl: 'http://gpu-stack.example.com/v1',
  model: 'qwen3.6-35b',
  apiKeyRef: '',
  enabled: true,
})

onMounted(() => {
  void aiStore.loadConfigs()
})

function saveConfig() {
  aiStore.addLocalConfig({ ...form, id: form.id || `ai-config-${Date.now()}` })
}

async function testConnection() {
  const result = await aiStore.testConfig(form)
  window.alert(result.message)
}
</script>

<template>
  <section class="ai-settings">
    <div class="config-panel">
      <header>
        <div>
          <p class="eyebrow">AI Gateway</p>
          <h3>模型配置</h3>
        </div>
        <span class="warning">外部供应商配置可能包含敏感地址和 API Key，请优先使用公司内网模型。</span>
      </header>

      <form @submit.prevent="saveConfig">
        <label>配置名称<input v-model="form.name" /></label>
        <label>
          供应商/协议类型
          <select v-model="form.provider">
            <option value="gpustack">GPUStack</option>
            <option value="openai_compatible">OpenAI Compatible</option>
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
            <option value="vllm">vLLM</option>
          </select>
        </label>
        <label>Base URL<input v-model="form.baseUrl" /></label>
        <label>API Key<input v-model="form.apiKeyRef" type="password" /></label>
        <label>模型标识<input v-model="form.model" /></label>
        <label class="checkbox"><input v-model="form.enabled" type="checkbox" /> 启用此模型</label>
        <label>请求超时<input value="60s" disabled /></label>
        <label>最大输出长度<input value="4096" disabled /></label>
        <label>temperature<input value="0.2" disabled /></label>
        <label class="wide">备注<input placeholder="例如：公司 GPU 一体机 qwen3.6-35b" /></label>
        <div class="actions">
          <button type="submit">保存配置</button>
          <button type="button" @click="testConnection">测试连接</button>
        </div>
      </form>
    </div>

    <div class="config-list">
      <h3>已配置模型</h3>
      <article v-for="config in aiStore.configs" :key="config.id">
        <strong>{{ config.name }}</strong>
        <span>{{ config.provider }} / {{ config.model }}</span>
        <small>{{ config.enabled ? '当前启用' : '未启用' }}</small>
      </article>
      <p v-if="aiStore.configs.length === 0" class="empty">暂无保存的模型配置，可以先添加公司 GPUStack 模型。</p>
    </div>
  </section>
</template>

<style scoped>
.ai-settings {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 16px;
}

.config-panel,
.config-list {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

header {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
}

.warning {
  color: #fbbf24;
  font-size: 13px;
}

form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
}

.checkbox {
  display: flex;
  align-items: center;
}

.wide,
.actions {
  grid-column: 1 / -1;
}

input,
select {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.9);
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.7);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}

.config-list {
  display: grid;
  gap: 10px;
  align-content: start;
}

article {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.72);
}

span,
small,
.empty {
  color: var(--color-text-muted);
}
</style>
