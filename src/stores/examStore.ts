import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useExamStore = defineStore('examStore', () => {
    const scenarios = ref<any[]>([
        { index: 1, title: 'Cazul nr. 1' },
        { index: 2, title: 'Cazul nr. 2' },
        { index: 3, title: 'Cazul nr. 3' },
        { index: 4, title: 'Cazul nr. 4' },
        { index: 5, title: 'Cazul nr. 5' },
        { index: 6, title: 'Cazul nr. 6' },
        { index: 7, title: 'Cazul nr. 7' },
        { index: 8, title: 'Cazul nr. 8' },
        { index: 9, title: 'Cazul nr. 9' },
        { index: 10, title: 'Cazul nr. 10' }
    ]);

    return {
        scenarios
    };
});