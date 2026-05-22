<script setup lang="ts">
import ConnectionEmptyState from './components/ConnectionEmptyState.vue'
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">连线管理</h2>
        <p class="page-subtitle">维护服务器、交换机、配线架之间的端口和线缆关系。</p>
      </div>
    </div>
    <ConnectionEmptyState />
  </section>
</template>
