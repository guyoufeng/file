<script setup lang="ts">
defineProps<{
  answer: string
}>()
</script>

<template>
  <article class="answer-card">
    <pre>{{ answer }}</pre>
  </article>
</template>

<style scoped>
.answer-card {
  align-self: stretch;
  padding: 11px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(14, 165, 233, 0.08), transparent),
    rgba(8, 17, 31, 0.86);
}

pre {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}
</style>
