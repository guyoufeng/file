<template>
  <main class="app-shell">
    <section class="welcome">
      <p class="eyebrow">泉峰AI数据中心管理平台</p>
      <h1>v0.1 开发骨架已启动</h1>
      <p class="description">
        Tauri 2 + Vue 3 + TypeScript + Vite 基础工程已就绪。下一步将按计划接入路由、暗色控制台布局和核心数据模型。
      </p>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #050a16;
  color: #e5eefb;
  font-family:
    Inter, "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
}

.welcome {
  width: min(720px, calc(100vw - 48px));
  padding: 32px;
  border: 1px solid #263247;
  border-radius: 8px;
  background: #111827;
}

.eyebrow {
  margin: 0 0 12px;
  color: #38bdf8;
  font-size: 14px;
}

h1 {
  margin: 0 0 16px;
  font-size: 32px;
  line-height: 1.2;
}

.description {
  margin: 0;
  color: #9ca3af;
  line-height: 1.7;
}
</style>
