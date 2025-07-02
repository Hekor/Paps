<script setup lang="ts">
import Header from './components/Header.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <Header />
    <main class="flex-grow">
      <router-view />
    </main>
  </div>
</template>
