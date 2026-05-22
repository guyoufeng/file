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
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(8, 17, 31, 0.82);
}

pre {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
