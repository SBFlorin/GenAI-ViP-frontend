import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTrainingStore = defineStore('trainingStore', () => {
    const scenarios = ref<any[]>([
        { index: 'Scenariul 1', title: 'Pacient nefumător' },
        { index: 'Scenariul 2', title: 'Fumător interesat' },
        { index: 'Scenariul 3', title: 'Fumător neinteresat' }
    ]);

    return {
        scenarios
    };
});