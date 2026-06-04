<script setup lang="ts">
import { computed, ref } from 'vue'
import TableColumnSettings from '../../../components/TableColumnSettings.vue'
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import { getAlertDeviceContext } from '../../../services/alerts/alertFilters'
import { getAlertStatusLabel } from '../../../services/alerts/alertWorkflow'
import type { DataTableColumn, ResolvedDataTableColumn } from '../../../services/table/tableColumnPreferences'

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

const tableColumns: DataTableColumn[] = [
  { id: 'select', label: '选择', locked: true },
  { id: 'level', label: '级别' },
  { id: 'title', label: '标题', locked: true },
  { id: 'device', label: '设备' },
  { id: 'location', label: '位置' },
  { id: 'source', label: '来源' },
  { id: 'status', label: '状态' },
  { id: 'startedAt', label: '开始时间' },
  { id: 'actions', label: '操作', locked: true },
]
const activeColumns = ref<ResolvedDataTableColumn[]>([])
const visibleColumns = computed(() => activeColumns.value.filter((column) => column.visible))
</script>

<template>
  <div class="alert-table">
    <div class="alert-table-toolbar">
      <TableColumnSettings
        table-id="alert-center"
        :columns="tableColumns"
        @update:columns="activeColumns = $event"
      />
    </div>
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
            <template v-else-if="column.id === 'device'">{{ getAlertDeviceContext(alert, devices, racks, rooms).device?.computerName }}</template>
            <template v-else-if="column.id === 'location'">{{ getAlertDeviceContext(alert, devices, racks, rooms).location }}</template>
            <template v-else-if="column.id === 'source'">{{ alert.source }}</template>
            <template v-else-if="column.id === 'status'">{{ getAlertStatusLabel(alert.status) }}</template>
            <template v-else-if="column.id === 'startedAt'">{{ alert.startedAt }}</template>
            <template v-else-if="column.id === 'actions'">
              <button type="button" @click="emit('edit', alert)">编辑</button>
              <button type="button" @click="emit('locate', alert)">定位</button>
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

.alert-table-toolbar {
  position: sticky;
  left: 0;
  display: flex;
  justify-content: flex-end;
  padding: 10px 10px 0;
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
