<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Alert, Device, DeviceSide, Rack } from "../../../types/domain";
import { categoryColors } from "../../../constants/colors";
import {
  getDeviceBlockHeight,
  getDeviceBlockY,
} from "../../../services/rack/uPosition";
import { getRackDeviceTextLayout } from "../../../services/rack/rackDeviceText";
import { filterRackSideDevices } from "../../../services/rack/rackSideView";

const props = defineProps<{
  rack: Rack;
  devices: Device[];
  alerts?: Alert[];
  zoom: number;
  highlightDeviceId?: string | null;
  compact?: boolean;
  side?: DeviceSide;
}>();

const emit = defineEmits<{
  selectDevice: [device: Device];
}>();

const rackPadding = 8;
const themeName = ref<"light" | "dark">("light");

const rackWidth = computed(() => (props.compact ? 186 : 300));
const labelWidth = computed(() => (props.compact ? 30 : 44));
const baseRowHeight = computed(() => (props.compact ? 13 : 14));
const rowHeight = computed(() => Math.round(baseRowHeight.value * props.zoom));
const stageHeight = computed(() => props.rack.heightU * rowHeight.value);
const rackBodyWidth = computed(
  () => rackWidth.value - labelWidth.value - rackPadding,
);
const rackDevices = computed(() =>
  filterRackSideDevices(props.devices, props.rack.id, props.side ?? "front"),
);
const palette = computed(() =>
  themeName.value === "dark"
    ? {
        rowEven: "#0B1220",
        rowOdd: "#101827",
        gridStroke: "#263247",
        label: "#94A3B8",
        deviceText: "#F8FAFC",
        deviceStroke: "#E5EEFB",
      }
    : {
        rowEven: "#F9FFFB",
        rowOdd: "#EEF8F1",
        gridStroke: "#C9DFD0",
        label: "#466253",
        deviceText: "#111827",
        deviceStroke: "rgba(15, 23, 42, 0.28)",
      },
);

function readTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function syncTheme() {
  themeName.value = readTheme();
}

onMounted(() => {
  syncTheme();
  window.addEventListener("qf-theme-change", syncTheme);
});

onBeforeUnmount(() => {
  window.removeEventListener("qf-theme-change", syncTheme);
});

function deviceColor(device: Device): string {
  const activeAlert = props.alerts?.find(
    (alert) => alert.deviceId === device.id && alert.status !== "recovered",
  );
  if (activeAlert?.level === "critical") return "#EF4444";
  if (activeAlert?.level === "warning") return "#F59E0B";
  return (
    categoryColors[device.categoryId as keyof typeof categoryColors] ??
    categoryColors.other
  );
}

function deviceBlockY(device: Device): number {
  return getDeviceBlockY(
    device.startU,
    device.heightU,
    props.rack.heightU,
    rowHeight.value,
  );
}

function deviceBlockHeight(device: Device): number {
  return getDeviceBlockHeight(device.heightU, rowHeight.value);
}

function deviceRectY(device: Device): number {
  return deviceBlockY(device) + (device.heightU <= 1 ? 2 : 3);
}

function deviceRectHeight(device: Device): number {
  return Math.max(
    device.heightU <= 1 ? rowHeight.value - 4 : 10,
    deviceBlockHeight(device) - (device.heightU <= 1 ? 4 : 6),
  );
}

function deviceTextLayout(device: Device) {
  return getRackDeviceTextLayout({
    device,
    compact: Boolean(props.compact),
    zoom: props.zoom,
    blockHeight: deviceBlockHeight(device) - 6,
  });
}

function selectDevice(device: Device) {
  emit("selectDevice", device);
}
</script>

<template>
  <div
    class="rack-canvas"
    :class="{ compact }"
    :style="{ width: `${rackWidth}px` }"
  >
    <v-stage :config="{ width: rackWidth, height: stageHeight }">
      <v-layer>
        <template v-for="u in rack.heightU" :key="u">
          <v-rect
            :config="{
              x: labelWidth,
              y: (rack.heightU - u) * rowHeight,
              width: rackBodyWidth,
              height: rowHeight,
              fill: u % 2 === 0 ? palette.rowEven : palette.rowOdd,
              stroke: palette.gridStroke,
              strokeWidth: 0.5,
            }"
          />
          <v-text
            :config="{
              x: 0,
              y: (rack.heightU - u) * rowHeight + 2,
              width: labelWidth - 8,
              text: `${u}U`,
              align: 'right',
              fontSize: Math.max(9, rowHeight * 0.45),
              fill: palette.label,
            }"
          />
        </template>

        <template v-for="device in rackDevices" :key="device.id">
          <v-rect
            @click="selectDevice(device)"
            @tap="selectDevice(device)"
            :config="{
              x: labelWidth + 6,
              y: deviceRectY(device),
              width: rackBodyWidth - 12,
              height: deviceRectHeight(device),
              fill: deviceColor(device),
              opacity: 0.86,
              cornerRadius: 4,
              stroke: device.id === highlightDeviceId ? '#FDE68A' : palette.deviceStroke,
              strokeWidth:
                device.id === highlightDeviceId
                  ? 4
                  : props.alerts?.some(
                        (alert) =>
                          alert.deviceId === device.id &&
                          alert.status !== 'recovered',
                      )
                    ? 1.5
                    : 0.6,
              shadowColor:
                device.id === highlightDeviceId ? '#FDE68A' : undefined,
              shadowBlur: device.id === highlightDeviceId ? 14 : 0,
              shadowOpacity: device.id === highlightDeviceId ? 0.75 : 0,
              cursor: 'pointer',
            }"
          />
          <v-text
            @click="selectDevice(device)"
            @tap="selectDevice(device)"
            :config="{
              x: labelWidth + 14,
              y: deviceRectY(device) + deviceTextLayout(device).yOffset,
              width: rackBodyWidth - 28,
              height: deviceRectHeight(device),
              text: deviceTextLayout(device).text,
              fontSize: deviceTextLayout(device).fontSize,
              lineHeight: deviceTextLayout(device).lineHeight,
              align: deviceTextLayout(device).align,
              verticalAlign: deviceTextLayout(device).verticalAlign,
              padding: deviceTextLayout(device).padding,
              fill: palette.deviceText,
              ellipsis: true,
              cursor: 'pointer',
            }"
          />
        </template>
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.rack-canvas {
  padding: 10px;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--viz-grid-line) 34%, transparent),
      transparent 8%,
      transparent 92%,
      color-mix(in srgb, var(--viz-grid-line) 34%, transparent)
    ),
    var(--viz-panel-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--viz-border) 60%, transparent);
}

.rack-canvas.compact {
  padding: 7px;
  border-color: rgba(71, 85, 105, 0.62);
}
</style>
