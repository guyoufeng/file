<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { darkTheme, lightTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import { useRoute } from 'vue-router'
import AppShell from './app/layout/AppShell.vue'
import { darkNaiveThemeOverrides, lightNaiveThemeOverrides } from './app/theme'
import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from './services/theme/themePreference'

const route = useRoute()
const theme = ref<ThemePreference>(getStoredThemePreference())
const naiveTheme = computed(() => (theme.value === 'dark' ? darkTheme : lightTheme))
const themeOverrides = computed(() =>
  theme.value === 'dark' ? darkNaiveThemeOverrides : lightNaiveThemeOverrides,
)

onMounted(() => {
  applyThemePreference(theme.value)
  window.addEventListener('qf-theme-change', ((event: CustomEvent<ThemePreference>) => {
    theme.value = event.detail
    applyThemePreference(theme.value)
  }) as EventListener)
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <RouterView v-if="route.meta.public" />
    <AppShell v-else />
    <NGlobalStyle />
  </NConfigProvider>
</template>
