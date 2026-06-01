<script setup lang="ts">
import { ref } from "vue";
import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from "../../../services/theme/themePreference";

const theme = ref<ThemePreference>(getStoredThemePreference());

function chooseTheme(nextTheme: ThemePreference) {
  theme.value = nextTheme;
  applyThemePreference(nextTheme);
  window.dispatchEvent(new CustomEvent("qf-theme-change", { detail: nextTheme }));
}
</script>

<template>
  <section class="settings-panel">
    <header>
      <div>
        <p class="eyebrow">Theme</p>
        <h3>主题设置</h3>
      </div>
      <span>默认浅色专业运维界面，暗色主题保留用于机房巡检和投屏展示。</span>
    </header>

    <div class="theme-options">
      <button
        type="button"
        :class="{ active: theme === 'light' }"
        @click="chooseTheme('light')"
      >
        <strong>浅色专业主题</strong>
        <span>默认启用，适合日常录入、报表查看和长期办公使用。</span>
      </button>
      <button
        type="button"
        :class="{ active: theme === 'dark' }"
        @click="chooseTheme('dark')"
      >
        <strong>暗色运维主题</strong>
        <span>适合大屏展示、夜间巡检和沉浸式机房监控场景。</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--surface-raised);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--color-primary);
  font-size: 12px;
}

h3 {
  margin: 0;
}

header span,
button span {
  color: var(--color-text-muted);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.theme-options button {
  min-height: 112px;
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  text-align: left;
  background: var(--color-panel);
  cursor: pointer;
}

.theme-options button.active {
  border-color: color-mix(in srgb, var(--color-primary) 62%, var(--color-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent),
    var(--color-panel);
  box-shadow: var(--shadow-soft);
}
</style>
