<script setup lang="ts">
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import { getAlertDeviceContext } from '../../../services/alerts/alertFilters'
import { getAlertStatusLabel } from '../../../services/alerts/alertWorkflow'

defineProps<{
  alerts: Alert[]
  devices: Device[]
  racks: Rack[]
  rooms: Room[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  locate: [alert: Alert]
  edit: [alert: Alert]
  toggle: [alertId: string]
  toggleAll: []
}>()
</script>

<template>
  <div class="alert-table">
    <table>
      <thead>
        <tr>
          <th><input type="checkbox" :checked="alerts.length > 0 && selectedIds.length === alerts.length" @change="emit('toggleAll')" /></th>
          <th>级别</th>
          <th>标题</th>
          <th>设备</th>
          <th>位置</th>
          <th>来源</th>
          <th>状态</th>
          <th>开始时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alert in alerts" :key="alert.id" :class="alert.level">
          <td><input type="checkbox" :checked="selectedIds.includes(alert.id)" @change="emit('toggle', alert.id)" /></td>
          <td>{{ alert.level }}</td>
          <td>{{ alert.title }}</td>
          <td>{{ getAlertDeviceContext(alert, devices, racks, rooms).device?.computerName }}</td>
          <td>{{ getAlertDeviceContext(alert, devices, racks, rooms).location }}</td>
          <td>{{ alert.source }}</td>
          <td>{{ getAlertStatusLabel(alert.status) }}</td>
          <td>{{ alert.startedAt }}</td>
          <td>
            <button type="button" @click="emit('edit', alert)">编辑</button>
            <button type="button" @click="emit('locate', alert)">定位</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.alert-table {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  box-shadow: var(--shadow-soft);
}

table {
  width: 100%;
  min-width: 980px;
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
  background: var(--table-header-bg);
}

tr.critical td:first-child {
  color: #fca5a5;
}

tr.warning td:first-child {
  color: #fbbf24;
}

button {
  border: 0;
  color: #7dd3fc;
  background: transparent;
  cursor: pointer;
}
</style>
