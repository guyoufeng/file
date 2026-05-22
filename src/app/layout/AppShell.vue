<script setup lang="ts">
import { ref } from 'vue'
import { NButton } from 'naive-ui'
import AiAssistantDrawer from '../../features/ai-assistant/AiAssistantDrawer.vue'
import SideNav from './SideNav.vue'
import TopBar from './TopBar.vue'

const aiOpen = ref(false)
</script>

<template>
  <div class="app-shell">
    <SideNav />
    <div class="workspace">
      <TopBar />
      <main class="content">
        <RouterView />
      </main>
    </div>
    <NButton class="ai-entry" type="primary" round @click="aiOpen = true">AI 助手</NButton>
    <AiAssistantDrawer :open="aiOpen" @close="aiOpen = false" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  background: var(--color-bg);
  color: var(--color-text);
}

.workspace {
  min-width: 0;
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr);
}

.content {
  min-width: 0;
  overflow: auto;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(14, 165, 233, 0.08), transparent 280px),
    var(--color-bg);
}

.ai-entry {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
  box-shadow: 0 18px 40px rgba(14, 165, 233, 0.24);
}
</style>
