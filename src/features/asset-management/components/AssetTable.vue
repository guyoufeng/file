<script setup lang="ts">
import { computed, ref } from 'vue'
import TableColumnSettings from '../../../components/TableColumnSettings.vue'
import type { Device, Rack } from '../../../types/domain'
import type { DataTableColumn, ResolvedDataTableColumn } from '../../../services/table/tableColumnPreferences'
import { useTableColumnResize } from '../../../services/table/tableColumnResize'

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

const tableColumns: DataTableColumn[] = [
  { id: 'computerName', label: '计算机名', locked: true, width: 210, minWidth: 150 },
  { id: 'businessIp', label: '业务IP', width: 150 },
  { id: 'managementIp', label: '管理IP', width: 150 },
  { id: 'purpose', label: '用途', width: 180 },
  { id: 'model', label: '型号', width: 180 },
  { id: 'rack', label: '所属机柜', width: 130 },
  { id: 'uPosition', label: 'U位', width: 100 },
  { id: 'status', label: '状态', width: 110 },
  { id: 'owner', label: '责任人', width: 120 },
  { id: 'warranty', label: '维保到期', width: 140 },
  { id: 'actions', label: '操作', locked: true, width: 140, minWidth: 120 },
]
const activeColumns = ref<ResolvedDataTableColumn[]>([])
const visibleColumns = computed(() => activeColumns.value.filter((column) => column.visible))
const tableId = 'asset-management'
const { columnWidthStyle, startColumnResize } = useTableColumnResize(
  tableId,
  tableColumns,
  (columns) => {
    activeColumns.value = columns
  },
)
</script>

<template>
  <div class="asset-table">
    <Teleport defer to="#asset-table-column-settings-host">
      <TableColumnSettings
        :table-id="tableId"
        :columns="tableColumns"
        @update:columns="activeColumns = $event"
      />
    </Teleport>
    <table>
      <colgroup>
        <col v-for="column in visibleColumns" :key="column.id" :style="columnWidthStyle(column)" />
      </colgroup>
      <thead>
        <tr>
          <th v-for="column in visibleColumns" :key="column.id" :style="columnWidthStyle(column)">
            <span>{{ column.label }}</span>
            <span
              class="column-resizer"
              aria-hidden="true"
              @pointerdown="startColumnResize(column, $event)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in devices" :key="device.id">
          <td v-for="column in visibleColumns" :key="column.id">
            <template v-if="column.id === 'computerName'">
              <button
                type="button"
                class="asset-link"
                :aria-label="`查看 ${device.computerName || device.name} 资产详情`"
                @click="emit('view', device)"
              >
                {{ device.computerName || device.name }}
              </button>
            </template>
            <template v-else-if="column.id === 'businessIp'">{{ device.businessIp }}</template>
            <template v-else-if="column.id === 'managementIp'">{{ device.managementIp }}</template>
            <template v-else-if="column.id === 'purpose'">{{ device.purpose }}</template>
            <template v-else-if="column.id === 'model'">{{ device.vendor }} {{ device.model }}</template>
            <template v-else-if="column.id === 'rack'">{{ rackName(racks, device.rackId) }}</template>
            <template v-else-if="column.id === 'uPosition'">{{ device.startU }}U-{{ device.endU }}U</template>
            <template v-else-if="column.id === 'status'">{{ device.status }}</template>
            <template v-else-if="column.id === 'owner'">{{ device.owner }}</template>
            <template v-else-if="column.id === 'warranty'">{{ device.warrantyExpireAt }}</template>
            <template v-else-if="column.id === 'actions'">
              <button type="button" @click="emit('edit', device)">编辑</button>
              <button type="button" class="danger" @click="emit('delete', device)">删除</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.asset-table {
  position: relative;
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
  table-layout: fixed;
}

th,
td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

th {
  position: relative;
  color: var(--color-text-muted);
  font-weight: 600;
  background: var(--table-header-bg);
}

th span {
  display: block;
  overflow: hidden;
  padding-right: 10px;
  text-overflow: ellipsis;
}

.column-resizer {
  position: absolute;
  top: 7px;
  right: 0;
  width: 8px;
  height: calc(100% - 14px);
  margin: 0;
  padding: 0;
  border: 0;
  border-right: 2px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  border-radius: 0;
  background: transparent;
  cursor: col-resize;
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
