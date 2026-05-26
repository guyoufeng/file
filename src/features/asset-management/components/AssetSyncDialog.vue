<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  testAssetSyncConnection,
  type AssetSyncConfig,
  type AssetSyncType,
} from "../../../services/asset/assetSyncConfig";

const props = defineProps<{
  open: boolean;
  type: AssetSyncType;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [config: AssetSyncConfig];
}>();

const baseUrl = ref("");
const token = ref("");
const testing = ref(false);
const message = ref("");

const title = computed(() =>
  props.type === "cmdb" ? "CMDB同步配置" : "MCP同步配置",
);
const scope = computed(() =>
  props.type === "cmdb" ? "physical_assets" : "virtual_servers",
);
const name = computed(() =>
  props.type === "cmdb" ? "公司CMDB" : "ZStack MCP",
);
const description = computed(() =>
  props.type === "cmdb"
    ? "对接公司 CMDB 系统，同步物理服务器、存储、网络、安全和基础设施资产。"
    : "对接 ZStack MCP，同步虚拟服务器资产，也支持后续与 Excel、手工录入合并。",
);

const config = computed<AssetSyncConfig>(() => ({
  type: props.type,
  name: name.value,
  baseUrl: baseUrl.value,
  authMode: "token",
  token: token.value,
  scope: scope.value,
}));

watch(
  () => props.open,
  (open) => {
    if (open) message.value = "";
  },
);

async function testConnection() {
  testing.value = true;
  try {
    const result = await testAssetSyncConnection(config.value);
    message.value = result.message;
  } finally {
    testing.value = false;
  }
}

async function confirm() {
  const result = await testAssetSyncConnection(config.value);
  message.value = result.message;
  if (result.ok) {
    emit("confirm", config.value);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="sync-backdrop" @click.self="emit('close')">
      <section class="sync-dialog" role="dialog" :aria-label="title">
        <header>
          <div>
            <p class="eyebrow">Asset Sync</p>
            <h3>{{ title }}</h3>
          </div>
          <button type="button" aria-label="关闭同步配置" @click="emit('close')">×</button>
        </header>
        <p class="description">{{ description }}</p>
        <label>
          接口地址
          <input v-model="baseUrl" type="url" placeholder="https://cmdb.example.com/api 或 http://zstack-mcp.local" />
        </label>
        <label>
          Token
          <input v-model="token" type="password" placeholder="输入接口 Token，后续会改为密钥链保存" />
        </label>
        <label>
          同步范围
          <input :value="scope === 'physical_assets' ? '物理资产' : '虚拟服务器'" disabled />
        </label>
        <p v-if="message" class="sync-message">{{ message }}</p>
        <footer>
          <button type="button" @click="testConnection">
            {{ testing ? "测试中..." : "测试连通性" }}
          </button>
          <button type="button" class="primary" @click="confirm">确认配置</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sync-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  padding: 92px 28px 28px;
  background: rgba(2, 6, 23, 0.36);
}

.sync-dialog {
  width: min(430px, 92vw);
  height: fit-content;
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(56, 189, 248, 0.36);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.96);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.eyebrow,
h3,
.description,
.sync-message {
  margin: 0;
}

.eyebrow {
  color: #38bdf8;
  font-size: 12px;
}

.description,
.sync-message {
  color: var(--color-text-muted);
  font-size: 13px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 13px;
}

input {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.88);
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(14, 165, 233, 0.54);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.12);
  cursor: pointer;
}

.primary {
  background: rgba(14, 165, 233, 0.28);
}
</style>
