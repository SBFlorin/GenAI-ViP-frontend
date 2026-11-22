<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
const confirm = useConfirm();
import { useAppStore } from "@/stores/appStore";
import { useUserStore } from "@/stores/userStore";
import { useRouter } from 'vue-router';

const appStore = useAppStore();
const userStore = useUserStore();
const router = useRouter();

const user = 'Autentificare'
const handleAuthentication = () => {
    appStore.loginDialogVisible = true;
}

const handleButtonClick = (clickedIndex: number) => {
    // Set all buttons to inactive
    appStore.topButtons.forEach((button, index) => {
        button.isActive = index === clickedIndex;
    });
    
    // Navigate to the route if routeName exists
    const clickedButton = appStore.topButtons[clickedIndex];
    if (clickedButton && clickedButton.routeName) {
        router.push({ name: clickedButton.routeName });
    }
}

const handleLogout = () => {
    confirm.require({
        message: 'Sigur doriți să vă deconectați?',
        header: 'Confirmare deconectare',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Da',
        rejectLabel: 'Nu',
        accept: () => {
            userStore.logout();
            appStore.topButtons.forEach(button => button.isActive = false);
            if (appStore.topButtons.length > 0) {
                appStore.topButtons.forEach((button, index) => button.isActive = index === 0);
            }
            appStore.loginDialogVisible = false;
            appStore.registerDialogVisible = false;
            router.push({ name: 'home' });
        },
        reject: () => {}
    });
};
</script>

<template>
    <div class="header">
        <div class="row1">
            <Breadcrumb :model="appStore.breadcrumb" class="breadcrumb">
                <template #item="{ item, props }">
                    <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
                        <a :href="href" v-bind="props.action" @click="navigate">
                            <span class="active-link">{{ item.label }}</span>
                        </a>
                    </router-link>
                    <div v-else>
                        <span class="inactive-link">{{ item.label }}</span>
                    </div>
                </template>
                <template #separator>/</template>
            </Breadcrumb>
            <div v-if="!userStore.isAuthenticated" class="user-menu" @click="handleAuthentication">{{ user }}</div>
            <div v-else class="user-menu text-blue-600 hover:text-blue-800 text-sm cursor-pointer" @click="handleLogout">{{ userStore.user.name }} - Logout</div>
        </div>
        <div class="row2">
            <div
                v-for="(button, idx) in appStore.topButtons"
                :key="idx"
                :class="['header-button', { active: button.isActive }]"
                @click="handleButtonClick(idx)"
            >
                <i :class="button.icon"></i>
                <span>{{ button.label }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.user-menu {
    cursor: pointer;
}

.header-button {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    flex: 1;
    padding: 10px;
    background-color: #4472C4;
    transition: background-color 0.3s;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    font-size: 18px;
    cursor: pointer;
}

.header-button span {
    color: white;
}

.header-button.active, .header-button:hover {
    background-color: #BDD7EE;
}

.header-button.active span, .header-button:hover span {
    color: #2F5AB8;
}

</style>
<style>
.breadcrumb .active-link {
    color: var(--color-blue-600);
}

.breadcrumb .active-link:hover {
    color: var(--color-blue-800);
}
</style>