<script setup lang="ts">
import { computed, ref } from "vue";
import AssetSyncDialog from "../asset-management/components/AssetSyncDialog.vue";
import {
  filterVirtualServers,
  sampleVirtualServers,
  type VirtualServer,
} from "./virtualServers";
import type { AssetSyncConfig } from "../../services/asset/assetSyncConfig";

const search = ref("");
const syncOpen = ref(false);
const servers = ref<VirtualServer[]>(sampleVirtualServers);
const message = ref("虚拟服务器独立管理，不占用机柜 U 位，通过宿主物理服务器关联到数据中心。");

const filteredServers = computed(() =>
  filterVirtualServers(servers.value, search.value),
);

function confirmMcpSync(config: AssetSyncConfig) {
  syncOpen.value = false;
  message.value = `已保存 ${config.name} 配置，后续可通过 ZStack MCP 同步虚拟服务器。`;
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">虚拟服务器管理</h2>
        <p class="page-subtitle">
          管理 ZStack、VMware 等虚拟机资源，并关联承载它们的虚拟化物理服务器。
        </p>
      </div>
    </div>

    <div class="virtual-toolbar">
      <input v-model="search" type="search" placeholder="搜索虚拟机名、业务IP、用途、责任人、宿主服务器" />
      <button type="button">手动录入</button>
      <button type="button">Excel导入</button>
      <button type="button" @click="syncOpen = true">MCP同步</button>
    </div>

    <p class="virtual-message">{{ message }}</p>

    <div class="virtual-table">
      <table>
        <thead>
          <tr>
            <th>虚拟机名</th>
            <th>业务IP</th>
            <th>平台</th>
            <th>用途</th>
            <th>责任人</th>
            <th>宿主物理服务器</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="server in filteredServers" :key="server.id">
            <td>{{ server.name }}</td>
            <td>{{ server.businessIp || '-' }}</td>
            <td>{{ server.platform }}</td>
            <td>{{ server.purpose || '-' }}</td>
            <td>{{ server.owner || '-' }}</td>
            <td>{{ server.hostDeviceName || '未关联' }}</td>
            <td>{{ server.status }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <AssetSyncDialog
      :open="syncOpen"
      type="mcp"
      @close="syncOpen = false"
      @confirm="confirmMcpSync"
    />
  </section>
</template>

<style scoped>
.virtual-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

input {
  width: min(520px, 100%);
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.92);
}

button {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(14, 165, 233, 0.64);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(14, 165, 233, 0.16);
  cursor: pointer;
}

.virtual-message {
  color: var(--color-text-muted);
}

.virtual-table {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

th,
td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

th {
  color: var(--color-text-muted);
  background: rgba(8, 17, 31, 0.72);
}
</style>
