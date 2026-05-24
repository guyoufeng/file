<script setup lang="ts">
import { computed, ref } from "vue";
import type { Alert, Device, Rack } from "../../../types/domain";
import RackColumnCanvas from "./RackColumnCanvas.vue";
import ZoomToolbar from "./ZoomToolbar.vue";

const props = defineProps<{
  rack: Rack | null;
  racks?: Rack[];
  devices: Device[];
  alerts?: Alert[];
  highlightDeviceId?: string | null;
}>();

const emit = defineEmits<{
  selectRack: [rack: Rack];
  selectDevice: [device: Device];
}>();

const rackTypeLabels: Record<string, string> = {
  server: "服务器柜",
  network: "网络柜",
  storage: "存储柜",
  patching: "配线柜",
  row_head: "列头柜",
  cooling: "精密空调",
  ups_pdu: "供电柜",
  empty: "空柜",
  other: "其他",
};

const zoom = ref(1.25);
const visibleRacks = computed(() =>
  props.racks?.length ? props.racks : props.rack ? [props.rack] : [],
);
const rackRows = computed(() => {
  const rows = new Map<string, Rack[]>();
  visibleRacks.value.forEach((rack) => {
    const rowName = rack.rowName ?? "未分排";
    rows.set(rowName, [...(rows.get(rowName) ?? []), rack]);
  });

  return [...rows.entries()]
    .sort(([left], [right]) =>
      left.localeCompare(right, "zh-Hans-CN", { numeric: true }),
    )
    .map(([rowName, racks]) => ({
      rowName,
      racks: racks.sort(
        (left, right) => (left.columnIndex ?? 0) - (right.columnIndex ?? 0),
      ),
    }));
});
</script>

<template>
  <div class="rack-u-view">
    <header>
      <div>
        <p class="eyebrow">U位大图</p>
        <h3>
          {{
            visibleRacks.length > 1
              ? "多排多柜 U 位工作区"
              : (rack?.name ?? "请选择机柜")
          }}
        </h3>
        <span v-if="visibleRacks.length > 1" class="hint"
          >横向查看 1-10 列，纵向查看 A/B/C/D
          排；点击机柜标题查看详情，点击设备块可直接编辑。</span
        >
      </div>
      <ZoomToolbar v-model="zoom" />
    </header>

    <div
      v-if="visibleRacks.length > 0"
      class="rack-u-scroll"
      data-testid="rack-u-overview"
    >
      <section
        v-for="row in rackRows"
        :key="row.rowName"
        class="rack-u-row"
        :data-testid="`rack-u-row-${row.rowName}`"
      >
        <div class="rack-u-row-label">
          <strong>{{ row.rowName }}</strong>
          <span>{{ row.racks.length }}柜</span>
        </div>
        <div class="rack-u-row-track">
          <article
            v-for="item in row.racks"
            :key="item.id"
            class="rack-u-column"
            :class="{ active: item.id === rack?.id }"
          >
            <button
              type="button"
              class="rack-u-title"
              @click="emit('selectRack', item)"
            >
              <strong>{{ item.name }}</strong>
              <span
                >{{ rackTypeLabels[item.type] ?? item.type }} /
                {{ item.heightU }}U</span
              >
            </button>
            <RackColumnCanvas
              :rack="item"
              :devices="devices"
              :alerts="alerts"
              :zoom="zoom"
              :highlight-device-id="
                item.id === rack?.id ? highlightDeviceId : null
              "
              compact
              @select-device="emit('selectDevice', $event)"
            />
          </article>
        </div>
      </section>
    </div>
    <div v-else class="empty-panel">
      <div class="empty-panel-inner">
        <h2>请选择一个机柜</h2>
        <p>选择机柜后显示 48U 编号、设备块和缩放视图。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rack-u-view {
  display: grid;
  gap: 12px;
}

header {
  display: flex;
  align-items: center;
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
  font-size: 18px;
}

.hint {
  display: block;
  margin-top: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.rack-u-scroll {
  max-width: 100%;
  max-height: calc(100vh - 330px);
  min-height: 420px;
  display: grid;
  gap: 14px;
  overflow: auto;
  padding: 2px 2px 14px;
}

.rack-u-row {
  min-width: max-content;
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 10px;
  align-items: start;
}

.rack-u-row-label {
  position: sticky;
  left: 0;
  z-index: 2;
  min-height: 66px;
  display: grid;
  align-content: center;
  gap: 3px;
  padding: 8px 6px;
  border: 1px solid rgba(38, 50, 71, 0.92);
  border-radius: 8px;
  background: rgba(5, 10, 22, 0.96);
  box-shadow: 8px 0 16px rgba(5, 10, 22, 0.34);
}

.rack-u-row-label strong {
  font-size: 14px;
}

.rack-u-row-label span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.rack-u-row-track {
  display: flex;
  gap: 10px;
  align-items: start;
}

.rack-u-column {
  flex: 0 0 auto;
  display: grid;
  gap: 6px;
}

.rack-u-title {
  width: 186px;
  min-height: 54px;
  display: grid;
  gap: 3px;
  padding: 8px 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  text-align: left;
  background: rgba(8, 17, 31, 0.9);
  cursor: pointer;
}

.rack-u-title span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.rack-u-title strong {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rack-u-column.active .rack-u-title {
  border-color: rgba(253, 230, 138, 0.92);
  color: #fef3c7;
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(14, 165, 233, 0.12)),
    rgba(8, 17, 31, 0.96);
  box-shadow:
    0 0 0 2px rgba(253, 230, 138, 0.22),
    0 10px 24px rgba(245, 158, 11, 0.12);
}
</style>
