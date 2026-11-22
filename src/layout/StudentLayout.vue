<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { ref } from 'vue';

const appStore = useAppStore();

const topButtonsData = ref([
    { label: 'Informare', icon: 'icon informare', isActive: true, routeName: 'student.informare'},
    { label: 'Instruire', icon: 'icon medic',  routeName: 'student.instruire' },
    { label: 'Examinare', icon: 'icon speed', routeName: 'student.examinare' }
]);
appStore.topButtons = topButtonsData.value;
</script>

<template>
    <Header></Header>
    <div class="page-container"><RouterView /></div>
    <Footer></Footer>
</template>

<style scoped>

</style>