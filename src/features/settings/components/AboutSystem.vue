<template>
  <section class="settings-panel">
    <header>
      <div>
        <p class="eyebrow">About</p>
        <h3>关于系统</h3>
      </div>
      <span>泉峰AI数据中心管理平台 / v0.1.0 / Apache-2.0</span>
    </header>

    <div class="about-grid">
      <div>
        <strong>项目定位</strong>
        <p>本地优先、开源可扩展的数据中心机柜资产与 AI 运维管理平台。</p>
      </div>
      <div>
        <strong>当前版本</strong>
        <p>已覆盖机柜总览、U 位图、资产管理、告警中心、报表中心、AI 查询助手和轻量 3D 展示。</p>
      </div>
      <div>
        <strong>许可证</strong>
        <p>Apache-2.0，适合开源协作和企业内部二次开发。</p>
      </div>
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

h3,
p {
  margin: 0;
}

header span,
p {
  color: var(--color-text-muted);
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.about-grid div {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.72);
}
</style>
