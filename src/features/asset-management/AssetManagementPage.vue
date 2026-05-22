<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Device } from '../../types/domain'
import { useAssetStore } from '../../stores/assetStore'
import { useRoomStore } from '../../stores/roomStore'
import AssetTable from './components/AssetTable.vue'
import AssetToolbar from './components/AssetToolbar.vue'
import DeviceFormDrawer from './components/DeviceFormDrawer.vue'

const assetStore = useAssetStore()
const roomStore = useRoomStore()
const search = ref('')
const drawerOpen = ref(false)
const editingDevice = ref<Device | null>(null)

const filteredDevices = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return assetStore.devices

  return assetStore.devices.filter((device) =>
    [
      device.computerName,
      device.businessIp,
      device.managementIp,
      device.assetNo,
      device.serialNumber,
      device.purpose,
      device.owner,
    ]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(keyword)),
  )
})

onMounted(async () => {
  await Promise.all([roomStore.loadRooms(), assetStore.loadDevices()])
})

function openAddDrawer() {
  editingDevice.value = null
  drawerOpen.value = true
}

function openEditDrawer(device: Device) {
  editingDevice.value = device
  drawerOpen.value = true
}

function saveDevice(device: Device) {
  const index = assetStore.devices.findIndex((item) => item.id === device.id)
  if (index >= 0) {
    assetStore.devices.splice(index, 1, device)
  } else {
    assetStore.devices.unshift(device)
  }
  drawerOpen.value = false
}

function deleteDevice(device: Device) {
  if (!window.confirm(`确认删除设备 ${device.computerName || device.name}？`)) {
    return
  }
  assetStore.devices = assetStore.devices.filter((item) => item.id !== device.id)
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">资产管理</h2>
        <p class="page-subtitle">维护设备、固定资产编号、计算机名、业务IP、用途、责任人和硬件配置。</p>
      </div>
    </div>

    <AssetToolbar v-model:search="search" @add="openAddDrawer" />
    <AssetTable
      :devices="filteredDevices"
      :racks="roomStore.racks"
      @edit="openEditDrawer"
      @delete="deleteDevice"
    />
    <DeviceFormDrawer
      :open="drawerOpen"
      :device="editingDevice"
      :rooms="roomStore.rooms"
      :racks="roomStore.racks"
      :devices="assetStore.devices"
      @close="drawerOpen = false"
      @save="saveDevice"
    />
  </section>
</template>
