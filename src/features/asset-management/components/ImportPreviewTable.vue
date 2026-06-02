<script setup lang="ts">
import type { ImportValidationResult } from '../../../types/import'

defineProps<{
  result: ImportValidationResult | null
}>()
</script>

<template>
  <div v-if="result" class="preview">
    <div class="summary">
      <div><strong>{{ result.totalRows }}</strong><span>总行数</span></div>
      <div><strong>{{ result.importableRows }}</strong><span>可导入</span></div>
      <div><strong>{{ result.errorRows }}</strong><span>错误行</span></div>
      <div><strong>{{ result.warningRows }}</strong><span>警告行</span></div>
      <div><strong>{{ result.newDevices }}</strong><span>新设备</span></div>
      <div><strong>{{ result.skippedDuplicateDevices }}</strong><span>跳过重复</span></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>行号</th>
            <th>计算机名</th>
            <th>机柜</th>
            <th>U位</th>
            <th>资产编号</th>
            <th>SN号</th>
            <th>错误</th>
            <th>警告</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in result.rows" :key="item.row.rowIndex" :class="{ error: item.errors.length > 0 }">
            <td>{{ item.row.rowIndex }}</td>
            <td>{{ item.row.computerName }}</td>
            <td>{{ item.row.rackName }}</td>
            <td>{{ item.row.startU }}U / {{ item.row.heightU }}U</td>
            <td>{{ item.row.assetNo }}</td>
            <td>{{ item.row.serialNumber }}</td>
            <td>{{ item.errors.join('；') }}</td>
            <td>{{ item.warnings.join('；') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: grid;
  gap: 12px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.summary div {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

.summary strong {
  font-size: 20px;
}

.summary span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--color-text-muted);
  background: var(--table-header-bg);
}

tr.error td {
  color: #fecaca;
}
</style>
