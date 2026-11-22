import './assets/styles/style.css'
import './assets/styles/icons.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            // Always use light theme (ignore OS dark mode)
            darkModeSelector: false
        }
    }
});
app.use(ToastService);
app.use(ConfirmationService)
// Redirect after refresh if authenticated
import { useUserStore } from './stores/userStore';
const userStore = useUserStore();
if (userStore.isAuthenticated) {
    void userStore.refreshSession();
}
if (userStore.isAuthenticated && window.location.pathname === '/') {
    if (userStore.user.role === 'admin') {
        router.replace({ name: 'admin' });
    } else if (userStore.user.role === 'evaluator') {
        router.replace({ name: 'evaluator.study' });
    } else if (userStore.user.role === 'user') {
        router.replace({ name: 'student.informare' });
    }
}
app.mount('#app')