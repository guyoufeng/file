import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueKonva from 'vue-konva'
import App from './App.vue'
import { router } from './app/router'
import { loadDemoSeedIfAvailable } from './services/demo/demoSeed'
import './styles/global.css'

await loadDemoSeedIfAvailable()

createApp(App).use(createPinia()).use(router).use(VueKonva).mount('#app')
