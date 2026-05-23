<script setup lang="ts">
import { computed } from 'vue'
import type { Alert, Device, Rack, Room } from '../../../types/domain'
import RackTile from './RackTile.vue'

const props = defineProps<{
  room: Room
  racks: Rack[]
  devices: Device[]
  alerts: Alert[]
  selectedRackId: string | null
}>()

const emit = defineEmits<{
  selectRack: [rack: Rack]
}>()

const modules = computed(() => {
  const moduleIds = [...new Set(props.racks.map((rack) => rack.microModuleId).filter(Boolean))] as string[]
  return moduleIds.map((moduleId) => {
    const moduleRacks = props.racks.filter((rack) => rack.microModuleId === moduleId)
    const rowNames = [...new Set(moduleRacks.map((rack) => rack.rowName ?? 'A排'))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

    return {
      id: moduleId,
      name: props.room.microModules?.find((module) => module.id === moduleId)?.name ?? moduleId,
      rows: rowNames.map((rowName) => ({
        rowName,
        racks: moduleRacks.filter((rack) => rack.rowName === rowName),
      })),
    }
  })
})
</script>

<template>
  <div class="micro-layout">
    <section v-for="module in modules" :key="module.id" class="module-section">
      <header>
        <h3>{{ module.name }}</h3>
        <span>{{ module.rows.length }}排 x 10柜</span>
      </header>
      <div v-for="row in module.rows" :key="row.rowName" class="module-row">
        <strong>{{ row.rowName }}</strong>
        <div class="rack-row">
          <RackTile
            v-for="rack in row.racks"
            :key="rack.id"
            :rack="rack"
            :devices="devices"
            :alerts="alerts"
            :selected="rack.id === selectedRackId"
            @select="emit('selectRack', rack)"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.micro-layout {
  display: grid;
  gap: 16px;
}

.module-section {
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.72);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

h3 {
  margin: 0;
  font-size: 16px;
}

header span,
.module-row strong {
  color: var(--color-text-muted);
  font-size: 12px;
}

.module-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}

.rack-row {
  display: grid;
  grid-template-columns: repeat(10, minmax(72px, 1fr));
  gap: 6px;
}
</style>
