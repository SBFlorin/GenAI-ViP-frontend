<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';

const appStore = useAppStore();
const currentYear = new Date().getFullYear();
</script>

<template>
    <div class="footer gap-y-4">
        <div class="info flex flex-col gap-2 w-full">
            <div class="row flex items-center gap-x-2 w-full" v-for="(item, index) in appStore.footerInfo"
                :key="index">
                <i v-if="item.icon" class="icon" :class="item.icon"></i>
                <span>{{ item.text }}</span>
            </div>
        </div>
        <span class="copyright">Test deploy Copyright &copy;{{ currentYear }}</span>
    </div>
    <Toast position="top-center" />
    <Login />
    <Register />
    <ConfirmDialog />
</template>

<style scoped>
.icon {
    width: 30px;
    height: 30px;
}

.info {
    padding-left: 40px;
    padding-right: 40px;
}
.row {
    font-size: 14px;
}
</style>