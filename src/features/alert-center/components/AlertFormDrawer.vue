<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Alert, Device } from '../../../types/domain'
import { alertStatusOptions } from '../../../services/alerts/alertWorkflow'

const props = defineProps<{
  open: boolean
  devices: Device[]
  alert?: Alert | null
}>()

const emit = defineEmits<{
  close: []
  save: [alert: Alert]
}>()

const form = reactive({
  title: '手工严重告警',
  level: 'critical' as Alert['level'],
  deviceId: '',
  source: 'manual' as Alert['source'],
  status: 'unconfirmed' as Alert['status'],
  startedAt: new Date().toISOString(),
  recoveredAt: '',
  description: '',
  suggestion: '',
  remark: '',
  solution: '',
  attachments: '',
})

watch(
  () => props.alert,
  (alert) => {
    if (!alert) return
    form.title = alert.title
    form.level = alert.level
    form.deviceId = alert.deviceId
    form.source = alert.source
    form.status = alert.status
    form.startedAt = alert.startedAt
    form.recoveredAt = alert.recoveredAt ?? ''
    form.description = alert.description ?? ''
    form.suggestion = ''
    form.remark = ''
    form.solution = ''
    form.attachments = ''
  },
  { immediate: true },
)

function handleFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  form.attachments = files.map((file) => file.name).join('、')
}

function submit() {
  if (!form.deviceId || !form.title) return
  emit('save', {
    id: props.alert?.id ?? `alert-local-${Date.now()}`,
    deviceId: form.deviceId,
    source: form.source,
    level: form.level,
    status: form.status,
    title: form.title,
    description: [
      form.description,
      form.suggestion ? `建议：${form.suggestion}` : '',
      form.solution ? `处理方法：${form.solution}` : '',
      form.attachments ? `附件/照片：${form.attachments}` : '',
      form.remark ? `备注：${form.remark}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    startedAt: form.startedAt,
    recoveredAt: form.recoveredAt || undefined,
  })
}
</script>

<template>
  <div v-if="open" class="drawer">
    <aside>
      <header>
        <h3>{{ alert ? '编辑告警' : '新增手工告警' }}</h3>
        <button type="button" @click="emit('close')">关闭</button>
      </header>
      <form @submit.prevent="submit">
        <label>标题<input v-model="form.title" /></label>
        <label>级别<select v-model="form.level"><option value="info">信息</option><option value="warning">警告</option><option value="critical">严重</option></select></label>
        <label>设备<select v-model="form.deviceId"><option value="">请选择设备</option><option v-for="device in devices" :key="device.id" :value="device.id">{{ device.computerName }}</option></select></label>
        <label>来源<select v-model="form.source"><option value="manual">manual</option><option value="prometheus">prometheus</option><option value="zoho">zoho</option><option value="custom">custom</option></select></label>
        <label>状态<select v-model="form.status"><option v-for="option in alertStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label>开始时间<input v-model="form.startedAt" /></label>
        <label>恢复时间<input v-model="form.recoveredAt" /></label>
        <label class="wide">描述<textarea v-model="form.description" /></label>
        <label class="wide">建议<textarea v-model="form.suggestion" /></label>
        <label class="wide">处理方法<textarea v-model="form.solution" /></label>
        <label class="wide">附件/照片<input type="file" multiple @change="handleFiles" /><span class="file-list">{{ form.attachments || '暂未选择附件' }}</span></label>
        <label class="wide">备注<textarea v-model="form.remark" /></label>
        <button class="primary" type="submit">保存告警</button>
      </form>
    </aside>
  </div>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.38);
}

aside {
  width: min(520px, 100vw);
  height: 100vh;
  overflow: auto;
  padding: 18px;
  border-left: 1px solid var(--color-border);
  background: #08111f;
}

header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

h3 {
  margin: 0;
}

form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
}

.wide,
.primary {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
}

.file-list {
  color: var(--color-text-muted);
  font-size: 12px;
}

button {
  min-height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

.primary {
  border-color: rgba(239, 68, 68, 0.72);
  background: rgba(239, 68, 68, 0.16);
}
</style>
