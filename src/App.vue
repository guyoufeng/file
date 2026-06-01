<script setup lang="ts">
import { darkTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import { useRoute } from 'vue-router'
import AppShell from './app/layout/AppShell.vue'
import { naiveThemeOverrides } from './app/theme'

const route = useRoute()
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="naiveThemeOverrides">
    <RouterView v-if="route.meta.public" />
    <AppShell v-else />
    <NGlobalStyle />
  </NConfigProvider>
</template>
