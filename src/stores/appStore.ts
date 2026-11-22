import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('appStore', () => {
    const breadcrumb = ref<any[]>([]);
    const topButtons = ref<any[]>([]);
    const footerInfo = ref<any[]>([]);
    const loginDialogVisible = ref(false);
    const registerDialogVisible = ref(false);

    return {
        breadcrumb,
        topButtons,
        footerInfo,
        loginDialogVisible,
        registerDialogVisible
    };
});