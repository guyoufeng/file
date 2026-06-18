<script setup lang="ts">
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import { getAlertDeviceContext } from '../../../services/alerts/alertFilters'
import { getAlertStatusLabel } from '../../../services/alerts/alertWorkflow'
import type { ResolvedDataTableColumn } from '../../../services/table/tableColumnPreferences'

defineProps<{
  alerts: Alert[]
  devices: Device[]
  racks: Rack[]
  rooms: Room[]
  selectedIds: string[]
  visibleColumns: ResolvedDataTableColumn[]
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
          <th v-for="column in visibleColumns" :key="column.id">
            <template v-if="column.id === 'select'">
              <input type="checkbox" :checked="alerts.length > 0 && selectedIds.length === alerts.length" @change="emit('toggleAll')" />
            </template>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alert in alerts" :key="alert.id" :class="alert.level">
          <td v-for="column in visibleColumns" :key="column.id">
            <template v-if="column.id === 'select'">
              <input type="checkbox" :checked="selectedIds.includes(alert.id)" @change="emit('toggle', alert.id)" />
            </template>
            <template v-else-if="column.id === 'level'">{{ alert.level }}</template>
            <template v-else-if="column.id === 'title'">{{ alert.title }}</template>
            <template v-else-if="column.id === 'device'">{{ getAlertDeviceContext(alert, devices, racks, rooms).device?.computerName || '-' }}</template>
            <template v-else-if="column.id === 'location'">{{ getAlertDeviceContext(alert, devices, racks, rooms).location || '-' }}</template>
            <template v-else-if="column.id === 'source'">{{ alert.source }}</template>
            <template v-else-if="column.id === 'status'">{{ getAlertStatusLabel(alert.status) }}</template>
            <template v-else-if="column.id === 'startedAt'">{{ alert.startedAt }}</template>
            <template v-else-if="column.id === 'actions'">
              <button type="button" @click="emit('edit', alert)">编辑</button>
              <button type="button" :disabled="!alert.deviceId" @click="emit('locate', alert)">定位</button>
            </template>
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

button:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.52;
}
</style>
