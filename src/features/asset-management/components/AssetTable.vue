<script setup lang="ts">
import type { Device, Rack } from '../../../types/domain'

defineProps<{
  devices: Device[]
  racks: Rack[]
}>()

const emit = defineEmits<{
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
          <td>{{ device.computerName }}</td>
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
  background: rgba(17, 24, 39, 0.82);
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
  background: rgba(8, 17, 31, 0.72);
}

button {
  margin-right: 6px;
  border: 0;
  color: #7dd3fc;
  background: transparent;
  cursor: pointer;
}

.danger {
  color: #fca5a5;
}
</style>
