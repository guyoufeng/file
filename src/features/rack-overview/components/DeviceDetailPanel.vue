<script setup lang="ts">
import type { Device } from '../../../types/domain'

defineProps<{
  device: Device | null
}>()
</script>

<template>
  <section v-if="device" class="detail-panel">
    <p class="eyebrow">设备详情</p>
    <h3>{{ device.computerName || device.name }}</h3>
    <dl>
      <div><dt>业务IP</dt><dd>{{ device.businessIp }}</dd></div>
      <div><dt>带外IP</dt><dd>{{ device.managementIp }}</dd></div>
      <div><dt>用途</dt><dd>{{ device.purpose }}</dd></div>
      <div><dt>责任人</dt><dd>{{ device.owner }}</dd></div>
      <div><dt>资产编号</dt><dd>{{ device.assetNo }}</dd></div>
      <div><dt>SN号</dt><dd>{{ device.serialNumber }}</dd></div>
      <div><dt>型号</dt><dd>{{ device.vendor }} {{ device.model }}</dd></div>
      <div><dt>硬件配置</dt><dd>{{ device.hardwareSpec }}</dd></div>
      <div><dt>维保到期</dt><dd>{{ device.warrantyExpireAt }}</dd></div>
    </dl>
    <div class="reserved-link-panel">
      <strong>端口 / 连线</strong>
      <p>v0.1 已预留端口和连线模型，后续可在这里查看交换机接口、对端设备、线缆编号和 AI 录入记录。</p>
    </div>
  </section>
</template>

<style scoped>
.detail-panel {
  display: grid;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
}

dl {
  display: grid;
  gap: 9px;
  margin: 0;
}

dl div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
}

dt {
  color: var(--color-text-muted);
}

dd {
  margin: 0;
  word-break: break-all;
}

.reserved-link-panel {
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgba(56, 189, 248, 0.26);
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
}

.reserved-link-panel p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.6;
}
</style>
