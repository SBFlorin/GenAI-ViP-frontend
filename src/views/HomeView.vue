<script setup lang="ts">
import { useAppStore } from "@/stores/appStore";
import { ref } from 'vue';

const appStore = useAppStore();

const breadcrumbData = ref([
    { label: 'home', route: '/' },
]);
appStore.breadcrumb = breadcrumbData.value;

const topButtonsData = ref([
    { label: 'Student', icon: 'icon medic', isActive: true },
    { label: 'Admin', icon: 'icon cog' }
]);
appStore.topButtons = topButtonsData.value;

</script>

<template>
    <div class="homepage">
        <div class="flex justify-between items-center gap-x-8">
            <i class="icon runner"></i>
            <div class="text">
                Învață rapid și eficient aplicarea sfatului minimal de renunțare la fumat
            </div>
        </div>
    </div>
</template>

<style scoped>
.homepage {
    display: flex;
    justify-content: center;
    flex: auto;
}

.icon {
    margin-right: 8px;
}

.text {
    font-size: 30px;
    color: #9FABDC;
    max-width: 600px;
}
</style>