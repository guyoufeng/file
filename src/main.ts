import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueKonva from 'vue-konva'
import App from './App.vue'
import { router } from './app/router'
import { loadDemoSeedIfAvailable } from './services/demo/demoSeed'
import { hydratePersistentCollectionsFromBackend } from './services/persistence/unifiedPersistence'
import { applyThemePreference, getStoredThemePreference } from './services/theme/themePreference'
import './styles/global.css'

applyThemePreference(getStoredThemePreference())
await loadDemoSeedIfAvailable()
await hydratePersistentCollectionsFromBackend()

createApp(App).use(createPinia()).use(router).use(VueKonva).mount('#app')
