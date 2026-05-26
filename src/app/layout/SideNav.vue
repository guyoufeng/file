<script setup lang="ts">
const navItems = [
  { path: '/rack-overview', label: '机柜总览' },
  { path: '/assets', label: '资产管理' },
  { path: '/virtual-servers', label: '虚拟服务器' },
  { path: '/connections', label: '连线管理' },
  { path: '/alerts', label: '告警中心' },
  { path: '/reports', label: '报表中心' },
  { path: '/settings', label: '系统设置' },
]
</script>

<template>
  <aside class="side-nav">
    <div class="brand">
      <span class="brand-mark">QF</span>
      <div>
        <strong>泉峰AI</strong>
        <small>数据中心管理平台</small>
      </div>
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
  background: #08111f;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 22px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.42);
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.12);
  color: #7dd3fc;
  font-weight: 700;
}

.brand strong,
.brand small {
  display: block;
}

.brand strong {
  font-size: 16px;
  color: var(--color-text);
}

.brand small {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
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
