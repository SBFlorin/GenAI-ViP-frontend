<script setup lang="ts">
import { ref } from 'vue';
const email = ref('');
const password = ref('');
import { useAppStore } from "@/stores/appStore";
import { useUserStore } from "@/stores/userStore";
import { useRouter } from 'vue-router';

const appStore = useAppStore();
const userStore = useUserStore();
const router = useRouter();

const handlePasswordreset = () => {
    appStore.loginDialogVisible = false;
};

const handleRegister = () => {
    appStore.loginDialogVisible = false;
    appStore.registerDialogVisible = true; 
};

const handleLogin = () => {
    appStore.loginDialogVisible = false;
    userStore.login({ email: email.value, password: password.value })
        .then(() => {
            if (userStore.user.role === 'admin') {
                router.push({ name: 'admin' });
            } else if (userStore.user.role === 'evaluator') {
                router.push({ name: 'evaluator.study' });
            } else if (userStore.user.role === 'user') {
                router.push({ name: 'student.informare' });
            } else {
                router.push({ name: 'student.informare' });
            }
        })
        .catch((error) => {
            // Optionally show error to user
            console.error(error);
            alert("Login failed: " + (error.message || "Unknown error"));
        });
};

</script>

<template>
    <Dialog v-model:visible="appStore.loginDialogVisible" modal header="Logare in aplicație"
        :style="{ width: '25rem' }">
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4 mb-8">
                <label for="email" class="font-semibold w-24">Email</label>
                <InputText id="email" class="flex-auto" autocomplete="off" v-model="email" />
            </div>
            <div class="flex items-center gap-4 mb-4">
                <label for="password" class="font-semibold w-24">Parolă</label>
                <Password id="password" class="flex-auto" autocomplete="off" v-model="password" />
            </div>
            <div class="flex justify-between gap-2 mb-4">
                <span class="text-blue-600 hover:text-blue-800 text-sm cursor-pointer">Resetare parolă</span>
                <span v-if="false" class="text-blue-600 hover:text-blue-800 text-sm cursor-pointer" @click="handleRegister">Creare cont</span>
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" label="Anulare" severity="secondary"
                    @click="appStore.loginDialogVisible = false"></Button>
                <Button type="button" label="Login" @click="handleLogin"></Button>
            </div>
        </div>
    </Dialog>
</template>

<style>
#password .p-password-input {
    flex: auto;
}
</style>