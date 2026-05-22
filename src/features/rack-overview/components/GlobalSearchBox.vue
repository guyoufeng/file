<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Device, Rack, Room } from '../../../types/domain'
import { searchDevices, type DeviceSearchResult } from '../../../services/search/deviceSearch'

const props = defineProps<{
  rooms: Room[]
  racks: Rack[]
  devices: Device[]
}>()

const emit = defineEmits<{
  locate: [result: DeviceSearchResult]
}>()

const query = ref('')
const results = computed(() => searchDevices(query.value, props.devices, props.racks, props.rooms).slice(0, 8))
</script>

<template>
  <div class="global-search">
    <input v-model="query" type="search" placeholder="搜索计算机名、业务IP、SN、资产编号、责任人" />
    <div v-if="results.length > 0" class="result-list">
      <button v-for="result in results" :key="result.device.id" type="button" @click="emit('locate', result)">
        <strong>{{ result.device.computerName || result.device.name }}</strong>
        <span>{{ result.device.businessIp }} / {{ result.device.purpose }}</span>
        <small>{{ result.location }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.global-search {
  position: relative;
  width: min(520px, 100%);
}

input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: rgba(8, 17, 31, 0.92);
  outline: none;
}

input:focus {
  border-color: rgba(14, 165, 233, 0.78);
}

.result-list {
  position: absolute;
  z-index: 30;
  top: 42px;
  left: 0;
  right: 0;
  display: grid;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #08111f;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
}

.result-list button {
  display: grid;
  gap: 3px;
  padding: 9px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.result-list button:hover {
  background: rgba(14, 165, 233, 0.14);
}

span,
small {
  color: var(--color-text-muted);
}
</style>
