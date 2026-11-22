<script setup lang="ts">
import '@/assets/styles/evaluator-study.css';
import { useAppStore } from '@/stores/appStore';

const appStore = useAppStore();

const topButtonsData = [
  {
    label: 'Studiu evaluare',
    icon: 'icon medic',
    isActive: true,
    routeName: 'evaluator.study'
  }
];
appStore.topButtons = topButtonsData;
</script>

<template>
  <Header />
  <div class="page-container evaluator-page"><RouterView /></div>
  <Footer />
</template>

<style>
/* Ensures Prime inputs inside evaluator routes stay light (works with teleported DOM) */
.evaluator-page .p-inputtext,
.evaluator-page .p-textarea,
.evaluator-page input.p-inputtext,
.evaluator-page textarea.p-textarea {
  background: #ffffff !important;
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
}
</style>
