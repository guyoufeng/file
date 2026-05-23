<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { AiModelConfig } from "../../../types/domain";
import { useAiStore } from "../../../stores/aiStore";

type NoticeTone = "success" | "error" | "info";

const aiStore = useAiStore();

const form = reactive<AiModelConfig>({
  id: `ai-config-${Date.now()}`,
  provider: "gpustack",
  name: "",
  baseUrl: "",
  model: "",
  apiKeyRef: "",
  enabled: true,
});

const discoveredModels = ref<string[]>([]);
const discovering = ref(false);
const saving = ref(false);
const notice = ref<{ tone: NoticeTone; text: string } | null>(null);

function providerLabel(provider: AiModelConfig["provider"]) {
  switch (provider) {
    case "gpustack":
      return "GPUStack";
    case "openai_compatible":
      return "OpenAI Compatible";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    case "ollama":
      return "Ollama";
    case "vllm":
      return "vLLM";
  }
}

function applyConfig(config: AiModelConfig) {
  form.id = config.id;
  form.provider = config.provider;
  form.name = config.name;
  form.baseUrl = config.baseUrl;
  form.model = config.model;
  form.apiKeyRef = config.apiKeyRef ?? "";
  form.enabled = Boolean(config.enabled);
  discoveredModels.value = config.model ? [config.model] : [];
}

function resetDiscovery() {
  discoveredModels.value = [];
  form.model = "";
}

function autoNameConfig() {
  if (form.model) {
    form.name = `${providerLabel(form.provider)} ${form.model}`;
  }
}

onMounted(async () => {
  await aiStore.loadConfigs();
  const enabledConfig =
    aiStore.configs.find((item) => item.enabled) ?? aiStore.configs[0];
  if (enabledConfig) {
    applyConfig(enabledConfig);
  }
});

async function discoverAndTest() {
  notice.value = null;
  discovering.value = true;
  try {
    const models = await aiStore.discoverModels({ ...form });
    discoveredModels.value = models;

    if (models.length === 0) {
      notice.value = {
        tone: "error",
        text: "连接已建立，但没有发现可用模型。",
      };
      form.model = "";
      return;
    }

    form.model = models[0];
    if (!form.name.trim() || form.name.includes("GPUStack") || form.name.includes("OpenAI Compatible")) {
      autoNameConfig();
    }
    notice.value = {
      tone: "success",
      text: `发现 ${models.length} 个模型，已自动选中 ${models[0]}。`,
    };
  } catch (error) {
    notice.value = {
      tone: "error",
      text: error instanceof Error ? error.message : "模型发现失败",
    };
  } finally {
    discovering.value = false;
  }
}

async function saveConfig() {
  notice.value = null;
  saving.value = true;
  try {
    if (!form.model.trim()) {
      await discoverAndTest();
    }

    if (!form.model.trim()) {
      throw new Error("未能自动识别模型，请检查地址和 API Key。");
    }

    const saved = await aiStore.saveConfig({
      ...form,
      id: form.id || `ai-config-${Date.now()}`,
      name: form.name.trim() || `${providerLabel(form.provider)} ${form.model}`,
      enabled: true,
    });
    applyConfig(saved);
    notice.value = {
      tone: "success",
      text: `已保存并启用 ${saved.model}，当前平台将优先使用这条模型配置。`,
    };
  } catch (error) {
    notice.value = {
      tone: "error",
      text: error instanceof Error ? error.message : "模型配置保存失败",
    };
  } finally {
    saving.value = false;
  }
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
        <span class="warning"
          >建议优先使用公司内网模型。`GPUStack` 按 `OpenAI Compatible`
          协议自动发现模型。</span
        >
      </header>

      <form @submit.prevent="saveConfig">
        <label>
          供应商/协议类型
          <select
            v-model="form.provider"
            @change="resetDiscovery"
          >
            <option value="gpustack">GPUStack（OpenAI Compatible）</option>
            <option value="openai_compatible">OpenAI Compatible</option>
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
            <option value="vllm">vLLM</option>
          </select>
        </label>
        <label>
          Base URL
          <input
            v-model="form.baseUrl"
            placeholder="例如：http://192.168.127.8/v1"
            @input="resetDiscovery"
          />
        </label>
        <label>
          API Key
          <input
            v-model="form.apiKeyRef"
            type="password"
            placeholder="输入后可自动发现模型"
            @input="resetDiscovery"
          />
        </label>
        <label>
          配置名称
          <input
            v-model="form.name"
            placeholder="保存时会自动生成，也可以自定义"
          />
        </label>
        <label>
          自动识别的模型
          <select v-model="form.model" :disabled="discoveredModels.length === 0">
            <option value="" disabled>请先发现模型</option>
            <option v-for="model in discoveredModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </label>
        <label class="checkbox"
          ><input v-model="form.enabled" type="checkbox" disabled /> 保存后设为默认启用模型</label
        >

        <div
          v-if="notice"
          class="notice"
          :class="notice.tone"
          role="status"
        >
          {{ notice.text }}
        </div>

        <div class="actions">
          <button type="button" :disabled="discovering || saving" @click="discoverAndTest">
            {{ discovering ? "正在发现模型..." : "发现模型并测试" }}
          </button>
          <button type="submit" :disabled="saving || discovering">
            {{ saving ? "正在保存配置..." : "保存并启用" }}
          </button>
        </div>
      </form>
    </div>

    <div class="config-list">
      <h3>已配置模型</h3>
      <article
        v-for="config in aiStore.configs"
        :key="config.id"
        :class="{ active: config.id === form.id }"
        @click="applyConfig(config)"
      >
        <strong>{{ config.name }}</strong>
        <span>{{ providerLabel(config.provider) }} / {{ config.model }}</span>
        <small>{{ config.enabled ? "当前启用" : "未启用" }}</small>
      </article>
      <p v-if="aiStore.configs.length === 0" class="empty">
        暂无保存的模型配置，先填写地址和 API Key，系统会自动发现模型。
      </p>
    </div>
  </section>
</template>

<style scoped>
.ai-settings {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
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
  line-height: 1.5;
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

.checkbox,
.notice,
.actions {
  grid-column: 1 / -1;
}

.checkbox {
  display: flex;
  align-items: center;
}

input,
select {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.9);
}

.notice {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
}

.notice.success {
  border-color: rgba(16, 185, 129, 0.46);
  background: rgba(6, 78, 59, 0.24);
  color: #d1fae5;
}

.notice.error {
  border-color: rgba(239, 68, 68, 0.42);
  background: rgba(127, 29, 29, 0.26);
  color: #fecaca;
}

.notice.info {
  border-color: rgba(14, 165, 233, 0.42);
  background: rgba(8, 47, 73, 0.26);
  color: #dbeafe;
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.7);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
  cursor: pointer;
}

article.active {
  border-color: rgba(14, 165, 233, 0.54);
  background: rgba(8, 47, 73, 0.32);
}

span,
small,
.empty {
  color: var(--color-text-muted);
}
</style>
