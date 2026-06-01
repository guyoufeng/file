<script setup lang="ts">
import { computed, ref } from "vue";
import {
  appModules,
  createAccount,
  defaultAccountPermissions,
  deleteAccount,
  getAccounts,
  saveAccount,
  type AccountPermissions,
  type AccountRole,
  type PermissionLevel,
  type UserAccount,
} from "../../../services/auth/accountAccess";

const accounts = ref<UserAccount[]>(getAccounts());
const selectedId = ref(accounts.value[0]?.id ?? "");
const message = ref("管理员可创建账号，并为每个模块配置只读或修改权限。");
const permissionLevels: PermissionLevel[] = ["none", "read", "write"];
const form = ref({
  username: "",
  displayName: "",
  password: "",
  role: "viewer" as AccountRole,
  enabled: true,
});
const selectedAccount = computed(() =>
  accounts.value.find((account) => account.id === selectedId.value),
);
const permissionDraft = ref<AccountPermissions>(defaultAccountPermissions("viewer"));

function refresh() {
  accounts.value = getAccounts();
  if (!accounts.value.some((account) => account.id === selectedId.value)) {
    selectedId.value = accounts.value[0]?.id ?? "";
  }
}

function resetForm() {
  form.value = {
    username: "",
    displayName: "",
    password: "",
    role: "viewer",
    enabled: true,
  };
}

function createNewAccount() {
  try {
    const account = createAccount({
      ...form.value,
      permissions: defaultAccountPermissions(form.value.role),
    });
    message.value = `已创建账号：${account.username}`;
    selectedId.value = account.id;
    permissionDraft.value = { ...account.permissions };
    resetForm();
    refresh();
  } catch (error) {
    message.value = error instanceof Error ? error.message : "创建账号失败";
  }
}

function selectAccount(account: UserAccount) {
  selectedId.value = account.id;
  permissionDraft.value = { ...account.permissions };
}

function setPermission(moduleKey: keyof AccountPermissions, level: PermissionLevel) {
  permissionDraft.value = {
    ...permissionDraft.value,
    [moduleKey]: level,
  };
}

function savePermissions() {
  if (!selectedAccount.value) return;
  saveAccount({
    ...selectedAccount.value,
    permissions: permissionDraft.value,
  });
  message.value = `已保存 ${selectedAccount.value.username} 的权限。`;
  refresh();
}

function toggleAccount(account: UserAccount) {
  saveAccount({
    ...account,
    enabled: !account.enabled,
  });
  message.value = account.enabled ? `已停用账号：${account.username}` : `已启用账号：${account.username}`;
  refresh();
}

function removeAccount(account: UserAccount) {
  if (account.username === "admin") {
    message.value = "默认管理员账号不能删除。";
    return;
  }
  deleteAccount(account.id);
  message.value = `已删除账号：${account.username}`;
  refresh();
}

function roleLabel(role: AccountRole) {
  return role === "admin" ? "管理员" : role === "operator" ? "普通账号" : "只读账号";
}

function permissionLabel(level: PermissionLevel) {
  if (level === "write") return "修改";
  if (level === "read") return "只读";
  return "无权限";
}
</script>

<template>
  <section class="account-panel">
    <header>
      <div>
        <p class="eyebrow">Accounts</p>
        <h3>账号管理</h3>
      </div>
      <span>按模块配置只读、修改或无权限。</span>
    </header>

    <div class="create-box" aria-label="创建账号">
      <input v-model="form.username" type="text" placeholder="账号名" aria-label="账号名" />
      <input v-model="form.displayName" type="text" placeholder="显示名称" aria-label="显示名称" />
      <input v-model="form.password" type="password" placeholder="初始密码" aria-label="初始密码" />
      <select v-model="form.role" aria-label="账号角色">
        <option value="viewer">只读账号</option>
        <option value="operator">普通账号</option>
        <option value="admin">管理员</option>
      </select>
      <label>
        <input v-model="form.enabled" type="checkbox" />
        启用账号
      </label>
      <button type="button" @click="createNewAccount">创建账号</button>
    </div>

    <div class="account-layout">
      <table>
        <thead>
          <tr>
            <th>账号</th>
            <th>显示名称</th>
            <th>角色</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="account in accounts"
            :key="account.id"
            :class="{ active: account.id === selectedId }"
            @click="selectAccount(account)"
          >
            <td>{{ account.username }}</td>
            <td>{{ account.displayName }}</td>
            <td>{{ roleLabel(account.role) }}</td>
            <td>{{ account.enabled ? "启用" : "停用" }}</td>
            <td>
              <button type="button" @click.stop="toggleAccount(account)">
                {{ account.enabled ? "停用" : "启用" }}
              </button>
              <button type="button" @click.stop="removeAccount(account)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <article class="permission-editor" aria-label="账号权限编辑">
        <header>
          <div>
            <strong>{{ selectedAccount?.displayName || "选择账号" }}</strong>
            <span>{{ selectedAccount?.username }}</span>
          </div>
          <button type="button" @click="savePermissions">保存权限</button>
        </header>
        <div class="permission-grid">
          <div v-for="module in appModules" :key="module.key" class="permission-row">
            <strong>{{ module.label }}</strong>
            <div class="segments">
              <button
                v-for="level in permissionLevels"
                :key="level"
                type="button"
                :class="{ active: permissionDraft[module.key] === level }"
                @click="setPermission(module.key, level)"
              >
                {{ permissionLabel(level) }}
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <p class="message">{{ message }}</p>
  </section>
</template>

<style scoped>
.account-panel {
  display: grid;
  gap: 14px;
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

h3,
p {
  margin: 0;
}

header span,
.message,
.permission-editor span {
  color: var(--color-text-muted);
}

.create-box {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto auto;
  gap: 8px;
}

input,
select,
button {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(2, 6, 23, 0.78);
}

input,
select {
  min-width: 0;
  padding: 0 10px;
}

button {
  padding: 0 10px;
  cursor: pointer;
}

.create-box label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-muted);
}

.create-box label input {
  min-height: auto;
}

.account-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  gap: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border: 1px solid rgba(38, 50, 71, 0.82);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.58);
}

th,
td {
  height: 42px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(38, 50, 71, 0.72);
  text-align: left;
}

th {
  color: #bae6fd;
  font-size: 12px;
}

td {
  color: var(--color-text-muted);
}

tr.active td {
  background: rgba(14, 165, 233, 0.1);
  color: var(--color-text);
}

td button + button {
  margin-left: 6px;
}

.permission-editor {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(38, 50, 71, 0.82);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.58);
}

.permission-editor header {
  align-items: start;
}

.permission-editor header > div {
  display: grid;
  gap: 4px;
}

.permission-grid {
  display: grid;
  gap: 8px;
}

.permission-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.permission-row strong {
  color: #dbeafe;
}

.segments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.segments button.active {
  border-color: rgba(14, 165, 233, 0.72);
  color: #e0f2fe;
  background: rgba(14, 165, 233, 0.18);
}

@media (max-width: 1100px) {
  .create-box,
  .account-layout {
    grid-template-columns: 1fr;
  }
}
</style>
