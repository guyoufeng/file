<template>
  <section class="settings-panel">
    <header>
      <div>
        <p class="eyebrow">Theme</p>
        <h3>主题设置</h3>
      </div>
      <span>v0.1 固定暗色专业运维控制台，浅色主题保留 Token 映射。</span>
    </header>

    <div class="theme-options">
      <article class="active">
        <strong>暗色运维主题</strong>
        <span>当前启用，适合机房巡检、投屏展示和长时间运维使用。</span>
      </article>
      <article>
        <strong>浅色主题</strong>
        <span>已预留，后续在设计 Token 稳定后开放切换。</span>
      </article>
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
  background: rgba(17, 24, 39, 0.82);
}

header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
}

header span,
article span {
  color: var(--color-text-muted);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

article {
  display: grid;
  gap: 8px;
  min-height: 112px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.72);
}

article.active {
  border-color: rgba(14, 165, 233, 0.62);
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(17, 24, 39, 0.86));
}
</style>
