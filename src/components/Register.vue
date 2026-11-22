<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
const toast = useToast();

import { useAppStore } from "@/stores/appStore";
import { useUserStore } from "@/stores/userStore";

const appStore = useAppStore();
const userStore = useUserStore();

import { ref } from "vue";
const email = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const name = ref(""); // Add name if needed
const errorMsg = ref("");

const handleLogin = () => {
    appStore.registerDialogVisible = false;
    appStore.loginDialogVisible = true;
};

const handleRegister = async () => {
    errorMsg.value = "";
    if (password.value !== confirmPassword.value) {
        errorMsg.value = "Parolele nu se potrivesc.";
        return;
    }
    try {
        await userStore.register({ firstName: name.value, email: email.value, username: username.value, password: password.value });
        appStore.registerDialogVisible = false;
        toast.add({ severity: 'success', summary: 'Succes', detail: 'Cont creat cu succes!', life: 3000 });
    } catch (error: any) {
        errorMsg.value = error?.message || "Eroare la înregistrare.";
    }
};

</script>

<template>
    <Dialog v-model:visible="appStore.registerDialogVisible" modal header="Creare cont nou"
        :style="{ width: '25rem' }">
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4 mb-4">
                <label for="register-name" class="font-semibold w-24">Nume</label>
                <InputText id="register-name" class="flex-auto" autocomplete="off" v-model="name" />
            </div>
            <div class="flex items-center gap-4 mb-8">
                <label for="register-email" class="font-semibold w-24">Email</label>
                <InputText id="register-email" class="flex-auto" autocomplete="off" v-model="email" />
            </div>
            <div class="flex items-center gap-4 mb-8">
                <label for="register-username" class="font-semibold w-24">Utilizator</label>
                <InputText id="register-username" class="flex-auto" autocomplete="off" v-model="username" />
            </div>
            <div class="flex items-center gap-4 mb-4">
                <label for="register-password" class="font-semibold w-24">Parolă</label>
                <Password id="register-password" class="flex-auto" autocomplete="off" v-model="password" />
            </div>
            <div class="flex items-center gap-4 mb-4">
                <label for="confirm-password" class="font-semibold w-24">Confirmă</label>
                <Password id="confirm-password" class="flex-auto" autocomplete="off" v-model="confirmPassword" />
            </div>
            <div v-if="errorMsg" class="text-red-500 text-sm mb-2">{{ errorMsg }}</div>
            <div class="flex justify-center gap-2 mb-4">
                <span class="text-blue-600 hover:text-blue-800 text-sm cursor-pointer" @click="handleLogin">Am deja un cont</span>
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" label="Anulare" severity="secondary"
                    @click="appStore.registerDialogVisible = false"></Button>
                <Button type="button" label="Creare cont" @click="handleRegister"></Button>
            </div>
        </div>
    </Dialog>
</template>

<style>
#register-password .p-password-input,
#confirm-password .p-password-input {
    flex: auto;
}
</style>
