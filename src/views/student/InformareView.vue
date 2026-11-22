<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { useFaqStore } from '@/stores/faqStore';
import { ref, computed } from 'vue';
import diagrama from '@/assets/images/diagrama.png';

const appStore = useAppStore();
const faqStore = useFaqStore();

const breadcrumbData = ref([
    { label: 'student', route: '/student' },
    { label: 'informare' },
]);
appStore.breadcrumb = breadcrumbData.value;

// FAQ management
const activeQuestionIndex = ref(0);

const activeFaq = computed(() => {
    return faqStore.faqs[activeQuestionIndex.value] || faqStore.faqs[0];
});

const setActiveQuestion = (index: number) => {
    activeQuestionIndex.value = index;
};

const footerInfoData = ref([
    {text: 'Observație: Conținutul minicursului pregătitor se afișează secvențial în caseta de jos prin click pe întrebările din lista afișată sub meniul principal.'}
]);
appStore.footerInfo = footerInfoData.value;
</script>

<template>
    <div class="student flex flex-auto gap-4">
        <div class="instructaj flex flex-col gap-y-6 flex-1">
            <div class="title">Ce trebuie să știi despre sfatul minimal de renunțare la fumat (SMRF)</div>
            <div class="intrebari flex flex-col gap-y-1">
                <div 
                    v-for="(question, index) in faqStore.questions" 
                    :key="index"
                    :class="['intrebare', { active: index === activeQuestionIndex }]"
                    @click="setActiveQuestion(index)"
                >
                    {{ question }}
                </div>
            </div>
            <div class="raspuns flex flex-col flex-auto gap-y-2">
                <div class="raspuns-title">{{ activeFaq.title }}</div>
                <div class="raspuns-text flex-auto" v-html="activeFaq.content"></div>
            </div>
        </div>
        <div class="diagrama flex flex-col flex-1">
            <div class="title-diagrama flex justify-center w-full">Diagrama sfatului minimal de renunțare la fumat</div>
            <div>
                <img :src="diagrama" alt="Diagrama sfatului minimal de renunțare la fumat" class="w-full h-auto">
            </div>
        </div>
    </div>
</template>

<style scoped>
.student {
    padding: 20px 0;
}

.diagrama {
    border: 2px solid #000;
    padding: 10px;
    background-color: #F2F2F2;
}

.title-diagrama {
    font-size: 20px;
    font-weight: bold;

}

.title,
.intrebare {
    font-size: 16px;
    font-weight: bold;
}

.intrebare {
    cursor: pointer;
}

.intrebare:hover {
    color: #2F5597;
}

.active.intrebare {
    color: #2F5597;
}

.active.intrebare::before {
    content: "✔";
    color: #2F5597;
}

.intrebare::before {
    content: "•";
    margin-right: 5px;
    color: #000;
    font-size: 18px;
}

.raspuns {
    border: 2px solid #000;
    padding: 20px;
    background-color: #DEEBF7;
}

.raspuns-title {
    font-size: 16px;
    font-weight: bold;
}
</style>