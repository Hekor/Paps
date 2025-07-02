<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <h1 class="text-4xl font-bold mb-6">{{ msg }}</h1>

  <div class="bg-surface p-8 rounded-lg shadow-lg mb-6">
    <button 
      type="button" 
      @click="count++" 
      class="bg-primary hover:bg-accent text-textPrimary font-medium py-2 px-4 rounded-md transition-colors duration-300 mb-4"
    >
      count is {{ count }}
    </button>
    <p class="text-textSecondary">
      Edit
      <code class="bg-background px-1 py-0.5 rounded text-accent">components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <p class="mb-4">
    Check out
    <a 
      href="https://vuejs.org/guide/quick-start.html#local" 
      target="_blank"
      class="text-accent hover:text-textPrimary underline"
    >create-vue</a>, the official Vue + Vite starter
  </p>
  <p class="mb-4">
    Learn more about IDE Support for Vue in the
    <a
      href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
      target="_blank"
      class="text-accent hover:text-textPrimary underline"
    >Vue Docs Scaling up Guide</a>.
  </p>
  <p class="text-textSecondary">Click on the Vite and Vue logos to learn more</p>
</template>
