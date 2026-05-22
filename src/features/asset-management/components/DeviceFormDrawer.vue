<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Device, Rack, Room } from '../../../types/domain'
import { getEndU } from '../../../services/rack/uPosition'
import { hasUConflict, validateDeviceForm } from '../../../services/assets/deviceValidation'

const props = defineProps<{
  open: boolean
  device: Device | null
  rooms: Room[]
  racks: Rack[]
  devices: Device[]
}>()

const emit = defineEmits<{
  close: []
  save: [device: Device]
}>()

const form = reactive({
  computerName: '',
  roomId: '',
  rackId: '',
  side: 'front' as 'front' | 'rear',
  startU: 1,
  heightU: 1,
  categoryId: 'server',
  subtype: '物理服务器',
  businessIp: '',
  managementIp: '',
  purpose: '',
  owner: '',
  vendor: '',
  model: '',
  serialNumber: '',
  assetNo: '',
  warrantyExpireAt: '',
  hardwareSpec: '',
  operatingSystem: '',
})

const errors = reactive<string[]>([])
const roomRacks = computed(() => props.racks.filter((rack) => rack.roomId === form.roomId))

watch(
  () => props.device,
  (device) => {
    const rack = props.racks.find((item) => item.id === device?.rackId)
    form.computerName = device?.computerName ?? ''
    form.roomId = rack?.roomId ?? props.rooms[0]?.id ?? ''
    form.rackId = device?.rackId ?? ''
    form.side = device?.side ?? 'front'
    form.startU = device?.startU ?? 1
    form.heightU = device?.heightU ?? 1
    form.categoryId = device?.categoryId ?? 'server'
    form.subtype = device?.subtype ?? '物理服务器'
    form.businessIp = device?.businessIp ?? ''
    form.managementIp = device?.managementIp ?? ''
    form.purpose = device?.purpose ?? ''
    form.owner = device?.owner ?? ''
    form.vendor = device?.vendor ?? ''
    form.model = device?.model ?? ''
    form.serialNumber = device?.serialNumber ?? ''
    form.assetNo = device?.assetNo ?? ''
    form.warrantyExpireAt = device?.warrantyExpireAt ?? ''
    form.hardwareSpec = device?.hardwareSpec ?? ''
    form.operatingSystem = device?.operatingSystem ?? ''
    errors.splice(0)
  },
  { immediate: true },
)

function submit() {
  const validation = validateDeviceForm({ ...form, id: props.device?.id })
  errors.splice(0, errors.length, ...validation.errors)
  if (hasUConflict({ ...form, id: props.device?.id }, props.devices)) {
    errors.push('同一机柜同一安装面 U 位冲突')
  }
  if (errors.length > 0) return

  const id = props.device?.id ?? `dev-local-${Date.now()}`
  emit('save', {
    id,
    name: form.computerName,
    computerName: form.computerName,
    rackId: form.rackId,
    categoryId: form.categoryId,
    subtype: form.subtype,
    businessIp: form.businessIp,
    managementIp: form.managementIp,
    ips: [form.businessIp, form.managementIp].filter(Boolean),
    purpose: form.purpose,
    owner: form.owner,
    vendor: form.vendor,
    model: form.model,
    serialNumber: form.serialNumber,
    assetNo: form.assetNo,
    warrantyExpireAt: form.warrantyExpireAt,
    hardwareSpec: form.hardwareSpec,
    operatingSystem: form.operatingSystem,
    side: form.side,
    startU: form.startU,
    endU: getEndU(form.startU, form.heightU),
    heightU: form.heightU,
    status: props.device?.status ?? 'normal',
    ports: props.device?.ports ?? [],
  })
}
</script>

<template>
  <div v-if="open" class="drawer">
    <div class="drawer-panel">
      <header>
        <h3>{{ device ? '编辑设备' : '新增设备' }}</h3>
        <button type="button" @click="emit('close')">关闭</button>
      </header>
      <div v-if="errors.length > 0" class="errors">
        <p v-for="error in errors" :key="error">{{ error }}</p>
      </div>
      <form @submit.prevent="submit">
        <fieldset>
          <legend>基本信息</legend>
          <label>计算机名<input v-model="form.computerName" /></label>
          <label>用途<input v-model="form.purpose" /></label>
          <label>责任人<input v-model="form.owner" /></label>
        </fieldset>
        <fieldset>
          <legend>位置信息</legend>
          <label>机房<select v-model="form.roomId"><option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name }}</option></select></label>
          <label>机柜<select v-model="form.rackId"><option v-for="rack in roomRacks" :key="rack.id" :value="rack.id">{{ rack.name }}</option></select></label>
          <label>安装面<select v-model="form.side"><option value="front">正面</option><option value="rear">背面</option></select></label>
          <label>起始U位<input v-model.number="form.startU" type="number" min="1" max="48" /></label>
          <label>高度U<input v-model.number="form.heightU" type="number" min="1" max="48" /></label>
        </fieldset>
        <fieldset>
          <legend>网络信息</legend>
          <label>业务IP<input v-model="form.businessIp" /></label>
          <label>带外IP<input v-model="form.managementIp" /></label>
        </fieldset>
        <fieldset>
          <legend>硬件信息</legend>
          <label>设备大类<input v-model="form.categoryId" /></label>
          <label>设备子类型<input v-model="form.subtype" /></label>
          <label>厂商<input v-model="form.vendor" /></label>
          <label>型号<input v-model="form.model" /></label>
          <label>SN号<input v-model="form.serialNumber" /></label>
          <label>固定资产编号<input v-model="form.assetNo" /></label>
          <label>硬件配置<input v-model="form.hardwareSpec" /></label>
          <label>操作系统<input v-model="form.operatingSystem" /></label>
          <label>维保到期<input v-model="form.warrantyExpireAt" /></label>
        </fieldset>
        <button type="submit" class="primary">保存</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.38);
}

.drawer-panel {
  width: min(560px, 100vw);
  height: 100vh;
  overflow: auto;
  padding: 18px;
  border-left: 1px solid var(--color-border);
  background: #08111f;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

h3 {
  margin: 0;
}

form,
fieldset {
  display: grid;
  gap: 12px;
}

fieldset {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
}

legend {
  color: #38bdf8;
}

label {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
}

input,
select {
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
}

button {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(17, 24, 39, 0.92);
  cursor: pointer;
}

.primary {
  min-height: 38px;
  border-color: rgba(14, 165, 233, 0.7);
  background: rgba(14, 165, 233, 0.18);
}

.errors {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid rgba(239, 68, 68, 0.72);
  border-radius: 8px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.12);
}

.errors p {
  margin: 0;
}
</style>
