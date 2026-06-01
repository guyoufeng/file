<script setup lang="ts">
defineProps<{
  compact?: boolean;
  dark?: boolean;
}>();
</script>

<template>
  <div
    class="chervon-logo"
    :class="{ compact, dark }"
    data-testid="chervon-login-logo"
    aria-label="CHERVON 泉峰 Better Tools Better World"
  >
    <div class="logo-line">
      <span>CHERV</span><span class="logo-o">O</span><span>N</span>
      <small>泉峰</small>
    </div>
    <div class="tagline">Better Tools. Better World.</div>
  </div>
</template>

<style scoped>
.chervon-logo {
  color: var(--logo-color);
  letter-spacing: 0;
}

.chervon-logo.dark {
  color: #111827;
}

.logo-line {
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  font-size: 24px;
  font-weight: 950;
  font-style: italic;
  line-height: 1;
}

.logo-line small {
  margin-left: 6px;
  font-size: 13px;
  font-style: normal;
  font-weight: 900;
}

.logo-o {
  color: #8dc63f;
}

.tagline {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.compact .logo-line {
  font-size: 18px;
}

.compact .logo-line small {
  font-size: 10px;
}

.compact .tagline {
  font-size: 8px;
}
</style>
