<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { Alert, Device, DeviceSide, Rack } from "../../../types/domain";
import RackColumnCanvas from "./RackColumnCanvas.vue";
import ZoomToolbar from "./ZoomToolbar.vue";
import {
  getRackTypeColor,
  getRackTypeLabel,
} from "../../../services/rack/rackTypePresentation";
import { computeDeviceCenterScrollTop } from "../rackFocus";

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

const zoom = ref(1.25);
const side = ref<DeviceSide>("front");
const visibleRacks = computed(() =>
  props.racks?.length ? props.racks : props.rack ? [props.rack] : [],
);
const highlightedDevice = computed(() =>
  props.devices.find((device) => device.id === props.highlightDeviceId),
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

watch(
  () => [props.rack?.id, props.highlightDeviceId, side.value],
  async () => {
    await nextTick();
    if (!props.rack?.id) return;
    const rackElement = document.querySelector(`[data-rack-id="${props.rack.id}"]`);
    rackElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    const device = props.devices.find((item) => item.id === props.highlightDeviceId);
    if (!device || !rackElement) return;
    const scrollContainer = rackElement.closest(".rack-u-scroll");
    if (!(scrollContainer instanceof HTMLElement)) return;
    if (rackElement instanceof HTMLElement) {
      scrollContainer.scrollLeft =
        rackElement.offsetLeft - scrollContainer.clientWidth / 2 + rackElement.clientWidth / 2;
    }

    const unitHeight = Math.round(13 * zoom.value);
    scrollContainer.scrollTop = computeDeviceCenterScrollTop({
      rackHeightU: props.rack.heightU,
      deviceStartU: device.startU,
      deviceEndU: device.endU,
      deviceHeightU: device.heightU,
      unitHeight,
      containerHeight: scrollContainer.clientHeight,
    });
  },
  { flush: "post" },
);

watch(
  highlightedDevice,
  (device) => {
    if (device) side.value = device.side;
  },
  { immediate: true },
);
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
      <div class="u-view-actions">
        <div class="side-switch" aria-label="安装面">
          <button
            type="button"
            :class="{ active: side === 'front' }"
            @click="side = 'front'"
          >
            正面
          </button>
          <button
            type="button"
            :class="{ active: side === 'rear' }"
            @click="side = 'rear'"
          >
            背面
          </button>
        </div>
        <ZoomToolbar v-model="zoom" />
      </div>
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
            :data-rack-id="item.id"
          >
            <button
              type="button"
              class="rack-u-title"
              :style="{ '--rack-type-color': getRackTypeColor(item.type) }"
              @click="emit('selectRack', item)"
            >
              <strong>{{ item.name }}</strong>
              <span
                >{{ getRackTypeLabel(item.type) }} /
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
              :side="side"
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
  padding: 16px;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  color: var(--viz-text);
  background: var(--viz-workspace-bg);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.u-view-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.side-switch {
  display: flex;
  gap: 6px;
}

.side-switch button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--viz-muted);
  background: var(--viz-panel);
  cursor: pointer;
}

.side-switch button.active,
.side-switch button:hover {
  border-color: rgba(14, 165, 233, 0.7);
  color: var(--viz-text);
  background: rgba(14, 165, 233, 0.16);
}

.eyebrow {
  margin: 0 0 4px;
  color: #38bdf8;
  font-size: 12px;
}

h3 {
  margin: 0;
  color: var(--viz-text);
  font-size: 18px;
}

.hint {
  display: block;
  margin-top: 6px;
  color: var(--viz-muted);
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
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  background: var(--viz-panel-strong);
  box-shadow: 8px 0 16px rgba(15, 23, 42, 0.08);
}

.rack-u-row-label strong {
  font-size: 14px;
}

.rack-u-row-label span {
  color: var(--viz-muted);
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
  color: var(--viz-text);
  text-align: left;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--rack-type-color) 16%, var(--viz-panel-strong)),
      var(--viz-panel)
    );
  box-shadow: inset 4px 0 0 color-mix(in srgb, var(--rack-type-color) 86%, #ffffff 0%);
  cursor: pointer;
}

.rack-u-title span {
  color: var(--viz-muted);
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
    var(--viz-panel-strong);
  box-shadow:
    0 0 0 2px rgba(253, 230, 138, 0.22),
    0 10px 24px rgba(245, 158, 11, 0.12);
}

:global(:root[data-theme="light"]) .rack-u-column.active .rack-u-title {
  border-color: rgba(245, 158, 11, 0.72);
  color: #0f172a;
  background:
    linear-gradient(135deg, rgba(254, 249, 195, 0.9), rgba(224, 242, 254, 0.72)),
    var(--viz-panel-strong);
  box-shadow:
    0 0 0 2px rgba(245, 158, 11, 0.18),
    0 10px 24px rgba(245, 158, 11, 0.12);
}

:global(:root[data-theme="light"]) .rack-u-column.active .rack-u-title span {
  color: #334155;
}
</style>
