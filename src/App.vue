<script setup lang="ts">
import { darkTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import AppShell from './app/layout/AppShell.vue'
import { naiveThemeOverrides } from './app/theme'
</script>

<template>
  <NConfigProvider :theme="darkTheme" :theme-overrides="naiveThemeOverrides">
    <AppShell />
    <NGlobalStyle />
  </NConfigProvider>
</template>
