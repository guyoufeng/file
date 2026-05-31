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
import {
  getAgentRoleDefinition,
  resetAgentRoleDefinition,
  saveAgentRoleDefinition,
} from "../../../services/ai/agentIdentity";
import {
  addAgentMemory,
  clearAgentMemories,
  getAgentMemories,
  type AgentMemory,
} from "../../../services/ai/agentMemory";
import {
  addCustomAgentSkill,
  getCustomAgentSkills,
} from "../../../services/ai/agentCustomSkills";
import type { AiSkillDefinition } from "../../../services/ai/agentProfile";
import {
  addKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeEntries,
  type KnowledgeEntry,
} from "../../../services/ai/agentKnowledgeBase";
import {
  deleteAgentCredential,
  getAgentCredentials,
  saveAgentCredential,
  type AgentCredential,
  type AgentCredentialType,
} from "../../../services/ai/agentCredentials";

const settings = ref<AiAgentCapabilitySettings>(getAiAgentCapabilitySettings());
const message = ref("AI Agent 第一阶段默认只读，外网辅助默认关闭。");
const apiHealth = ref<AgentReadonlyHealth | null>(null);
const apiTools = ref<AgentReadonlyTool[]>([]);
const apiLoading = ref(false);
const apiMessage = ref("点击测试 API，确认只读 Agent API 和工具清单可用。");
const tokenSettings = ref<AgentReadonlyTokenSettings>({ enabled: false });
const tokenValue = ref(getStoredAgentReadonlyToken() ?? "");
const tokenMessage = ref("令牌只用于只读查询，外部 Agent 不能通过该令牌修改平台数据。");
const roleDefinition = ref(getAgentRoleDefinition());
const memoryInput = ref("");
const memories = ref<AgentMemory[]>(getAgentMemories());
const skillInput = ref("");
const customSkills = ref<AiSkillDefinition[]>(getCustomAgentSkills());
const knowledgeEntries = ref<KnowledgeEntry[]>(getKnowledgeEntries());
const knowledgeForm = ref({
  title: "",
  content: "",
  tags: "",
});
const credentials = ref<AgentCredential[]>(getAgentCredentials());
const credentialForm = ref<{
  type: AgentCredentialType;
  name: string;
  endpoint: string;
  username: string;
  secret: string;
  notes: string;
}>({
  type: "zoho",
  name: "",
  endpoint: "",
  username: "",
  secret: "",
  notes: "",
});
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

function saveRoleDefinition() {
  roleDefinition.value = saveAgentRoleDefinition(roleDefinition.value);
  message.value = "AI Agent 角色定义已保存。";
}

function restoreDefaultRoleDefinition() {
  roleDefinition.value = resetAgentRoleDefinition();
  message.value = "AI Agent 角色定义已恢复默认。";
}

function addMemory() {
  if (!memoryInput.value.trim()) return;
  addAgentMemory(memoryInput.value);
  memoryInput.value = "";
  memories.value = getAgentMemories();
  message.value = "长期记忆已写入。";
}

function clearMemoryList() {
  clearAgentMemories();
  memories.value = [];
  message.value = "长期记忆已清空。";
}

function addSkill() {
  if (!skillInput.value.trim()) return;
  try {
    addCustomAgentSkill(skillInput.value);
    skillInput.value = "";
    customSkills.value = getCustomAgentSkills();
    message.value = "自定义 Skill 已保存。";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "保存 Skill 失败";
  }
}

function addKnowledge() {
  if (!knowledgeForm.value.content.trim()) return;
  addKnowledgeEntry({
    title: knowledgeForm.value.title || knowledgeForm.value.content.slice(0, 24),
    content: knowledgeForm.value.content,
    tags: knowledgeForm.value.tags
      .split(/[,\s，、]+/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    sourceType: "manual",
  });
  knowledgeForm.value = { title: "", content: "", tags: "" };
  knowledgeEntries.value = getKnowledgeEntries();
  message.value = "知识库内容已保存。";
}

async function importKnowledgeFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  for (const file of files) {
    const isTextFile =
      file.type.startsWith("text/") ||
      /\.(md|txt|json|csv|log|yaml|yml)$/i.test(file.name);
    const content = isTextFile
      ? await file.text()
      : `文件 ${file.name} 已上传，当前版本暂未解析该二进制附件内容。`;
    addKnowledgeEntry({
      title: file.name,
      content,
      sourceType: "attachment",
      tags: ["附件"],
    });
  }
  input.value = "";
  knowledgeEntries.value = getKnowledgeEntries();
  message.value = `已导入 ${files.length} 个知识库附件。`;
}

function removeKnowledge(id: string) {
  deleteKnowledgeEntry(id);
  knowledgeEntries.value = getKnowledgeEntries();
  message.value = "知识库条目已删除。";
}

function saveCredential() {
  if (!credentialForm.value.name.trim()) return;
  saveAgentCredential({
    type: credentialForm.value.type,
    name: credentialForm.value.name,
    endpoint: credentialForm.value.endpoint,
    username: credentialForm.value.username,
    secret: credentialForm.value.secret,
    notes: credentialForm.value.notes,
  });
  credentialForm.value = {
    type: "zoho",
    name: "",
    endpoint: "",
    username: "",
    secret: "",
    notes: "",
  };
  credentials.value = getAgentCredentials();
  message.value = "账号凭据已保存，AI 只会看到脱敏目录。";
}

function removeCredential(id: string) {
  deleteAgentCredential(id);
  credentials.value = getAgentCredentials();
  message.value = "账号凭据已删除。";
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

    <section class="agent-workbench" aria-label="AI Agent 工作台">
      <article class="workbench-panel role-panel">
        <header>
          <div>
            <p class="eyebrow">Role</p>
            <h3>角色定义</h3>
          </div>
          <div class="inline-actions">
            <button type="button" @click="saveRoleDefinition">保存角色</button>
            <button type="button" @click="restoreDefaultRoleDefinition">恢复默认</button>
          </div>
        </header>
        <textarea
          v-model="roleDefinition"
          rows="8"
          aria-label="AI Agent 角色定义"
        />
      </article>

      <article class="workbench-panel">
        <header>
          <div>
            <p class="eyebrow">Memory</p>
            <h3>长期记忆</h3>
          </div>
          <button type="button" @click="clearMemoryList">清空记忆</button>
        </header>
        <div class="inline-form">
          <input
            v-model="memoryInput"
            type="text"
            placeholder="例如：以后回答默认使用中文，并优先围绕数据中心运维"
            aria-label="新增长期记忆"
            @keydown.enter.prevent="addMemory"
          />
          <button type="button" @click="addMemory">写入记忆</button>
        </div>
        <ul class="compact-list">
          <li v-for="memory in memories" :key="memory.id">{{ memory.content }}</li>
          <li v-if="memories.length === 0">暂无长期记忆。</li>
        </ul>
      </article>

      <article class="workbench-panel">
        <header>
          <div>
            <p class="eyebrow">Skill</p>
            <h3>Skill 管理</h3>
          </div>
        </header>
        <div class="inline-form">
          <input
            v-model="skillInput"
            type="text"
            placeholder="格式：卓豪告警查询: 说明接口调用步骤和注意事项"
            aria-label="新增 Skill"
            @keydown.enter.prevent="addSkill"
          />
          <button type="button" @click="addSkill">保存 Skill</button>
        </div>
        <ul class="compact-list">
          <li v-for="skill in customSkills" :key="skill.name">
            <strong>{{ skill.name }}</strong>
            <span>{{ skill.description }}</span>
          </li>
          <li v-if="customSkills.length === 0">暂无自定义 Skill。</li>
        </ul>
      </article>

      <article class="workbench-panel">
        <header>
          <div>
            <p class="eyebrow">Knowledge</p>
            <h3>知识库</h3>
          </div>
          <label class="upload-button">
            上传附件
            <input
              type="file"
              multiple
              accept=".md,.txt,.json,.csv,.log,.yaml,.yml,text/*"
              @change="importKnowledgeFiles"
            />
          </label>
        </header>
        <div class="knowledge-form">
          <input
            v-model="knowledgeForm.title"
            type="text"
            placeholder="标题"
            aria-label="知识库标题"
          />
          <input
            v-model="knowledgeForm.tags"
            type="text"
            placeholder="标签，用逗号分隔"
            aria-label="知识库标签"
          />
          <textarea
            v-model="knowledgeForm.content"
            rows="4"
            placeholder="录入运维经验、监控接口说明、巡检步骤或故障处理方法"
            aria-label="知识库内容"
          />
          <button type="button" @click="addKnowledge">保存知识</button>
        </div>
        <ul class="compact-list">
          <li v-for="entry in knowledgeEntries" :key="entry.id">
            <strong>{{ entry.title }}</strong>
            <span>{{ entry.content.slice(0, 80) }}</span>
            <button type="button" @click="removeKnowledge(entry.id)">删除</button>
          </li>
          <li v-if="knowledgeEntries.length === 0">暂无知识库内容。</li>
        </ul>
      </article>

      <article class="workbench-panel credential-panel">
        <header>
          <div>
            <p class="eyebrow">Credential</p>
            <h3>账号凭据</h3>
          </div>
          <span>凭据只给工具执行器使用，AI 提示词只包含脱敏目录。</span>
        </header>
        <div class="credential-form">
          <select v-model="credentialForm.type" aria-label="凭据类型">
            <option value="zoho">卓豪</option>
            <option value="prometheus">Prometheus</option>
            <option value="cmdb">CMDB</option>
            <option value="zstack">ZStack</option>
            <option value="webhook">Webhook</option>
            <option value="other">其他</option>
          </select>
          <input v-model="credentialForm.name" type="text" placeholder="名称" aria-label="凭据名称" />
          <input v-model="credentialForm.endpoint" type="text" placeholder="URL / Endpoint" aria-label="凭据地址" />
          <input v-model="credentialForm.username" type="text" placeholder="账号，可为空" aria-label="凭据账号" />
          <input v-model="credentialForm.secret" type="password" placeholder="密码 / Token / API Key" aria-label="凭据密钥" />
          <input v-model="credentialForm.notes" type="text" placeholder="备注" aria-label="凭据备注" />
          <button type="button" @click="saveCredential">保存凭据</button>
        </div>
        <ul class="compact-list">
          <li v-for="credential in credentials" :key="credential.id">
            <strong>{{ credential.name }}</strong>
            <span>{{ credential.type }} / {{ credential.endpoint || "未配置地址" }} / 密钥：{{ credential.secret ? "已保存" : "未保存" }}</span>
            <button type="button" @click="removeCredential(credential.id)">删除</button>
          </li>
          <li v-if="credentials.length === 0">暂无账号凭据。</li>
        </ul>
      </article>
    </section>

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

.agent-workbench {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.workbench-panel {
  min-height: 0;
  display: grid;
  align-items: stretch;
  justify-content: stretch;
  gap: 12px;
}

.role-panel,
.credential-panel {
  grid-column: 1 / -1;
}

.workbench-panel header {
  align-items: flex-start;
}

.workbench-panel header > span {
  max-width: 420px;
  font-size: 12px;
}

.inline-actions,
.inline-form,
.credential-form {
  display: grid;
  gap: 8px;
}

.inline-actions {
  grid-template-columns: repeat(2, auto);
}

.inline-form {
  grid-template-columns: minmax(0, 1fr) auto;
}

.knowledge-form,
.credential-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.knowledge-form {
  display: grid;
  gap: 8px;
}

.knowledge-form textarea,
.knowledge-form button {
  grid-column: 1 / -1;
}

.credential-form {
  display: grid;
}

.credential-form button {
  grid-column: 1 / -1;
}

.workbench-panel input,
.workbench-panel select,
.workbench-panel textarea {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(2, 6, 23, 0.78);
}

.workbench-panel input,
.workbench-panel select {
  min-height: 34px;
  padding: 0 10px;
}

.workbench-panel textarea {
  resize: vertical;
  padding: 10px;
  line-height: 1.55;
}

.workbench-panel button,
.upload-button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(14, 165, 233, 0.46);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.14);
  cursor: pointer;
}

.upload-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.upload-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.compact-list {
  max-height: 190px;
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.compact-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  padding: 9px;
  border: 1px solid rgba(38, 50, 71, 0.78);
  border-radius: 8px;
  color: var(--color-text-muted);
  background: rgba(2, 6, 23, 0.45);
  font-size: 12px;
}

.compact-list li strong,
.compact-list li > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-list li strong {
  grid-column: 1;
  color: var(--color-text);
}

.compact-list li > span {
  grid-column: 1;
}

.compact-list li button {
  grid-row: 1 / span 2;
  grid-column: 2;
  min-height: 26px;
  padding: 0 8px;
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

  .agent-workbench,
  .inline-form,
  .knowledge-form,
  .credential-form {
    grid-template-columns: 1fr;
  }

  .role-panel,
  .credential-panel,
  .knowledge-form textarea,
  .knowledge-form button,
  .credential-form button {
    grid-column: auto;
  }

  .token-controls {
    grid-template-columns: 1fr;
  }
}
</style>
