import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../apiRequest';

export const useSettingsStore = defineStore('settingsStore', () => {
    const settings = ref<any>({});

    // Fetch settings from backend
    const fetchSettings = async () => {
        try {
            const data = await apiRequest('/settings', {
                method: 'GET'
            });
            settings.value = data || {};
            return settings.value;
        } catch (error) {
            console.error('Eroare la preluarea setărilor:', error);
            return {};
        }
    };

    // Send settings to backend
    const setSettings = async (newSettings: any) => {
        try {
            const data = await apiRequest('/settings', {
                method: 'POST',
                body: JSON.stringify(newSettings)
            });
            settings.value = data.settings || { ...newSettings };
        } catch (error) {
            console.error('Eroare la salvarea setărilor:', error);
        }
    };

    return {
        settings,
        fetchSettings,
        setSettings
    };
});
