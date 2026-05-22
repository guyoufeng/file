<script setup lang="ts">
import { ref } from 'vue'
import type { Device, Rack } from '../../../types/domain'
import type { ImportValidationResult } from '../../../types/import'
import { parseAndValidateDeviceWorkbook } from '../../../services/import/excelParser'
import ImportPreviewTable from './ImportPreviewTable.vue'

const props = defineProps<{
  open: boolean
  racks: Rack[]
  devices: Device[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [result: ImportValidationResult]
}>()

const result = ref<ImportValidationResult | null>(null)
const error = ref<string | null>(null)

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  result.value = null
  error.value = null
  if (!file) return

  try {
    const buffer = await file.arrayBuffer()
    result.value = parseAndValidateDeviceWorkbook(buffer, props.racks, props.devices)
  } catch (unknownError) {
    error.value = unknownError instanceof Error ? unknownError.message : 'Excel 解析失败'
  }
}

function confirmImport() {
  if (!result.value) return
  emit('confirm', result.value)
}
</script>

<template>
  <div v-if="open" class="dialog">
    <div class="panel">
      <header>
        <h3>Excel 导入预览</h3>
        <button type="button" @click="emit('close')">关闭</button>
      </header>
      <p class="hint">请选择包含“机柜清单”和“设备清单”的 Excel 文件。只有没有错误的设备行会被导入。</p>
      <input type="file" accept=".xlsx,.xls" @change="handleFileChange" />
      <p v-if="error" class="error">{{ error }}</p>
      <ImportPreviewTable :result="result" />
      <footer>
        <button type="button" :disabled="!result || result.importableRows === 0" @click="confirmImport">
          确认导入 {{ result?.importableRows ?? 0 }} 台设备
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.46);
}

.panel {
  width: min(1080px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #08111f;
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h3,
.hint {
  margin: 0;
}

.hint {
  color: var(--color-text-muted);
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

button:not(:disabled):last-child {
  border-color: rgba(14, 165, 233, 0.7);
  background: rgba(14, 165, 233, 0.18);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

input {
  color: var(--color-text);
}

.error {
  margin: 0;
  color: #fecaca;
}
</style>
