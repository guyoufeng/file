<script setup lang="ts">
import { ref } from "vue";
import type { Device, Rack } from "../../../types/domain";
import type { ImportValidationResult } from "../../../types/import";
import { parseAndValidateDeviceWorkbook } from "../../../services/import/excelParser";
import ImportPreviewTable from "./ImportPreviewTable.vue";

const props = defineProps<{
  open: boolean;
  racks: Rack[];
  devices: Device[];
  saving?: boolean;
  importSummary?: {
    total: number;
    saved: number;
    failed: number;
    errors: {
      deviceId: string;
      deviceName: string;
      message: string;
    }[];
  } | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [result: ImportValidationResult, replaceExisting: boolean];
}>();

const result = ref<ImportValidationResult | null>(null);
const error = ref<string | null>(null);
const replaceExisting = ref(false);

async function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  result.value = null;
  error.value = null;
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    result.value = parseAndValidateDeviceWorkbook(
      buffer,
      props.racks,
      replaceExisting.value ? [] : props.devices,
    );
  } catch (unknownError) {
    error.value =
      unknownError instanceof Error ? unknownError.message : "Excel 解析失败";
  }
}

function confirmImport() {
  if (!result.value || props.saving) return;
  emit("confirm", result.value, replaceExisting.value);
}
</script>

<template>
  <div v-if="open" class="dialog">
    <div class="panel">
      <header>
        <h3>Excel 导入预览</h3>
        <button type="button" :disabled="saving" @click="emit('close')">
          关闭
        </button>
      </header>
      <p class="hint">
        支持标准模板“设备清单”，也支持当前资产表格式：机柜号、机柜位置、固定资产号、计算机名、IP、外接管理口等列。
        只有没有错误的设备行会被导入。
      </p>
      <label class="replace-option">
        <input v-model="replaceExisting" type="checkbox" :disabled="saving" />
        <span>清空当前设备后导入这份 Excel</span>
      </label>
      <input
        type="file"
        accept=".xlsx,.xls"
        :disabled="saving"
        @change="handleFileChange"
      />
      <p v-if="error" class="error">{{ error }}</p>
      <ImportPreviewTable :result="result" />
      <section
        v-if="importSummary"
        class="import-result"
        :class="{ failed: importSummary.failed > 0 }"
      >
        <div>
          <strong>导入结果</strong>
          <span
            >共 {{ importSummary.total }} 台，成功
            {{ importSummary.saved }} 台，失败
            {{ importSummary.failed }} 台</span
          >
        </div>
        <ul v-if="importSummary.errors.length > 0">
          <li v-for="item in importSummary.errors" :key="item.deviceId">
            {{ item.deviceName }}：{{ item.message }}
          </li>
        </ul>
      </section>
      <footer>
        <button
          type="button"
          :disabled="saving || !result || result.importableRows === 0"
          @click="confirmImport"
        >
          {{
            saving
              ? "正在保存设备..."
              : replaceExisting
                ? `确认替换为 ${result?.importableRows ?? 0} 台设备`
                : `确认追加 ${result?.importableRows ?? 0} 台设备`
          }}
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
  background: var(--modal-backdrop);
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
  background: var(--surface-glass);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.16);
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
  background: var(--control-bg);
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

.replace-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  color: var(--color-text);
  font-size: 13px;
}

.replace-option input {
  width: 16px;
  height: 16px;
}

.error {
  margin: 0;
  color: #fecaca;
}

.import-result {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(16, 185, 129, 0.42);
  border-radius: 8px;
  background: rgba(6, 78, 59, 0.28);
}

.import-result.failed {
  border-color: rgba(245, 158, 11, 0.48);
  background: rgba(120, 53, 15, 0.26);
}

.import-result div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.import-result span {
  color: var(--color-text-muted);
}

.import-result li {
  color: #fed7aa;
}

.import-result ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
}
</style>
