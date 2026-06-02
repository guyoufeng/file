<script setup lang="ts">
import type { Device, Rack } from '../../../types/domain'

defineProps<{
  devices: Device[]
  racks: Rack[]
}>()

const emit = defineEmits<{
  view: [device: Device]
  edit: [device: Device]
  delete: [device: Device]
}>()

function rackName(racks: Rack[], rackId: string): string {
  return racks.find((rack) => rack.id === rackId)?.name ?? rackId
}
</script>

<template>
  <div class="asset-table">
    <table>
      <thead>
        <tr>
          <th>计算机名</th>
          <th>业务IP</th>
          <th>管理IP</th>
          <th>用途</th>
          <th>型号</th>
          <th>所属机柜</th>
          <th>U位</th>
          <th>状态</th>
          <th>责任人</th>
          <th>维保到期</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in devices" :key="device.id">
          <td>
            <button
              type="button"
              class="asset-link"
              :aria-label="`查看 ${device.computerName || device.name} 资产详情`"
              @click="emit('view', device)"
            >
              {{ device.computerName || device.name }}
            </button>
          </td>
          <td>{{ device.businessIp }}</td>
          <td>{{ device.managementIp }}</td>
          <td>{{ device.purpose }}</td>
          <td>{{ device.vendor }} {{ device.model }}</td>
          <td>{{ rackName(racks, device.rackId) }}</td>
          <td>{{ device.startU }}U-{{ device.endU }}U</td>
          <td>{{ device.status }}</td>
          <td>{{ device.owner }}</td>
          <td>{{ device.warrantyExpireAt }}</td>
          <td>
            <button type="button" @click="emit('edit', device)">编辑</button>
            <button type="button" class="danger" @click="emit('delete', device)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.asset-table {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  box-shadow: var(--shadow-soft);
}

table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}

th,
td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--color-text-muted);
  font-weight: 600;
  background: var(--table-header-bg);
}

button {
  margin-right: 6px;
  border: 0;
  color: #7dd3fc;
  background: transparent;
  cursor: pointer;
}

.asset-link {
  margin: 0;
  padding: 0;
  font-weight: 700;
}

.danger {
  color: #fca5a5;
}
</style>
