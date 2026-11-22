<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useSocketInitializer } from './composables/useSocketInitializer'

// Initialize socket connection management
useSocketInitializer()

</script>

<template>
  <RouterView />
</template>

<style scoped>

</style>
