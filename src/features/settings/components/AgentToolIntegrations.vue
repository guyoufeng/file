<script setup lang="ts">
import { ref } from "vue";
import {
  deleteAgentToolIntegration,
  getAgentToolIntegrations,
  saveAgentToolIntegration,
  testAndSaveAgentToolIntegration,
  testAgentToolIntegration,
  type AgentToolIntegration,
  type AgentToolIntegrationType,
} from "../../../services/ai/agentToolIntegrations";

const integrations = ref<AgentToolIntegration[]>(getAgentToolIntegrations());
const message = ref("配置 CMDB / MCP 后，Agent 会在提示词中看到脱敏工具目录。");
const form = ref<{
  id?: string;
  type: AgentToolIntegrationType;
  name: string;
  endpoint: string;
  token: string;
  enabled: boolean;
  notes: string;
}>({
  type: "cmdb",
  name: "",
  endpoint: "",
  token: "",
  enabled: true,
  notes: "",
});

function resetForm() {
  form.value = {
    type: "cmdb",
    name: "",
    endpoint: "",
    token: "",
    enabled: true,
    notes: "",
  };
}

function refresh() {
  integrations.value = getAgentToolIntegrations();
}

function editIntegration(integration: AgentToolIntegration) {
  form.value = {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    endpoint: integration.endpoint,
    token: integration.token ?? "",
    enabled: integration.enabled,
    notes: integration.notes,
  };
}

function saveIntegration() {
  const saved = saveAgentToolIntegration(form.value);
  message.value = `已保存工具接入：${saved.name}`;
  refresh();
  resetForm();
}

async function testIntegration() {
  const result = await testAgentToolIntegration(form.value);
  message.value = result.message;
}

async function testAndSave() {
  const result = await testAndSaveAgentToolIntegration(form.value);
  message.value = result.message;
  refresh();
  resetForm();
}

function removeIntegration(id: string) {
  deleteAgentToolIntegration(id);
  message.value = "工具接入已删除。";
  refresh();
}
</script>

<template>
  <section class="tool-panel" aria-label="CMDB / MCP 工具接入">
    <header>
      <div>
        <p class="eyebrow">Tools</p>
        <h3>CMDB / MCP 工具接入</h3>
      </div>
      <span>只保存连接配置，密钥不会进入模型上下文。</span>
    </header>

    <div class="tool-form">
      <select v-model="form.type" aria-label="工具类型">
        <option value="cmdb">CMDB</option>
        <option value="mcp">MCP</option>
      </select>
      <input v-model="form.name" type="text" placeholder="工具名称" aria-label="工具名称" />
      <input v-model="form.endpoint" type="text" placeholder="Endpoint / MCP URL" aria-label="工具地址" />
      <input v-model="form.token" type="password" placeholder="Token / API Key，可为空" aria-label="工具密钥" />
      <input v-model="form.notes" type="text" placeholder="备注，例如：公司资产 CMDB、ZStack MCP" aria-label="工具备注" />
      <label>
        <input v-model="form.enabled" type="checkbox" />
        启用
      </label>
      <div class="form-actions">
        <button type="button" @click="testIntegration">测试配置</button>
        <button type="button" @click="saveIntegration">保存</button>
        <button type="button" @click="testAndSave">测试并保存</button>
        <button type="button" @click="resetForm">清空</button>
      </div>
    </div>

    <div class="tool-list" aria-label="已配置 CMDB / MCP 工具">
      <article v-for="integration in integrations" :key="integration.id">
        <div>
          <strong>{{ integration.name }}</strong>
          <span>
            {{ integration.type }} / {{ integration.endpoint || "未配置地址" }} /
            {{ integration.enabled ? "已启用" : "未启用" }} /
            密钥：{{ integration.token ? "已保存" : "未保存" }}
          </span>
          <small v-if="integration.lastTestMessage">
            最近测试：{{ integration.lastTestMessage }}
          </small>
        </div>
        <div class="row-actions">
          <button type="button" @click="editIntegration(integration)">编辑</button>
          <button type="button" @click="removeIntegration(integration.id)">删除</button>
        </div>
      </article>
      <p v-if="integrations.length === 0">暂无 CMDB / MCP 工具接入。</p>
    </div>

    <p>{{ message }}</p>
  </section>
</template>

<style scoped>
.tool-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.46);
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
.tool-panel p,
.tool-list span,
.tool-list small {
  color: var(--color-text-muted);
}

.tool-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tool-form input,
.tool-form select {
  min-width: 0;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(2, 6, 23, 0.78);
}

.tool-form label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}

.tool-form label input {
  min-height: auto;
  width: auto;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(14, 165, 233, 0.46);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.14);
  cursor: pointer;
}

.tool-list {
  display: grid;
  gap: 8px;
}

article {
  min-height: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border: 1px solid rgba(38, 50, 71, 0.88);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.66);
}

article > div:first-child {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 920px) {
  .tool-form {
    grid-template-columns: 1fr;
  }
}
</style>
