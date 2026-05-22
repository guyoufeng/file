<template>
  <header class="top-bar">
    <div>
      <p class="eyebrow">v0.1 Foundation</p>
      <h1>数据中心运维控制台</h1>
    </div>
    <div class="status-group">
      <span>南京 / 529数据中心</span>
      <span>48U</span>
      <span>只读AI查询</span>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(8, 17, 31, 0.92);
}

.eyebrow {
  margin: 0 0 2px;
  color: #38bdf8;
  font-size: 12px;
}

h1 {
  margin: 0;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.status-group span {
  padding: 5px 9px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.72);
}
</style>
