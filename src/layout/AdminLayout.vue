<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { ref } from 'vue';

const appStore = useAppStore();

const topButtonsData = ref([
    { label: 'Setări caracteristici subiecți', icon: 'icon wrench', isActive: true, routeName: 'admin'},
    { label: 'Catalog', icon: 'icon grid',  routeName: 'admin.catalog' },
    { label: 'Statistici', icon: 'icon graph', routeName: 'admin.statistici' },
    { label: 'Formulare Evaluatori', icon: 'icon medic', routeName: 'admin.evaluatorForms' }
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