<template>
  <div class="connection-empty">
    <section class="hero-panel">
      <p class="eyebrow">Connection Workspace</p>
      <h3>专业接线管理入口已预留</h3>
      <p>
        v0.1 已在数据模型中保留端口、连接、设备模板和变更记录，后续可扩展服务器到交换机接口、配线架跳线、接线表导出和 AI 录入查询。
      </p>
    </section>

    <section class="reserved-grid" aria-label="预留数据模型">
      <article>
        <strong>Port</strong>
        <span>设备端口名称、类型、速率、占用状态。</span>
      </article>
      <article>
        <strong>Connection</strong>
        <span>源设备端口、目标设备端口、线缆编号和状态。</span>
      </article>
      <article>
        <strong>DeviceTemplate</strong>
        <span>服务器、交换机、配线架的标准端口模板。</span>
      </article>
      <article>
        <strong>ChangeRecord</strong>
        <span>接线变更、AI 修改和人工调整的审计记录。</span>
      </article>
    </section>

    <section class="roadmap-panel">
      <h3>后续建设方向</h3>
      <div>
        <span>端口占用视图</span>
        <span>对端设备查询</span>
        <span>接线表 Excel 导出</span>
        <span>AI 自然语言录入接线</span>
        <span>交换机接口可视化</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.connection-empty {
  display: grid;
  gap: 16px;
}

.hero-panel,
.roadmap-panel,
.reserved-grid article {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.82);
}

.hero-panel {
  min-height: 190px;
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 22px;
}

.eyebrow {
  margin: 0;
  color: #38bdf8;
  font-size: 12px;
}

h3,
p {
  margin: 0;
}

.hero-panel p:last-child,
.reserved-grid span {
  max-width: 760px;
  color: var(--color-text-muted);
  line-height: 1.7;
}

.reserved-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.reserved-grid article {
  display: grid;
  gap: 8px;
  min-height: 118px;
  padding: 14px;
}

.roadmap-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.roadmap-panel div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.roadmap-panel span {
  padding: 7px 10px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 8px;
  color: #bae6fd;
  background: rgba(14, 165, 233, 0.1);
}
</style>
