<script setup lang="ts">
import { computed } from 'vue'
import ChervonLogo from '../../components/ChervonLogo.vue'
import { appModules, canAccessModule } from '../../services/auth/accountAccess'
import { useAuthStore } from '../../stores/authStore'

const authStore = useAuthStore()
const navItems = computed(() =>
  appModules.filter((item) => canAccessModule(authStore.session ?? undefined, item.key)),
)
</script>

<template>
  <aside class="side-nav">
    <div class="brand">
      <ChervonLogo compact />
      <small>泉峰AI数据中心管理平台</small>
    </div>

    <nav class="nav-list" aria-label="主导航">
      <RouterLink v-for="item in navItems" :key="item.path" :to="item.path">
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.side-nav {
  min-height: 100vh;
  padding: 18px 14px;
  border-right: 1px solid var(--color-border);
  background: var(--color-panel);
  box-shadow: var(--shadow-soft);
}

.brand {
  display: grid;
  gap: 8px;
  padding: 8px 8px 22px;
}

.brand small {
  display: block;
  color: var(--color-text-muted);
  font-size: 11px;
}

.nav-list {
  display: grid;
  gap: 6px;
}

.nav-list a {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--color-text-muted);
  text-decoration: none;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
}

.nav-list a:hover,
.nav-list a.router-link-active {
  background: rgba(14, 165, 233, 0.12);
  color: var(--color-text);
}
</style>
