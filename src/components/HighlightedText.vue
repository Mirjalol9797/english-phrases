<script setup lang="ts">
import { computed } from 'vue'
import { highlight } from '@/utils/search'

// Подсветка совпадений поиска тем же жёлтым маркером, что и в остальном приложении.
const props = defineProps<{ text: string; query?: string }>()

const parts = computed(() => highlight(props.text, props.query ?? ''))
</script>

<template>
  <template v-for="(part, index) in parts" :key="index"
    ><span v-if="part.match" class="marker">{{ part.text }}</span
    ><template v-else>{{ part.text }}</template
  ></template>
</template>
