<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
import { ref } from 'vue';
import underConstruction from '@/assets/images/image.png'

const appStore = useAppStore();

const breadcrumbData = ref([
    { label: 'admin', route: '/admin' },
    { label: 'catalog' },
]);
appStore.breadcrumb = breadcrumbData.value;
</script>

<template>
    <div class="under-construction flex flex-auto justify-center items-center gap-4">
        <div><img :src="underConstruction" alt="Under Construction" /></div>
    </div>
</template>

<style scoped>

</style>