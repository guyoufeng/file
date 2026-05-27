<script setup lang="ts">
import { computed } from "vue";
import type { Alert, Device, Rack } from "../../../types/domain";
import { getRackTileStats } from "../layout";
import {
  getRackTypeColor,
  getRackTypeLabel,
} from "../../../services/rack/rackTypePresentation";

const props = defineProps<{
  rack: Rack;
  devices: Device[];
  alerts: Alert[];
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [rack: Rack];
}>();

const stats = computed(() =>
  getRackTileStats(props.rack, props.devices, props.alerts),
);
const rackColor = computed(() => getRackTypeColor(props.rack.type));
const activeRackAlerts = computed(() => {
  const deviceIds = new Set(
    props.devices
      .filter((device) => device.rackId === props.rack.id)
      .map((device) => device.id),
  );
  return props.alerts.filter(
    (alert) => deviceIds.has(alert.deviceId) && alert.status !== "recovered",
  );
});
const hasCriticalAlert = computed(() =>
  activeRackAlerts.value.some((alert) => alert.level === "critical"),
);
const hasWarningAlert = computed(() =>
  activeRackAlerts.value.some((alert) => alert.level === "warning"),
);
</script>

<template>
  <button
    type="button"
    class="rack-tile"
    :class="{
      alert: stats.alertCount > 0,
      critical: hasCriticalAlert,
      warning: hasWarningAlert && !hasCriticalAlert,
      selected,
    }"
    :style="{ '--rack-type-color': rackColor }"
    @click="emit('select', rack)"
  >
    <span class="rack-name">{{ rack.name }}</span>
    <span class="rack-type">{{ getRackTypeLabel(rack.type) }}</span>
    <span class="rack-meta">
      {{ stats.deviceCount }} 台 /
      {{ stats.capacityText }}
    </span>
    <span v-if="stats.alertCount > 0" class="alert-badge">
      告警 {{ stats.alertCount }}
    </span>
  </button>
</template>

<style scoped>
.rack-tile {
  min-width: 72px;
  min-height: 104px;
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 9px;
  border: 1px solid rgba(38, 50, 71, 0.96);
  border-radius: 8px;
  text-align: left;
  color: var(--color-text);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--rack-type-color) 24%, rgba(21, 28, 46, 0.96)),
    rgba(10, 18, 32, 0.96)
  );
  box-shadow: inset 4px 0 0 color-mix(in srgb, var(--rack-type-color) 84%, #ffffff 0%);
  cursor: pointer;
}

.rack-tile:hover,
.rack-tile.selected {
  border-color: rgba(14, 165, 233, 0.78);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.16);
}

.rack-tile.alert {
  border-color: rgba(239, 68, 68, 0.82);
  box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.2);
}

.rack-tile.critical {
  border-color: rgba(239, 68, 68, 0.95);
  box-shadow:
    inset 0 0 0 1px rgba(239, 68, 68, 0.28),
    0 0 18px rgba(239, 68, 68, 0.18);
}

.rack-tile.warning {
  border-color: rgba(245, 158, 11, 0.9);
  box-shadow:
    inset 0 0 0 1px rgba(245, 158, 11, 0.24),
    0 0 18px rgba(245, 158, 11, 0.14);
}

.rack-tile.selected {
  border-color: rgba(253, 230, 138, 0.96);
  background:
    linear-gradient(180deg, rgba(245, 158, 11, 0.2), rgba(14, 165, 233, 0.12)),
    rgba(10, 18, 32, 0.98);
  box-shadow:
    0 0 0 2px rgba(253, 230, 138, 0.36),
    0 0 24px rgba(245, 158, 11, 0.22);
}

.rack-name {
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
}

.rack-type,
.rack-meta {
  color: var(--color-text-muted);
  font-size: 11px;
}

.alert-badge {
  width: fit-content;
  padding: 3px 6px;
  border-radius: 999px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.18);
  font-size: 12px;
}
</style>
