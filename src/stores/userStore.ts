import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../apiRequest';
import { socketService } from '../services/socketService';

export const useUserStore = defineStore('userStore', () => {
    const user = ref<any>({ name: '', role: '' });
    const isAuthenticated = ref(false);
    const authToken = ref<string | null>(localStorage.getItem('auth_token'));

    // Restore state from localStorage on initialization
    const token = localStorage.getItem('auth_token');
    const storedRole = localStorage.getItem('auth_role');
    const storedName = localStorage.getItem('auth_name');
    if (token && storedRole) {
        isAuthenticated.value = true;
        user.value.role = storedRole;
        user.value.name = storedName || '';
        // Initialize socket connection with restored token
        socketService.connect(token);
    }

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_name');
        authToken.value = null;
        isAuthenticated.value = false;
        user.value = { name: '', role: '' };
        // Disconnect socket on logout
        socketService.disconnect();
    };
    // removed duplicate declarations


    const register = async (payload: { firstName: string; email: string; username: string; password: string }) => {
        try {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return data;
        } catch (error) {
            throw error;
        }
    };

    const login = async (payload: { email: string; password: string }) => {
        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (data.token) {
                if (!data.user?.role) {
                    throw new Error('No role provided. Authentication failed.');
                }
                authToken.value = data.token;
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_role', data.user.role);
                localStorage.setItem('auth_name', data.user.name || '');
                isAuthenticated.value = true;
                user.value.role = data.user.role;
                user.value.name = data.user.name || '';
                // Initialize socket connection with new token
                socketService.connect(data.token);
            }
            console.log(`isAuthenticated: ${isAuthenticated.value}, role: ${user.value.role}`);
            return data;
        } catch (error) {
            throw error;
        }
    };

    const getToken = () => {
        return localStorage.getItem('auth_token');
    };

    /** Sync role from server (JWT/localStorage can be stale). */
    const refreshSession = async () => {
        const token = getToken();
        if (!token) return;
        try {
            const data = await apiRequest('/auth/profile');
            if (data.user?.role) {
                user.value.role = data.user.role;
                localStorage.setItem('auth_role', data.user.role);
            }
            if (data.user?.name) {
                user.value.name = data.user.name;
                localStorage.setItem('auth_name', data.user.name);
            }
        } catch {
            // ignore — token may be invalid
        }
    };

    return {
        user,
        isAuthenticated,
        authToken,
        register,
        login,
        logout,
        getToken,
        refreshSession
    };
});